// API Configuration based on http://instaapp.test/docs?api-docs.json
export const API_CONFIG = {
  BASE_URL: process.env.NEXT_PUBLIC_API_URL || 'http://instaapp.test/api',
  ENDPOINTS: {
    LOGIN: '/login',
    REGISTER: '/register',
    LOGOUT: '/logout',
    PROFILE: '/me',
    POSTS: '/posts',
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
