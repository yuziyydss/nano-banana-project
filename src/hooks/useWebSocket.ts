import { useState, useEffect, useCallback, useRef } from 'react';
import { WebSocketManager } from '../services/api';
import { createLogger } from '../utils/logger';

const logger = createLogger('useWebSocket');

export interface WebSocketMessage {
  type: string;
  payload?: any;
  timestamp?: string;
}

export interface UseWebSocketReturn {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  connect: (sessionId: string, userId: string, token: string) => void;
  disconnect: () => void;
  sendMessage: (type: string, payload?: any) => void;
  joinSession: (sessionId: string) => void;
  leaveSession: (sessionId: string) => void;
  sendTyping: (sessionId: string, isTyping: boolean) => void;
  onMessage: (callback: (message: WebSocketMessage) => void) => void;
  offMessage: (callback: (message: WebSocketMessage) => void) => void;
  clearError: () => void;
}

export const useWebSocket = (): UseWebSocketReturn => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsManagerRef = useRef<WebSocketManager | null>(null);
  const messageCallbacksRef = useRef<Set<(message: WebSocketMessage) => void>>(new Set());

  // 连接 WebSocket
  const connect = useCallback((sessionId: string, userId: string, token: string) => {
    try {
      setIsConnecting(true);
      setError(null);

      // 断开现有连接
      if (wsManagerRef.current) {
        wsManagerRef.current.disconnect();
      }

      // 创建新连接
      const wsManager = new WebSocketManager(userId, token);
      wsManagerRef.current = wsManager;

      // 设置事件监听器
      wsManager.on('connected', () => {
        setIsConnected(true);
        setIsConnecting(false);
        logger.info('WebSocket connected');
      });

      wsManager.on('disconnected', (data: any) => {
        setIsConnected(false);
        setIsConnecting(false);
        logger.info('WebSocket disconnected:', data);
      });

      wsManager.on('error', (err: any) => {
        setIsConnected(false);
        setIsConnecting(false);
        setError('WebSocket connection error');
        logger.error('WebSocket error:', err);
      });

      wsManager.on('message', (message: WebSocketMessage) => {
        // 通知所有注册的回调
        messageCallbacksRef.current.forEach(callback => {
          try {
            callback(message);
          } catch (error) {
            logger.error('Error in message callback:', error);
          }
        });
      });

      // 连接到会话
      wsManager.connectToSession(sessionId);
    } catch (error: any) {
      logger.error('Failed to connect WebSocket:', error);
      setError(error.message || 'Failed to connect WebSocket');
      setIsConnecting(false);
    }
  }, []);

  // 断开连接
  const disconnect = useCallback(() => {
    if (wsManagerRef.current) {
      wsManagerRef.current.disconnect();
      wsManagerRef.current = null;
    }
    setIsConnected(false);
    setIsConnecting(false);
    logger.info('WebSocket disconnected');
  }, []);

  // 发送消息
  const sendMessage = useCallback((type: string, payload?: any) => {
    if (wsManagerRef.current) {
      wsManagerRef.current.send(type, payload);
    } else {
      logger.warn('WebSocket not connected, cannot send message');
    }
  }, []);

  // 加入会话
  const joinSession = useCallback((sessionId: string) => {
    if (wsManagerRef.current) {
      wsManagerRef.current.joinSession(sessionId);
    }
  }, []);

  // 离开会话
  const leaveSession = useCallback((sessionId: string) => {
    if (wsManagerRef.current) {
      wsManagerRef.current.leaveSession(sessionId);
    }
  }, []);

  // 发送打字状态
  const sendTyping = useCallback((sessionId: string, isTyping: boolean) => {
    if (wsManagerRef.current) {
      wsManagerRef.current.sendTyping(sessionId, isTyping);
    }
  }, []);

  // 添加消息监听器
  const onMessage = useCallback((callback: (message: WebSocketMessage) => void) => {
    messageCallbacksRef.current.add(callback);
  }, []);

  // 移除消息监听器
  const offMessage = useCallback((callback: (message: WebSocketMessage) => void) => {
    messageCallbacksRef.current.delete(callback);
  }, []);

  // 清除错误
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // 组件卸载时断开连接
  useEffect(() => {
    return () => {
      if (wsManagerRef.current) {
        wsManagerRef.current.disconnect();
      }
    };
  }, []);

  return {
    isConnected,
    isConnecting,
    error,
    connect,
    disconnect,
    sendMessage,
    joinSession,
    leaveSession,
    sendTyping,
    onMessage,
    offMessage,
    clearError,
  };
};
