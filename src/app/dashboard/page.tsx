'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import SafeImage from '@/components/SafeImage';
import PostForm from '@/components/PostForm';
import { apiClient } from '@/lib/api';
import { Post, Comment, Pagination, User } from '@/config/api';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [newComment, setNewComment] = useState<{ [key: number]: string }>({});
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedComments, setExpandedComments] = useState<{ [key: number]: boolean }>({});
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Fetch initial posts from API
  const fetchPosts = useCallback(async () => {
    setIsLoadingPosts(true);
    setError(null);
    try {
      const response = await apiClient.getPosts(1, 10);
      console.log('API Response:', response);
      if (response.success && response.data && response.data.posts && Array.isArray(response.data.posts)) {
        setPosts(response.data.posts);
        setPagination(response.data.pagination);
        setHasMorePosts(response.data.pagination.current_page < response.data.pagination.last_page);
      } else {
        console.log('API failed or returned non-array data:', response);
        setError(response.message || 'Failed to load posts');
      }
    } catch (error) {
      console.log('API Error:', error);
      setError('Network error. Please try again.');
    } finally {
      setIsLoadingPosts(false);
    }
  }, []);

  // Load more posts for infinite scroll
  const loadMorePosts = useCallback(async () => {
    if (!pagination || !hasMorePosts || isLoadingMore) return;
    
    setIsLoadingMore(true);
    try {
      const nextPage = pagination.current_page + 1;
      const response = await apiClient.getPosts(nextPage, 10);
      
      if (response.success && response.data && response.data.posts && Array.isArray(response.data.posts)) {
        setPosts(prevPosts => [...prevPosts, ...response.data!.posts]);
        setPagination(response.data!.pagination);
        setHasMorePosts(response.data!.pagination.current_page < response.data!.pagination.last_page);
      } else {
        setError(response.message || 'Failed to load more posts');
      }
    } catch (error) {
      console.log('API Error:', error);
      setError('Network error. Please try again.');
    } finally {
      setIsLoadingMore(false);
    }
  }, [pagination, hasMorePosts, isLoadingMore]);

  useEffect(() => {
    // Check if user is authenticated
    if (!apiClient.isAuthenticated()) {
      router.push('/login');
      return;
    }

    // Fetch user profile and posts
    const fetchData = async () => {
      try {
        const [profileResponse] = await Promise.all([
          apiClient.getProfile(),
        ]);
        
        if (profileResponse.success && profileResponse.data) {
          setUser(profileResponse.data.user);
          // Fetch posts after profile is loaded
          await fetchPosts();
        } else {
          // If profile fetch fails, redirect to login
          router.push('/login');
        }
      } catch {
        router.push('/login');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [router, fetchPosts]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const target = entries[0];
        if (target.isIntersecting && hasMorePosts && !isLoadingMore) {
          loadMorePosts();
        }
      },
      {
        threshold: 0.1,
        rootMargin: '100px',
      }
    );

    const currentRef = loadMoreRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [hasMorePosts, isLoadingMore, loadMorePosts]);

  const handleLogout = async () => {
    if (isLoggingOut) return; // Prevent multiple clicks
    
    const confirmed = window.confirm('Are you sure you want to logout?');
    if (!confirmed) return;
    
    setIsLoggingOut(true);
    
    try {
      // Call logout API
      await apiClient.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Always clear the token and redirect to login
      apiClient.removeToken();
      router.push('/login');
    }
  };

  const handleLike = async (postId: number) => {
    if (!user?.permissions.can_like_post) {
      window.scrollTo(0, 0);
      setError('You do not have permission to like posts.');
      return;
    }
    
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    // Optimistic update using functional state update
    setPosts(currentPosts => currentPosts.map(p => {
      if (p.id === postId) {
        return {
          ...p,
          is_liked: !p.is_liked,
          likes_count: p.is_liked ? p.likes_count - 1 : p.likes_count + 1
        };
      }
      return p;
    }));

    try {
      const response = post.is_liked 
        ? await apiClient.unlikePost(postId)
        : await apiClient.likePost(postId);
      
      if (!response.success) {
        // Revert optimistic update on failure using functional state update
        setPosts(currentPosts => currentPosts.map(p => {
          if (p.id === postId) {
            return {
              ...p,
              is_liked: post.is_liked,
              likes_count: post.likes_count
            };
          }
          return p;
        }));
        setError(response.message || 'Failed to update like');
      }
    } catch {
      // Revert optimistic update on error using functional state update
      setPosts(currentPosts => currentPosts.map(p => {
        if (p.id === postId) {
          return {
            ...p,
            is_liked: post.is_liked,
            likes_count: post.likes_count
          };
        }
        return p;
      }));
      setError('Network error. Please try again.');
    }
  };

  const handleComment = async (postId: number) => {
    const commentText = newComment[postId]?.trim();
    if (!commentText || !user) return;

    const tempComment: Comment = {
      id: Date.now() + Math.random(), // More unique temporary ID
      post_id: postId,
      user_id: user.id,
      content: commentText,
      created_at: Math.floor(Date.now() / 1000), // Convert to Unix timestamp in seconds
      user: {
        id: user.id,
        name: user.name,
      }
    };

    // Optimistic update using functional state update
    setPosts(currentPosts => currentPosts.map(post => {
      if (post.id === postId) {
        return {
          ...post,
          comments: [...post.comments, tempComment],
          comments_count: post.comments_count + 1
        };
      }
      return post;
    }));

    setNewComment({ ...newComment, [postId]: '' });

    try {
      const response = await apiClient.createComment({
        post_id: postId,
        content: commentText
      });

      if (response.success && response.data) {
        // Update with real comment data using functional state update
        setPosts(currentPosts => currentPosts.map(post => {
          if (post.id === postId) {
            return {
              ...post,
              comments: post.comments.map(c => 
                c.id === tempComment.id ? response.data!.comment : c
              )
            };
          }
          return post;
        }));
      } else {
        // Remove optimistic comment on failure using functional state update
        setPosts(currentPosts => currentPosts.map(post => {
          if (post.id === postId) {
            return {
              ...post,
              comments: post.comments.filter(c => c.id !== tempComment.id),
              comments_count: post.comments_count - 1
            };
          }
          return post;
        }));
        setError(response.message || 'Failed to add comment');
      }
    } catch {
      // Remove optimistic comment on error using functional state update
      setPosts(currentPosts => currentPosts.map(post => {
        if (post.id === postId) {
          return {
            ...post,
            comments: post.comments.filter(c => c.id !== tempComment.id),
            comments_count: post.comments_count - 1
          };
        }
        return post;
      }));
      setError('Network error. Please try again.');
    }
  };

  const handleCommentChange = (postId: number, value: string) => {
    setNewComment({ ...newComment, [postId]: value });
  };

  const toggleComments = (postId: number) => {
    setExpandedComments(prev => ({
      ...prev,
      [postId]: !prev[postId]
    }));
  };

  const handlePostCreated = () => {
    // Reset pagination and refresh posts after creating a new one
    setPagination(null);
    setHasMorePosts(true);
    fetchPosts();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                InstaApp
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-700">Welcome, {user?.name || 'User'}!</span>
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="bg-red-500 hover:bg-red-600 disabled:bg-red-300 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors flex items-center space-x-2"
              >
                {isLoggingOut ? (
                  <>
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Logging out...</span>
                  </>
                ) : (
                  'Logout'
                )}
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto py-6 px-4">
        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm">{error}</p>
            <div className="flex space-x-2 mt-2">
              <button 
                onClick={() => setError(null)}
                className="text-red-500 text-xs hover:underline"
              >
                Dismiss
              </button>
              <button 
                onClick={fetchPosts}
                className="text-blue-500 text-xs hover:underline"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Loading Posts */}
        {isLoadingPosts && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading posts...</p>
          </div>
        )}

        {/* Post Creation Form */}
        {user?.permissions.can_create_post ? (
          <PostForm 
            onPostCreated={handlePostCreated}
            onError={setError}
          />
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500">You do not have permission to create posts.</p>
          </div>
        )}

        {/* Instagram-like Feed */}
        <div className="space-y-6">
          {Array.isArray(posts) && posts.length > 0 ? (
            <>
              {posts.map((post) => (
            <div key={post.id} className="bg-white rounded-lg shadow-sm border border-gray-200">
              {/* Post Header */}
              <div className="flex items-center p-4 border-b border-gray-100">
                <SafeImage
                  src={`https://ui-avatars.com/api/?name=${post.user.name}&background=random`}
                  alt={post.user.name}
                  width={40}
                  height={40}
                  className="w-10 h-10 rounded-full object-cover mr-3"
                  useProxy={false}
                  fallbackSrc="https://ui-avatars.com/api/?name=User&background=random"
                />
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{post.user.name}</h3>
                  <p className="text-sm text-gray-500">
                    {formatDistanceToNow(new Date(post.created_at * 1000), { addSuffix: true })}
                  </p>
                </div>
                <button className="text-gray-400 hover:text-gray-600">
                  
                </button>
              </div>

              {/* Post Image */}
              <div className="relative">
                <SafeImage
                  src={post.image_url}
                  alt={`Post by ${post.user.name}`}
                  width={600}
                  height={600}
                  className="w-full h-auto object-cover"
                  useProxy={true}
                  fallbackSrc="https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&h=600&fit=crop"
                />
              </div>

              {/* Post Actions */}
              <div className="p-4">
                <div className="flex items-center space-x-4 mb-3">
                  <button
                    onClick={() => handleLike(post.id)}
                    className={`transition-colors ${
                      post.is_liked ? 'text-red-500' : 'text-gray-400 hover:text-red-500'
                    }`}
                  >
                    <svg
                      className="w-7 h-7"
                      fill={post.is_liked ? 'currentColor' : 'none'}
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                      />
                    </svg>
                  </button>
                  <div className="flex-1"></div>
                </div>

                {/* Likes Count */}
                <div className="mb-2">
                  <p className="font-semibold text-gray-900">
                    {post.likes_count.toLocaleString()} {post.likes_count === 1 ? 'like' : 'likes'}
                  </p>
                </div>

                {/* Caption */}
                <div className="mb-3">
                  <p className="text-gray-900">
                    <span className="font-semibold mr-2">{post.user.name}</span>
                    <br />
                    {post.content}
                  </p>
                </div>

                <div className="mb-3">
                  <span className="font-semibold mr-2">Komentar :</span>
                </div>

                {/* Comments */}
                {post.comments.length > 0 && (
                  <div className="mb-3">
                    {post.comments.length > 2 && (
                      <button 
                        onClick={() => toggleComments(post.id)}
                        className="text-gray-500 text-sm mb-2 hover:text-gray-700 transition-colors cursor-pointer"
                      >
                        {expandedComments[post.id] 
                          ? 'Hide comments' 
                          : `View all ${post.comments.length} comments`
                        }
                      </button>
                    )}
                    <div className={`space-y-1 ${expandedComments[post.id] ? 'max-h-96 overflow-y-auto' : ''}`}>
                      {(expandedComments[post.id] ? post.comments : post.comments.slice(-2)).map((comment) => (
                        <div key={comment.id} className="text-gray-900">
                          <p>
                            <span className="font-semibold mr-2">{comment.user?.name || 'Unknown User'}</span>
                            {comment.content}
                          </p>
                        </div>
                      ))}
                    </div>

                    {expandedComments[post.id] && post.comments.length > 5 && (
                      <div className="mt-2 pt-2 border-t border-gray-100">
                        <button 
                          onClick={() => toggleComments(post.id)}
                          className="text-gray-500 text-sm hover:text-gray-700 transition-colors"
                        >
                          Show less
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Comment Input */}
                {user?.permissions.can_create_comment ? (
                <div className="flex items-center space-x-2 pt-3 border-t border-gray-100">
                  <input
                    type="text"
                    placeholder="Add a comment..."
                    value={newComment[post.id] || ''}
                    onChange={(e) => handleCommentChange(post.id, e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleComment(post.id)}
                    className="flex-1 text-sm border-none outline-none placeholder-gray-500"
                  />
                  <button
                    onClick={() => handleComment(post.id)}
                    disabled={!newComment[post.id]?.trim()}
                    className="text-blue-500 font-semibold text-sm disabled:text-gray-300 disabled:cursor-not-allowed"
                  >
                    Post
                  </button>
                </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-500">You do not have permission to create comments.</p>
                  </div>
                )}
              </div>
            </div>
              ))}

              {/* Infinite Scroll Trigger */}
              {hasMorePosts && (
                <div ref={loadMoreRef} className="py-8">
                  {isLoadingMore ? (
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
                      <p className="text-gray-600">Loading more posts...</p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <p className="text-gray-500">Scroll down to load more posts</p>
                    </div>
                  )}
                </div>
              )}

              {/* No more posts indicator */}
              {!hasMorePosts && posts.length > 0 && (
                <div className="text-center py-8">
                  <p className="text-gray-500">You&apos;ve reached the end of the feed!</p>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">
                <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No posts yet</h3>
              <p className="text-gray-500">Be the first to share something amazing!</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
