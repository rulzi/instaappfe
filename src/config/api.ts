// API Configuration based on http://instaapp.test/docs?api-docs.json
export const API_CONFIG = {
  BASE_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api',
  ENDPOINTS: {
    LOGIN: '/login',
    REGISTER: '/register',
    LOGOUT: '/logout',
    PROFILE: '/me',
    POSTS: '/post',
    USERS: '/users',
  },
  TIMEOUT: 10000, // 10 seconds
};

// API Response Types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: Record<string, string[]>;
}

export interface PostsResponse {
  posts: Post[];
  pagination: Pagination;
}
export interface Pagination {
  total: number;
  per_page: number;
  current_page: number;
  last_page: number;
}

export interface UserResponse {
  user: User;
}

// User model based on API docs
export interface User {
  id: number;
  name: string;
  email: string;
  created_at: string;
  updated_at: string;
}

// Request interfaces based on API docs
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
}

// Response interfaces based on API docs
export interface AuthResponse {
  user: User;
  token: string;
  token_type: string;
}

// Post interfaces based on Instagram-like API
export interface Post {
  id: number;
  user_id: number;
  content: string;
  image_url: string;
  likes_count: number;
  comments_count: number;
  created_at: number;
  updated_at: number;
  user: {
    id: number;
    name: string;
  };
  comments: Comment[];
  is_liked: boolean;
}

export interface CommentResponse {
  comment: Comment;
}

export interface Comment {
  id: number;
  post_id: number;
  user_id: number;
  content: string;
  created_at: number;
  user: {
    id: number;
    name: string;
  };
}

export interface CreatePostRequest {
  content: string;
  image: string;
}

export interface CreateCommentRequest {
  post_id: number;
  content: string;
}

export interface LikePostRequest {
  post_id: number;
}

export interface PostsResponse {
  posts: Post[];
}
