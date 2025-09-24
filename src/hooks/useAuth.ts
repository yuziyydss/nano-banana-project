import { useState, useEffect, useCallback } from 'react';
import { authAPI } from '../services/api';
import { createLogger } from '../utils/logger';

const logger = createLogger('useAuth');

export interface User {
  id: string;
  email: string;
  username: string;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  isActive: boolean;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export const useAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  });

  // 初始化认证状态
  useEffect(() => {
    const initAuth = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        if (!token) {
          setAuthState(prev => ({ ...prev, isLoading: false }));
          return;
        }

        const response = await authAPI.getMe();
        setAuthState({
          user: response.user,
          token,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
      } catch (error) {
        logger.error('Failed to initialize auth:', error);
        localStorage.removeItem('auth_token');
        setAuthState({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
          error: 'Authentication failed',
        });
      }
    };

    initAuth();
  }, []);

  // 登录
  const login = useCallback(async (email: string, password: string) => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const response = await authAPI.login({ email, password });
      
      localStorage.setItem('auth_token', response.token);
      setAuthState({
        user: response.user,
        token: response.token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
      
      logger.info('User logged in successfully');
      return response;
    } catch (error: any) {
      logger.error('Login failed:', error);
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Login failed',
      }));
      throw error;
    }
  }, []);

  // 注册
  const register = useCallback(async (email: string, username: string, password: string) => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const response = await authAPI.register({ email, username, password });
      
      localStorage.setItem('auth_token', response.token);
      setAuthState({
        user: response.user,
        token: response.token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
      
      logger.info('User registered successfully');
      return response;
    } catch (error: any) {
      logger.error('Registration failed:', error);
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Registration failed',
      }));
      throw error;
    }
  }, []);

  // 登出
  const logout = useCallback(() => {
    localStorage.removeItem('auth_token');
    setAuthState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
    logger.info('User logged out');
  }, []);

  // 更新用户信息
  const updateUser = useCallback(async (data: { username?: string; avatar?: string }) => {
    try {
      if (!authState.user) throw new Error('User not authenticated');
      
      const response = await authAPI.updateMe(data);
      
      setAuthState(prev => ({
        ...prev,
        user: response.user,
        error: null,
      }));
      
      logger.info('User updated successfully');
      return response;
    } catch (error: any) {
      logger.error('Failed to update user:', error);
      setAuthState(prev => ({
        ...prev,
        error: error.message || 'Failed to update user',
      }));
      throw error;
    }
  }, [authState.user]);

  // 修改密码
  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    try {
      await authAPI.changePassword({ currentPassword, newPassword });
      logger.info('Password changed successfully');
    } catch (error: any) {
      logger.error('Failed to change password:', error);
      setAuthState(prev => ({
        ...prev,
        error: error.message || 'Failed to change password',
      }));
      throw error;
    }
  }, []);

  // 刷新 token
  const refreshToken = useCallback(async () => {
    try {
      const response = await authAPI.refreshToken();
      localStorage.setItem('auth_token', response.token);
      setAuthState(prev => ({
        ...prev,
        token: response.token,
      }));
      return response.token;
    } catch (error: any) {
      logger.error('Failed to refresh token:', error);
      logout();
      throw error;
    }
  }, [logout]);

  // 清除错误
  const clearError = useCallback(() => {
    setAuthState(prev => ({ ...prev, error: null }));
  }, []);

  return {
    ...authState,
    login,
    register,
    logout,
    updateUser,
    changePassword,
    refreshToken,
    clearError,
  };
};
