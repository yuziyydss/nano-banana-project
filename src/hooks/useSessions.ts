import { useState, useEffect, useCallback } from 'react';
import { sessionAPI } from '../services/api';
import { createLogger } from '../utils/logger';

const logger = createLogger('useSessions');

export interface Session {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  deletedAt?: string;
}

export interface Message {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  text: string;
  params: any;
  imageIds: string[];
  createdAt: string;
  updatedAt: string;
  editedOf?: string;
  images?: any[];
}

export interface UseSessionsReturn {
  sessions: Session[];
  currentSession: Session | null;
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  createSession: (title?: string) => Promise<Session>;
  updateSession: (sessionId: string, title: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  switchToSession: (sessionId: string) => Promise<void>;
  loadSessions: () => Promise<void>;
  loadMessages: (sessionId: string) => Promise<void>;
  createMessage: (sessionId: string, message: Omit<Message, 'id' | 'sessionId' | 'createdAt' | 'updatedAt'>) => Promise<Message>;
  updateMessage: (messageId: string, updates: Partial<Message>) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  clearError: () => void;
}

export const useSessions = (): UseSessionsReturn => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 加载会话列表
  const loadSessions = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await sessionAPI.getSessions({ limit: 100 });
      setSessions(response.sessions);
      
      logger.info(`Loaded ${response.sessions.length} sessions`);
    } catch (error: any) {
      logger.error('Failed to load sessions:', error);
      setError(error.message || 'Failed to load sessions');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 加载会话消息
  const loadMessages = useCallback(async (sessionId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await sessionAPI.getMessages(sessionId, { limit: 100 });
      setMessages(response.messages);
      
      logger.info(`Loaded ${response.messages.length} messages for session ${sessionId}`);
    } catch (error: any) {
      logger.error('Failed to load messages:', error);
      setError(error.message || 'Failed to load messages');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 创建会话
  const createSession = useCallback(async (title?: string): Promise<Session> => {
    try {
      setError(null);
      
      const response = await sessionAPI.createSession({ title });
      const newSession = response.session;
      
      setSessions(prev => [newSession, ...prev]);
      setCurrentSession(newSession);
      setMessages([]);
      
      logger.info(`Created session: ${newSession.id}`);
      return newSession;
    } catch (error: any) {
      logger.error('Failed to create session:', error);
      setError(error.message || 'Failed to create session');
      throw error;
    }
  }, []);

  // 更新会话
  const updateSession = useCallback(async (sessionId: string, title: string) => {
    try {
      setError(null);
      
      await sessionAPI.updateSession(sessionId, { title });
      
      setSessions(prev => 
        prev.map(session => 
          session.id === sessionId 
            ? { ...session, title, updatedAt: new Date().toISOString() }
            : session
        )
      );
      
      if (currentSession?.id === sessionId) {
        setCurrentSession(prev => prev ? { ...prev, title, updatedAt: new Date().toISOString() } : null);
      }
      
      logger.info(`Updated session: ${sessionId}`);
    } catch (error: any) {
      logger.error('Failed to update session:', error);
      setError(error.message || 'Failed to update session');
      throw error;
    }
  }, [currentSession]);

  // 删除会话
  const deleteSession = useCallback(async (sessionId: string) => {
    try {
      setError(null);
      
      await sessionAPI.deleteSession(sessionId);
      
      setSessions(prev => prev.filter(session => session.id !== sessionId));
      
      if (currentSession?.id === sessionId) {
        setCurrentSession(null);
        setMessages([]);
      }
      
      logger.info(`Deleted session: ${sessionId}`);
    } catch (error: any) {
      logger.error('Failed to delete session:', error);
      setError(error.message || 'Failed to delete session');
      throw error;
    }
  }, [currentSession]);

  // 切换到会话
  const switchToSession = useCallback(async (sessionId: string) => {
    try {
      setError(null);
      
      const session = sessions.find(s => s.id === sessionId);
      if (!session) {
        throw new Error('Session not found');
      }
      
      setCurrentSession(session);
      await loadMessages(sessionId);
      
      logger.info(`Switched to session: ${sessionId}`);
    } catch (error: any) {
      logger.error('Failed to switch to session:', error);
      setError(error.message || 'Failed to switch to session');
      throw error;
    }
  }, [sessions, loadMessages]);

  // 创建消息
  const createMessage = useCallback(async (
    sessionId: string, 
    message: Omit<Message, 'id' | 'sessionId' | 'createdAt' | 'updatedAt'>
  ): Promise<Message> => {
    try {
      setError(null);
      
      const response = await sessionAPI.createMessage(sessionId, message);
      const newMessage = response.messageData;
      
      setMessages(prev => [...prev, newMessage]);
      
      // 更新会话的消息计数
      setSessions(prev => 
        prev.map(session => 
          session.id === sessionId 
            ? { ...session, messageCount: session.messageCount + 1, updatedAt: new Date().toISOString() }
            : session
        )
      );
      
      if (currentSession?.id === sessionId) {
        setCurrentSession(prev => 
          prev ? { 
            ...prev, 
            messageCount: prev.messageCount + 1, 
            updatedAt: new Date().toISOString() 
          } : null
        );
      }
      
      logger.info(`Created message: ${newMessage.id}`);
      return newMessage;
    } catch (error: any) {
      logger.error('Failed to create message:', error);
      setError(error.message || 'Failed to create message');
      throw error;
    }
  }, [currentSession]);

  // 更新消息
  const updateMessage = useCallback(async (messageId: string, updates: Partial<Message>) => {
    try {
      setError(null);
      
      await sessionAPI.updateMessage(messageId, updates);
      
      setMessages(prev => 
        prev.map(message => 
          message.id === messageId 
            ? { ...message, ...updates, updatedAt: new Date().toISOString() }
            : message
        )
      );
      
      logger.info(`Updated message: ${messageId}`);
    } catch (error: any) {
      logger.error('Failed to update message:', error);
      setError(error.message || 'Failed to update message');
      throw error;
    }
  }, []);

  // 删除消息
  const deleteMessage = useCallback(async (messageId: string) => {
    try {
      setError(null);
      
      await sessionAPI.deleteMessage(messageId);
      
      const message = messages.find(m => m.id === messageId);
      if (message) {
        setMessages(prev => prev.filter(m => m.id !== messageId));
        
        // 更新会话的消息计数
        setSessions(prev => 
          prev.map(session => 
            session.id === message.sessionId 
              ? { ...session, messageCount: Math.max(0, session.messageCount - 1), updatedAt: new Date().toISOString() }
              : session
          )
        );
        
        if (currentSession?.id === message.sessionId) {
          setCurrentSession(prev => 
            prev ? { 
              ...prev, 
              messageCount: Math.max(0, prev.messageCount - 1), 
              updatedAt: new Date().toISOString() 
            } : null
          );
        }
      }
      
      logger.info(`Deleted message: ${messageId}`);
    } catch (error: any) {
      logger.error('Failed to delete message:', error);
      setError(error.message || 'Failed to delete message');
      throw error;
    }
  }, [messages, currentSession]);

  // 清除错误
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // 初始化时加载会话列表
  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  return {
    sessions,
    currentSession,
    messages,
    isLoading,
    error,
    createSession,
    updateSession,
    deleteSession,
    switchToSession,
    loadSessions,
    loadMessages,
    createMessage,
    updateMessage,
    deleteMessage,
    clearError,
  };
};
