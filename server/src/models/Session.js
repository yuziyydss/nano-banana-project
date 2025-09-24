import redis from '../config/redis.js';
import { ulid } from 'ulid';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('session');

const SESSION_PREFIX = 'session';
const MESSAGE_PREFIX = 'message';
const USER_SESSIONS_PREFIX = 'user_sessions';

export class Session {
  constructor(data) {
    this.id = data.id || ulid();
    this.userId = data.userId;
    this.title = data.title || 'New Chat';
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    this.messageCount = data.messageCount || 0;
    this.deletedAt = data.deletedAt || null;
  }

  // 创建会话
  static async create(sessionData) {
    try {
      const session = new Session(sessionData);
      const sessionKey = `${SESSION_PREFIX}:${session.id}`;
      const messagesKey = `${SESSION_PREFIX}:${session.id}:messages`;

      // 使用事务保存会话数据
      const pipeline = redis.pipeline();
      pipeline.hset(sessionKey, {
        id: session.id,
        userId: session.userId,
        title: session.title,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        messageCount: session.messageCount.toString(),
        deletedAt: session.deletedAt || '',
      });
      
      // 添加到用户会话列表
      pipeline.zadd(`${USER_SESSIONS_PREFIX}:${session.userId}`, Date.now(), session.id);
      
      // 创建消息列表
      pipeline.lpush(messagesKey, 'placeholder');

      await pipeline.exec();

      logger.info(`Session created: ${session.id} for user: ${session.userId}`);
      return session;
    } catch (error) {
      logger.error('Failed to create session:', error);
      throw error;
    }
  }

  // 根据 ID 查找会话
  static async findById(sessionId) {
    try {
      const sessionKey = `${SESSION_PREFIX}:${sessionId}`;
      const sessionData = await redis.hgetall(sessionKey);

      if (!sessionData || !sessionData.id) {
        return null;
      }

      return new Session({
        ...sessionData,
        messageCount: parseInt(sessionData.messageCount) || 0,
      });
    } catch (error) {
      logger.error('Failed to find session by ID:', error);
      throw error;
    }
  }

  // 获取用户的所有会话
  static async findByUserId(userId, limit = 20, offset = 0) {
    try {
      const sessionsKey = `${USER_SESSIONS_PREFIX}:${userId}`;
      const sessionIds = await redis.zrevrange(sessionsKey, offset, offset + limit - 1);
      
      if (sessionIds.length === 0) {
        return [];
      }

      // 批量获取会话详情
      const pipeline = redis.pipeline();
      sessionIds.forEach(sessionId => {
        pipeline.hgetall(`${SESSION_PREFIX}:${sessionId}`);
      });

      const results = await pipeline.exec();
      const sessions = results
        .map(([err, data]) => {
          if (err || !data || !data.id) return null;
          return new Session({
            ...data,
            messageCount: parseInt(data.messageCount) || 0,
          });
        })
        .filter(Boolean);

      return sessions;
    } catch (error) {
      logger.error('Failed to find sessions by user ID:', error);
      throw error;
    }
  }

  // 更新会话
  async update(updateData) {
    try {
      const sessionKey = `${SESSION_PREFIX}:${this.id}`;
      const updates = {
        ...updateData,
        updatedAt: new Date().toISOString(),
      };

      await redis.hset(sessionKey, updates);
      
      // 更新实例属性
      Object.assign(this, updates);
      
      // 更新用户会话列表中的时间戳
      await redis.zadd(`${USER_SESSIONS_PREFIX}:${this.userId}`, Date.now(), this.id);
      
      logger.info(`Session updated: ${this.id}`);
      return this;
    } catch (error) {
      logger.error('Failed to update session:', error);
      throw error;
    }
  }

  // 软删除会话
  async delete() {
    try {
      const deletedAt = new Date().toISOString();
      await this.update({ deletedAt });
      
      logger.info(`Session soft deleted: ${this.id}`);
    } catch (error) {
      logger.error('Failed to delete session:', error);
      throw error;
    }
  }

  // 硬删除会话
  async hardDelete() {
    try {
      const sessionKey = `${SESSION_PREFIX}:${this.id}`;
      const messagesKey = `${SESSION_PREFIX}:${this.id}:messages`;
      const userSessionsKey = `${USER_SESSIONS_PREFIX}:${this.userId}`;

      // 获取所有消息 ID
      const messageIds = await redis.lrange(messagesKey, 0, -1);
      
      // 删除所有相关数据
      const pipeline = redis.pipeline();
      pipeline.del(sessionKey);
      pipeline.del(messagesKey);
      pipeline.zrem(userSessionsKey, this.id);
      
      // 删除所有消息
      messageIds.forEach(messageId => {
        if (messageId !== 'placeholder') {
          pipeline.del(`${MESSAGE_PREFIX}:${messageId}`);
        }
      });

      await pipeline.exec();
      
      logger.info(`Session hard deleted: ${this.id}`);
    } catch (error) {
      logger.error('Failed to hard delete session:', error);
      throw error;
    }
  }

  // 添加消息到会话
  async addMessage(messageId) {
    try {
      const messagesKey = `${SESSION_PREFIX}:${this.id}:messages`;
      const sessionKey = `${SESSION_PREFIX}:${this.id}`;

      const pipeline = redis.pipeline();
      pipeline.rpush(messagesKey, messageId);
      pipeline.hincrby(sessionKey, 'messageCount', 1);
      pipeline.hset(sessionKey, 'updatedAt', new Date().toISOString());
      pipeline.zadd(`${USER_SESSIONS_PREFIX}:${this.userId}`, Date.now(), this.id);

      await pipeline.exec();
      
      this.messageCount += 1;
      this.updatedAt = new Date().toISOString();
      
      logger.info(`Message added to session: ${this.id}, message: ${messageId}`);
    } catch (error) {
      logger.error('Failed to add message to session:', error);
      throw error;
    }
  }

  // 从会话移除消息
  async removeMessage(messageId) {
    try {
      const messagesKey = `${SESSION_PREFIX}:${this.id}:messages`;
      const sessionKey = `${SESSION_PREFIX}:${this.id}`;

      const pipeline = redis.pipeline();
      pipeline.lrem(messagesKey, 1, messageId);
      pipeline.hincrby(sessionKey, 'messageCount', -1);
      pipeline.hset(sessionKey, 'updatedAt', new Date().toISOString());
      pipeline.zadd(`${USER_SESSIONS_PREFIX}:${this.userId}`, Date.now(), this.id);

      await pipeline.exec();
      
      this.messageCount = Math.max(0, this.messageCount - 1);
      this.updatedAt = new Date().toISOString();
      
      logger.info(`Message removed from session: ${this.id}, message: ${messageId}`);
    } catch (error) {
      logger.error('Failed to remove message from session:', error);
      throw error;
    }
  }

  // 获取会话消息
  async getMessages(limit = 50, offset = 0) {
    try {
      const messagesKey = `${SESSION_PREFIX}:${this.id}:messages`;
      const messageIds = await redis.lrange(messagesKey, offset, offset + limit - 1);
      
      if (messageIds.length === 0) {
        return [];
      }

      // 过滤掉占位符
      const validMessageIds = messageIds.filter(id => id !== 'placeholder');
      
      if (validMessageIds.length === 0) {
        return [];
      }

      // 批量获取消息详情
      const pipeline = redis.pipeline();
      validMessageIds.forEach(messageId => {
        pipeline.hgetall(`${MESSAGE_PREFIX}:${messageId}`);
      });

      const results = await pipeline.exec();
      const messages = results
        .map(([err, data]) => {
          if (err || !data || !data.id) return null;
          return {
            ...data,
            imageIds: data.imageIds ? JSON.parse(data.imageIds) : [],
            params: data.params ? JSON.parse(data.params) : {},
          };
        })
        .filter(Boolean);

      return messages;
    } catch (error) {
      logger.error('Failed to get session messages:', error);
      throw error;
    }
  }

  // 获取会话统计信息
  async getStats() {
    try {
      const messagesKey = `${SESSION_PREFIX}:${this.id}:messages`;
      const totalMessages = await redis.llen(messagesKey);
      
      return {
        messageCount: this.messageCount,
        totalMessages,
        createdAt: this.createdAt,
        updatedAt: this.updatedAt,
      };
    } catch (error) {
      logger.error('Failed to get session stats:', error);
      throw error;
    }
  }

  // 转换为 JSON
  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      title: this.title,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      messageCount: this.messageCount,
      deletedAt: this.deletedAt,
    };
  }
}
