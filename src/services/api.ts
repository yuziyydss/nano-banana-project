import { createLogger } from '../utils/logger';

const logger = createLogger('api');

// API 基础配置
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:3001/ws';

// 请求拦截器
const request = async (url: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('auth_token');
  
  const config: RequestInit = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  };

  try {
    const response = await fetch(`${API_BASE_URL}${url}`, config);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    logger.error('API request failed:', error);
    throw error;
  }
};

// 文件上传请求
const uploadRequest = async (url: string, formData: FormData) => {
  const token = localStorage.getItem('auth_token');
  
  const response = await fetch(`${API_BASE_URL}${url}`, {
    method: 'POST',
    headers: {
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: formData,
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP ${response.status}`);
  }
  
  return await response.json();
};

// 认证相关 API
export const authAPI = {
  // 用户注册
  register: async (data: { email: string; username: string; password: string }) => {
    return request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // 用户登录
  login: async (data: { email: string; password: string }) => {
    return request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // 获取用户信息
  getMe: async () => {
    return request('/auth/me');
  },

  // 更新用户信息
  updateMe: async (data: { username?: string; avatar?: string }) => {
    return request('/auth/me', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // 修改密码
  changePassword: async (data: { currentPassword: string; newPassword: string }) => {
    return request('/auth/password', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // 刷新 token
  refreshToken: async () => {
    return request('/auth/refresh', {
      method: 'POST',
    });
  },
};

// 会话相关 API
export const sessionAPI = {
  // 获取会话列表
  getSessions: async (params: { limit?: number; offset?: number } = {}) => {
    const searchParams = new URLSearchParams();
    if (params.limit) searchParams.set('limit', params.limit.toString());
    if (params.offset) searchParams.set('offset', params.offset.toString());
    
    return request(`/sessions?${searchParams.toString()}`);
  },

  // 创建会话
  createSession: async (data: { title?: string } = {}) => {
    return request('/sessions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // 获取会话详情
  getSession: async (sessionId: string) => {
    return request(`/sessions/${sessionId}`);
  },

  // 更新会话
  updateSession: async (sessionId: string, data: { title: string }) => {
    return request(`/sessions/${sessionId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // 删除会话
  deleteSession: async (sessionId: string) => {
    return request(`/sessions/${sessionId}`, {
      method: 'DELETE',
    });
  },

  // 获取会话消息
  getMessages: async (sessionId: string, params: { limit?: number; offset?: number } = {}) => {
    const searchParams = new URLSearchParams();
    if (params.limit) searchParams.set('limit', params.limit.toString());
    if (params.offset) searchParams.set('offset', params.offset.toString());
    
    return request(`/sessions/${sessionId}/messages?${searchParams.toString()}`);
  },

  // 创建消息
  createMessage: async (sessionId: string, data: {
    role: 'user' | 'assistant';
    text: string;
    params?: any;
    imageIds?: string[];
  }) => {
    return request(`/sessions/${sessionId}/messages`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // 获取会话统计
  getSessionStats: async (sessionId: string) => {
    return request(`/sessions/${sessionId}/stats`);
  },
};

// 消息相关 API
export const messageAPI = {
  // 获取消息详情
  getMessage: async (messageId: string) => {
    return request(`/messages/${messageId}`);
  },

  // 更新消息
  updateMessage: async (messageId: string, data: {
    text?: string;
    params?: any;
    imageIds?: string[];
  }) => {
    return request(`/messages/${messageId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // 删除消息
  deleteMessage: async (messageId: string) => {
    return request(`/messages/${messageId}`, {
      method: 'DELETE',
    });
  },

  // 添加图片到消息
  addImageToMessage: async (messageId: string, imageId: string) => {
    return request(`/messages/${messageId}/images`, {
      method: 'POST',
      body: JSON.stringify({ imageId }),
    });
  },

  // 从消息移除图片
  removeImageFromMessage: async (messageId: string, imageId: string) => {
    return request(`/messages/${messageId}/images/${imageId}`, {
      method: 'DELETE',
    });
  },

  // 获取消息图片
  getMessageImages: async (messageId: string) => {
    return request(`/messages/${messageId}/images`);
  },
};

// 图片相关 API
export const imageAPI = {
  // 上传单张图片
  uploadImage: async (file: File, sessionId: string, type: 'uploaded' | 'generated' = 'uploaded') => {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('sessionId', sessionId);
    formData.append('type', type);
    
    return uploadRequest('/images/upload', formData);
  },

  // 批量上传图片
  uploadImages: async (files: File[], sessionId: string, type: 'uploaded' | 'generated' = 'uploaded') => {
    const formData = new FormData();
    files.forEach(file => formData.append('images', file));
    formData.append('sessionId', sessionId);
    formData.append('type', type);
    
    return uploadRequest('/images/upload/batch', formData);
  },

  // 获取图片信息
  getImage: async (imageId: string) => {
    return request(`/images/${imageId}`);
  },

  // 获取会话图片
  getSessionImages: async (sessionId: string, params: {
    type?: 'uploaded' | 'generated';
    limit?: number;
    offset?: number;
  } = {}) => {
    const searchParams = new URLSearchParams();
    if (params.type) searchParams.set('type', params.type);
    if (params.limit) searchParams.set('limit', params.limit.toString());
    if (params.offset) searchParams.set('offset', params.offset.toString());
    
    return request(`/images/session/${sessionId}?${searchParams.toString()}`);
  },

  // 获取用户所有图片
  getUserImages: async (params: {
    type?: 'uploaded' | 'generated';
    limit?: number;
    offset?: number;
  } = {}) => {
    const searchParams = new URLSearchParams();
    if (params.type) searchParams.set('type', params.type);
    if (params.limit) searchParams.set('limit', params.limit.toString());
    if (params.offset) searchParams.set('offset', params.offset.toString());
    
    return request(`/images/user/all?${searchParams.toString()}`);
  },

  // 删除图片
  deleteImage: async (imageId: string) => {
    return request(`/images/${imageId}`, {
      method: 'DELETE',
    });
  },

  // 清理未引用图片
  cleanupImages: async () => {
    return request('/images/cleanup', {
      method: 'POST',
    });
  },
};

// WebSocket 连接管理
export class WebSocketManager {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private listeners: Map<string, Function[]> = new Map();

  constructor(private userId: string, private token: string) {}

  // 连接到会话
  connectToSession(sessionId: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close();
    }

    const wsUrl = `${WS_BASE_URL}/${sessionId}?userId=${this.userId}&token=${this.token}`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      logger.info('WebSocket connected');
      this.reconnectAttempts = 0;
      this.emit('connected', { sessionId, userId: this.userId });
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.emit('message', data);
      } catch (error) {
        logger.error('Failed to parse WebSocket message:', error);
      }
    };

    this.ws.onclose = (event) => {
      logger.info('WebSocket disconnected:', event.code, event.reason);
      this.emit('disconnected', { code: event.code, reason: event.reason });
      
      // 自动重连
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        setTimeout(() => {
          this.reconnectAttempts++;
          this.connectToSession(sessionId);
        }, this.reconnectDelay * this.reconnectAttempts);
      }
    };

    this.ws.onerror = (error) => {
      logger.error('WebSocket error:', error);
      this.emit('error', error);
    };
  }

  // 发送消息
  send(type: string, payload?: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }));
    } else {
      logger.warn('WebSocket not connected, cannot send message');
    }
  }

  // 加入会话
  joinSession(sessionId: string) {
    this.send('join_session', { sessionId });
  }

  // 离开会话
  leaveSession(sessionId: string) {
    this.send('leave_session', { sessionId });
  }

  // 发送打字状态
  sendTyping(sessionId: string, isTyping: boolean) {
    this.send('typing', { sessionId, isTyping });
  }

  // 添加事件监听器
  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  // 移除事件监听器
  off(event: string, callback: Function) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  // 触发事件
  private emit(event: string, data: any) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }

  // 关闭连接
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

// 导出所有 API
export const api = {
  auth: authAPI,
  sessions: sessionAPI,
  messages: messageAPI,
  images: imageAPI,
  WebSocketManager,
};

export default api;

export const GPT_IMAGE1_API_BASE_URL = `${API_BASE_URL}/gpt-image-1`;
