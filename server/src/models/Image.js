import redis from '../config/redis.js';
import { ulid } from 'ulid';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('image');

const IMAGE_PREFIX = 'image';

export class Image {
  constructor(data) {
    this.id = data.id || ulid();
    this.sessionId = data.sessionId;
    this.userId = data.userId;
    this.type = data.type; // 'uploaded' or 'generated'
    this.path = data.path;
    this.thumbPath = data.thumbPath || null;
    this.mime = data.mime;
    this.width = data.width || 0;
    this.height = data.height || 0;
    this.size = data.size || 0;
    this.refCount = data.refCount || 0;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  // 创建图片记录
  static async create(imageData) {
    try {
      const image = new Image(imageData);
      const imageKey = `${IMAGE_PREFIX}:${image.id}:meta`;

      await redis.hset(imageKey, {
        id: image.id,
        sessionId: image.sessionId,
        userId: image.userId,
        type: image.type,
        path: image.path,
        thumbPath: image.thumbPath || '',
        mime: image.mime,
        width: image.width.toString(),
        height: image.height.toString(),
        size: image.size.toString(),
        refCount: image.refCount.toString(),
        createdAt: image.createdAt,
        updatedAt: image.updatedAt,
      });

      logger.info(`Image created: ${image.id} in session: ${image.sessionId}`);
      return image;
    } catch (error) {
      logger.error('Failed to create image:', error);
      throw error;
    }
  }

  // 根据 ID 查找图片
  static async findById(imageId) {
    try {
      const imageKey = `${IMAGE_PREFIX}:${imageId}:meta`;
      const imageData = await redis.hgetall(imageKey);

      if (!imageData || !imageData.id) {
        return null;
      }

      return new Image({
        ...imageData,
        width: parseInt(imageData.width) || 0,
        height: parseInt(imageData.height) || 0,
        size: parseInt(imageData.size) || 0,
        refCount: parseInt(imageData.refCount) || 0,
      });
    } catch (error) {
      logger.error('Failed to find image by ID:', error);
      throw error;
    }
  }

  // 更新图片信息
  async update(updateData) {
    try {
      const imageKey = `${IMAGE_PREFIX}:${this.id}:meta`;
      const updates = {
        ...updateData,
        updatedAt: new Date().toISOString(),
      };

      await redis.hset(imageKey, updates);
      
      // 更新实例属性
      Object.assign(this, updates);
      
      logger.info(`Image updated: ${this.id}`);
      return this;
    } catch (error) {
      logger.error('Failed to update image:', error);
      throw error;
    }
  }

  // 增加引用计数
  async incrementRefCount() {
    try {
      const imageKey = `${IMAGE_PREFIX}:${this.id}:meta`;
      const newRefCount = await redis.hincrby(imageKey, 'refCount', 1);
      this.refCount = newRefCount;
      
      logger.info(`Image ref count incremented: ${this.id}, count: ${newRefCount}`);
    } catch (error) {
      logger.error('Failed to increment image ref count:', error);
      throw error;
    }
  }

  // 减少引用计数
  async decrementRefCount() {
    try {
      const imageKey = `${IMAGE_PREFIX}:${this.id}:meta`;
      const newRefCount = await redis.hincrby(imageKey, 'refCount', -1);
      this.refCount = Math.max(0, newRefCount);
      
      logger.info(`Image ref count decremented: ${this.id}, count: ${this.refCount}`);
      
      // 如果引用计数为0，标记为可删除
      if (this.refCount === 0) {
        await this.markForDeletion();
      }
      
      return this.refCount;
    } catch (error) {
      logger.error('Failed to decrement image ref count:', error);
      throw error;
    }
  }

  // 标记为可删除
  async markForDeletion() {
    try {
      const imageKey = `${IMAGE_PREFIX}:${this.id}:meta`;
      await redis.hset(imageKey, 'deletedAt', new Date().toISOString());
      
      logger.info(`Image marked for deletion: ${this.id}`);
    } catch (error) {
      logger.error('Failed to mark image for deletion:', error);
      throw error;
    }
  }

  // 删除图片记录
  async delete() {
    try {
      const imageKey = `${IMAGE_PREFIX}:${this.id}:meta`;
      await redis.del(imageKey);
      
      logger.info(`Image record deleted: ${this.id}`);
    } catch (error) {
      logger.error('Failed to delete image record:', error);
      throw error;
    }
  }

  // 获取会话的所有图片
  static async findBySessionId(sessionId, type = null) {
    try {
      const pattern = `${IMAGE_PREFIX}:*:meta`;
      const keys = await redis.keys(pattern);
      
      if (keys.length === 0) {
        return [];
      }

      // 批量获取图片数据
      const pipeline = redis.pipeline();
      keys.forEach(key => {
        pipeline.hgetall(key);
      });

      const results = await pipeline.exec();
      const images = results
        .map(([err, data]) => {
          if (err || !data || !data.id) return null;
          if (data.sessionId !== sessionId) return null;
          if (type && data.type !== type) return null;
          
          return new Image({
            ...data,
            width: parseInt(data.width) || 0,
            height: parseInt(data.height) || 0,
            size: parseInt(data.size) || 0,
            refCount: parseInt(data.refCount) || 0,
          });
        })
        .filter(Boolean);

      return images;
    } catch (error) {
      logger.error('Failed to find images by session ID:', error);
      throw error;
    }
  }

  // 获取用户的所有图片
  static async findByUserId(userId, limit = 100, offset = 0) {
    try {
      const pattern = `${IMAGE_PREFIX}:*:meta`;
      const keys = await redis.keys(pattern);
      
      if (keys.length === 0) {
        return [];
      }

      // 批量获取图片数据
      const pipeline = redis.pipeline();
      keys.forEach(key => {
        pipeline.hgetall(key);
      });

      const results = await pipeline.exec();
      const images = results
        .map(([err, data]) => {
          if (err || !data || !data.id) return null;
          if (data.userId !== userId) return null;
          
          return new Image({
            ...data,
            width: parseInt(data.width) || 0,
            height: parseInt(data.height) || 0,
            size: parseInt(data.size) || 0,
            refCount: parseInt(data.refCount) || 0,
          });
        })
        .filter(Boolean)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(offset, offset + limit);

      return images;
    } catch (error) {
      logger.error('Failed to find images by user ID:', error);
      throw error;
    }
  }

  // 清理未引用的图片
  static async cleanupUnreferenced() {
    try {
      const pattern = `${IMAGE_PREFIX}:*:meta`;
      const keys = await redis.keys(pattern);
      
      if (keys.length === 0) {
        return { deleted: 0, errors: 0 };
      }

      // 批量获取图片数据
      const pipeline = redis.pipeline();
      keys.forEach(key => {
        pipeline.hgetall(key);
      });

      const results = await pipeline.exec();
      const unreferencedImages = results
        .map(([err, data]) => {
          if (err || !data || !data.id) return null;
          if (parseInt(data.refCount) > 0) return null;
          
          return data.id;
        })
        .filter(Boolean);

      // 删除未引用的图片记录
      const deletePipeline = redis.pipeline();
      unreferencedImages.forEach(imageId => {
        deletePipeline.del(`${IMAGE_PREFIX}:${imageId}:meta`);
      });

      await deletePipeline.exec();
      
      logger.info(`Cleaned up ${unreferencedImages.length} unreferenced images`);
      return { deleted: unreferencedImages.length, errors: 0 };
    } catch (error) {
      logger.error('Failed to cleanup unreferenced images:', error);
      throw error;
    }
  }

  // 转换为 JSON
  toJSON() {
    return {
      id: this.id,
      sessionId: this.sessionId,
      userId: this.userId,
      type: this.type,
      path: this.path,
      thumbPath: this.thumbPath,
      mime: this.mime,
      width: this.width,
      height: this.height,
      size: this.size,
      refCount: this.refCount,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
