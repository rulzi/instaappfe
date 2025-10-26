import { API_CONFIG, ApiResponse, LoginRequest, RegisterRequest, AuthResponse, UserResponse, Post, Comment, CreatePostRequest, CreateCommentRequest, PostsResponse } from '@/config/api';

class ApiClient {
  private baseURL: string;
  private timeout: number;

  constructor() {
    this.baseURL = API_CONFIG.BASE_URL;
    this.timeout = API_CONFIG.TIMEOUT;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    // Add authorization header if token exists
    const token = this.getToken();
    if (token) {
      config.headers = {
        ...config.headers,
        'Authorization': `Bearer ${token}`,
      };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        ...config,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          message: data.message || 'An error occurred',
          errors: data.errors,
        };
      }

      return {
        success: true,
        data: data.data || data,
        message: data.message,
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          return {
            success: false,
            message: 'Request timeout. Please try again.',
          };
        }
        return {
          success: false,
          message: error.message || 'Network error occurred',
        };
      }
      return {
        success: false,
        message: 'An unexpected error occurred',
      };
    }
  }

  // Auth methods based on API docs
  async login(credentials: LoginRequest): Promise<ApiResponse<AuthResponse>> {
    return this.request<AuthResponse>(API_CONFIG.ENDPOINTS.LOGIN, {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  }

  async register(userData: RegisterRequest): Promise<ApiResponse<AuthResponse>> {
    return this.request<AuthResponse>(API_CONFIG.ENDPOINTS.REGISTER, {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async logout(): Promise<ApiResponse> {
    const response = await this.request(API_CONFIG.ENDPOINTS.LOGOUT, {
      method: 'POST',
    });
    
    if (response.success) {
      this.removeToken();
    }
    
    return response;
  }

  // Token management
  setToken(token: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_token', token);
      // Also set cookie for middleware access
      document.cookie = `auth_token=${token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
    }
  }

  getToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('auth_token');
    }
    return null;
  }

  removeToken(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
      // Also remove cookie
      document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    }
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  // User methods
  async getProfile(): Promise<ApiResponse<UserResponse>> {
    return this.request<UserResponse>(API_CONFIG.ENDPOINTS.PROFILE);
  }

  // Posts methods
  async getPosts(): Promise<ApiResponse<PostsResponse>> {
    return this.request<PostsResponse>(API_CONFIG.ENDPOINTS.POSTS);
  }

  async createPost(postData: CreatePostRequest): Promise<ApiResponse<Post>> {
    return this.request<Post>(API_CONFIG.ENDPOINTS.POSTS, {
      method: 'POST',
      body: JSON.stringify(postData),
    });
  }

  async createPostWithFile(formData: FormData): Promise<ApiResponse<Post>> {
    const url = `${this.baseURL}${API_CONFIG.ENDPOINTS.POSTS}`;
    
    const config: RequestInit = {
      method: 'POST',
      body: formData,
      headers: {
        'Accept': 'application/json',
      },
    };

    // Add authorization header if token exists
    const token = this.getToken();
    if (token) {
      config.headers = {
        ...config.headers,
        'Authorization': `Bearer ${token}`,
      };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        ...config,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          message: data.message || 'An error occurred',
          errors: data.errors,
        };
      }

      return {
        success: true,
        data: data.data || data,
        message: data.message,
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          return {
            success: false,
            message: 'Request timeout. Please try again.',
          };
        }
        return {
          success: false,
          message: error.message || 'Network error occurred',
        };
      }
      return {
        success: false,
        message: 'An unexpected error occurred',
      };
    }
  }

  async likePost(postId: number): Promise<ApiResponse<{ is_liked: boolean; likes_count: number }>> {
    return this.request<{ is_liked: boolean; likes_count: number }>(`${API_CONFIG.ENDPOINTS.POSTS}/${postId}/like`, {
      method: 'POST',
    });
  }

  async unlikePost(postId: number): Promise<ApiResponse<{ is_liked: boolean; likes_count: number }>> {
    return this.request<{ is_liked: boolean; likes_count: number }>(`${API_CONFIG.ENDPOINTS.POSTS}/${postId}/like`, {
      method: 'DELETE',
    });
  }

  async createComment(commentData: CreateCommentRequest): Promise<ApiResponse<Comment>> {
    return this.request<Comment>(`${API_CONFIG.ENDPOINTS.POSTS}/${commentData.post_id}/comment`, {
      method: 'POST',
      body: JSON.stringify({ content: commentData.content }),
    });
  }

  async getPostComments(postId: number): Promise<ApiResponse<Comment[]>> {
    return this.request<Comment[]>(`${API_CONFIG.ENDPOINTS.POSTS}/${postId}/comment`);
  }
}

// Create and export a singleton instance
export const apiClient = new ApiClient();
export default apiClient;
