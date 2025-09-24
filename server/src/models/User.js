import redis from '../config/redis.js';
import { hashPassword, comparePassword } from '../utils/auth.js';
import { ulid } from 'ulid';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('user');

const USER_PREFIX = 'user';
const USER_SESSIONS_PREFIX = 'user_sessions';

export class User {
  constructor(data) {
    this.id = data.id || ulid();
    this.email = data.email;
    this.username = data.username;
    this.password = data.password;
    this.avatar = data.avatar || null;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    this.lastLoginAt = data.lastLoginAt || null;
    this.isActive = data.isActive !== false;
  }

  // 创建用户
  static async create(userData) {
    try {
      const user = new User({
        ...userData,
        password: await hashPassword(userData.password),
      });

      const userKey = `${USER_PREFIX}:${user.id}`;
      const emailKey = `email:${user.email}`;

      // 检查邮箱是否已存在
      const existingUser = await redis.get(emailKey);
      if (existingUser) {
        throw new Error('Email already exists');
      }

      // 使用事务保存用户数据
      const pipeline = redis.pipeline();
      pipeline.hset(userKey, {
        id: user.id,
        email: user.email,
        username: user.username,
        password: user.password,
        avatar: user.avatar || '',
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastLoginAt: user.lastLoginAt || '',
        isActive: user.isActive.toString(),
      });
      pipeline.set(emailKey, user.id);
      pipeline.sadd('users', user.id);

      await pipeline.exec();

      logger.info(`User created: ${user.id}`);
      return user;
    } catch (error) {
      logger.error('Failed to create user:', error);
      throw error;
    }
  }

  // 根据 ID 查找用户
  static async findById(userId) {
    try {
      const userKey = `${USER_PREFIX}:${userId}`;
      const userData = await redis.hgetall(userKey);

      if (!userData || !userData.id) {
        return null;
      }

      return new User({
        ...userData,
        isActive: userData.isActive === 'true',
      });
    } catch (error) {
      logger.error('Failed to find user by ID:', error);
      throw error;
    }
  }

  // 根据邮箱查找用户
  static async findByEmail(email) {
    try {
      const emailKey = `email:${email}`;
      const userId = await redis.get(emailKey);

      if (!userId) {
        return null;
      }

      return await User.findById(userId);
    } catch (error) {
      logger.error('Failed to find user by email:', error);
      throw error;
    }
  }

  // 验证密码
  async validatePassword(password) {
    try {
      return await comparePassword(password, this.password);
    } catch (error) {
      logger.error('Password validation failed:', error);
      throw error;
    }
  }

  // 更新用户信息
  async update(updateData) {
    try {
      const userKey = `${USER_PREFIX}:${this.id}`;
      const updates = {
        ...updateData,
        updatedAt: new Date().toISOString(),
      };

      // 如果更新密码，需要加密
      if (updates.password) {
        updates.password = await hashPassword(updates.password);
      }

      await redis.hset(userKey, updates);
      
      // 更新实例属性
      Object.assign(this, updates);
      
      logger.info(`User updated: ${this.id}`);
      return this;
    } catch (error) {
      logger.error('Failed to update user:', error);
      throw error;
    }
  }

  // 更新最后登录时间
  async updateLastLogin() {
    try {
      const userKey = `${USER_PREFIX}:${this.id}`;
      const lastLoginAt = new Date().toISOString();
      
      await redis.hset(userKey, 'lastLoginAt', lastLoginAt);
      this.lastLoginAt = lastLoginAt;
      
      logger.info(`Last login updated for user: ${this.id}`);
    } catch (error) {
      logger.error('Failed to update last login:', error);
      throw error;
    }
  }

  // 获取用户会话列表
  async getSessions(limit = 20, offset = 0) {
    try {
      const sessionsKey = `${USER_SESSIONS_PREFIX}:${this.id}`;
      const sessionIds = await redis.zrevrange(sessionsKey, offset, offset + limit - 1);
      
      return sessionIds;
    } catch (error) {
      logger.error('Failed to get user sessions:', error);
      throw error;
    }
  }

  // 添加会话到用户
  async addSession(sessionId, score = Date.now()) {
    try {
      const sessionsKey = `${USER_SESSIONS_PREFIX}:${this.id}`;
      await redis.zadd(sessionsKey, score, sessionId);
      
      logger.info(`Session added to user: ${this.id}, session: ${sessionId}`);
    } catch (error) {
      logger.error('Failed to add session to user:', error);
      throw error;
    }
  }

  // 从用户移除会话
  async removeSession(sessionId) {
    try {
      const sessionsKey = `${USER_SESSIONS_PREFIX}:${this.id}`;
      await redis.zrem(sessionsKey, sessionId);
      
      logger.info(`Session removed from user: ${this.id}, session: ${sessionId}`);
    } catch (error) {
      logger.error('Failed to remove session from user:', error);
      throw error;
    }
  }

  // 删除用户
  async delete() {
    try {
      const userKey = `${USER_PREFIX}:${this.id}`;
      const emailKey = `email:${this.email}`;
      const sessionsKey = `${USER_SESSIONS_PREFIX}:${this.id}`;

      const pipeline = redis.pipeline();
      pipeline.del(userKey);
      pipeline.del(emailKey);
      pipeline.del(sessionsKey);
      pipeline.srem('users', this.id);

      await pipeline.exec();
      
      logger.info(`User deleted: ${this.id}`);
    } catch (error) {
      logger.error('Failed to delete user:', error);
      throw error;
    }
  }

  // 获取用户统计信息
  async getStats() {
    try {
      const sessionsKey = `${USER_SESSIONS_PREFIX}:${this.id}`;
      const sessionCount = await redis.zcard(sessionsKey);
      
      return {
        sessionCount,
        createdAt: this.createdAt,
        lastLoginAt: this.lastLoginAt,
      };
    } catch (error) {
      logger.error('Failed to get user stats:', error);
      throw error;
    }
  }

  // 转换为 JSON（不包含敏感信息）
  toJSON() {
    const { password, ...safeData } = this;
    return safeData;
  }
}
