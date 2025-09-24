import redis from '../config/redis.js';
import { ulid } from 'ulid';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('message');

const MESSAGE_PREFIX = 'message';

export class Message {
  constructor(data) {
    this.id = data.id || ulid();
    this.sessionId = data.sessionId;
    this.role = data.role; // 'user' or 'assistant'
    this.text = data.text || '';
    this.params = data.params || {};
    this.imageIds = data.imageIds || [];
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    this.editedOf = data.editedOf || null; // 如果是编辑的消息，指向原消息ID
  }

  // 创建消息
  static async create(messageData) {
    try {
      const message = new Message(messageData);
      const messageKey = `${MESSAGE_PREFIX}:${message.id}`;

      await redis.hset(messageKey, {
        id: message.id,
        sessionId: message.sessionId,
        role: message.role,
        text: message.text,
        params: JSON.stringify(message.params),
        imageIds: JSON.stringify(message.imageIds),
        createdAt: message.createdAt,
        updatedAt: message.updatedAt,
        editedOf: message.editedOf || '',
      });

      logger.info(`Message created: ${message.id} in session: ${message.sessionId}`);
      return message;
    } catch (error) {
      logger.error('Failed to create message:', error);
      throw error;
    }
  }

  // 根据 ID 查找消息
  static async findById(messageId) {
    try {
      const messageKey = `${MESSAGE_PREFIX}:${messageId}`;
      const messageData = await redis.hgetall(messageKey);

      if (!messageData || !messageData.id) {
        return null;
      }

      return new Message({
        ...messageData,
        params: messageData.params ? JSON.parse(messageData.params) : {},
        imageIds: messageData.imageIds ? JSON.parse(messageData.imageIds) : [],
      });
    } catch (error) {
      logger.error('Failed to find message by ID:', error);
      throw error;
    }
  }

  // 更新消息
  async update(updateData) {
    try {
      const messageKey = `${MESSAGE_PREFIX}:${this.id}`;
      const updates = {
        ...updateData,
        updatedAt: new Date().toISOString(),
      };

      // 序列化复杂字段
      if (updates.params) {
        updates.params = JSON.stringify(updates.params);
      }
      if (updates.imageIds) {
        updates.imageIds = JSON.stringify(updates.imageIds);
      }

      await redis.hset(messageKey, updates);
      
      // 更新实例属性
      Object.assign(this, updates);
      
      logger.info(`Message updated: ${this.id}`);
      return this;
    } catch (error) {
      logger.error('Failed to update message:', error);
      throw error;
    }
  }

  // 删除消息
  async delete() {
    try {
      const messageKey = `${MESSAGE_PREFIX}:${this.id}`;
      await redis.del(messageKey);
      
      logger.info(`Message deleted: ${this.id}`);
    } catch (error) {
      logger.error('Failed to delete message:', error);
      throw error;
    }
  }

  // 添加图片到消息
  async addImage(imageId) {
    try {
      if (!this.imageIds.includes(imageId)) {
        this.imageIds.push(imageId);
        await this.update({ imageIds: this.imageIds });
        
        logger.info(`Image added to message: ${this.id}, image: ${imageId}`);
      }
    } catch (error) {
      logger.error('Failed to add image to message:', error);
      throw error;
    }
  }

  // 从消息移除图片
  async removeImage(imageId) {
    try {
      const index = this.imageIds.indexOf(imageId);
      if (index > -1) {
        this.imageIds.splice(index, 1);
        await this.update({ imageIds: this.imageIds });
        
        logger.info(`Image removed from message: ${this.id}, image: ${imageId}`);
      }
    } catch (error) {
      logger.error('Failed to remove image from message:', error);
      throw error;
    }
  }

  // 获取消息的图片
  async getImages() {
    try {
      if (this.imageIds.length === 0) {
        return [];
      }

      const pipeline = redis.pipeline();
      this.imageIds.forEach(imageId => {
        pipeline.hgetall(`image:${imageId}:meta`);
      });

      const results = await pipeline.exec();
      const images = results
        .map(([err, data]) => {
          if (err || !data || !data.id) return null;
          return {
            ...data,
            width: parseInt(data.width) || 0,
            height: parseInt(data.height) || 0,
            refCount: parseInt(data.refCount) || 0,
          };
        })
        .filter(Boolean);

      return images;
    } catch (error) {
      logger.error('Failed to get message images:', error);
      throw error;
    }
  }

  // 转换为 JSON
  toJSON() {
    return {
      id: this.id,
      sessionId: this.sessionId,
      role: this.role,
      text: this.text,
      params: this.params,
      imageIds: this.imageIds,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      editedOf: this.editedOf,
    };
  }
}
