import express from 'express';
import { Message } from '../models/Message.js';
import { Image } from '../models/Image.js';
import { authenticateToken } from '../utils/auth.js';
import { createLogger } from '../utils/logger.js';
import Joi from 'joi';

const router = express.Router();
const logger = createLogger('messages');

// 验证规则
const updateMessageSchema = Joi.object({
  text: Joi.string().optional(),
  params: Joi.object().optional(),
  imageIds: Joi.array().items(Joi.string()).optional(),
});

// 获取特定消息
router.get('/:messageId', authenticateToken, async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.userId;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // 这里可以添加权限检查，确保用户有权限访问该消息
    // 通过会话ID检查用户权限
    const session = await Session.findById(message.sessionId);
    if (!session || session.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // 获取消息的图片信息
    const images = await message.getImages();

    res.json({
      message: {
        ...message.toJSON(),
        images,
      },
    });
  } catch (error) {
    logger.error('Failed to get message:', error);
    res.status(500).json({ error: 'Failed to get message' });
  }
});

// 更新消息
router.put('/:messageId', authenticateToken, async (req, res) => {
  try {
    const { error, value } = updateMessageSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: error.details[0].message 
      });
    }

    const { messageId } = req.params;
    const userId = req.user.userId;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // 检查权限
    const session = await Session.findById(message.sessionId);
    if (!session || session.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { text, params, imageIds } = value;

    // 处理图片引用计数
    if (imageIds) {
      const oldImageIds = message.imageIds;
      
      // 移除旧图片引用
      for (const imageId of oldImageIds) {
        if (!imageIds.includes(imageId)) {
          const image = await Image.findById(imageId);
          if (image) {
            await image.decrementRefCount();
          }
        }
      }

      // 添加新图片引用
      for (const imageId of imageIds) {
        if (!oldImageIds.includes(imageId)) {
          const image = await Image.findById(imageId);
          if (image) {
            await image.incrementRefCount();
          }
        }
      }
    }

    // 更新消息
    const updateData = {};
    if (text !== undefined) updateData.text = text;
    if (params !== undefined) updateData.params = params;
    if (imageIds !== undefined) updateData.imageIds = imageIds;

    await message.update(updateData);

    logger.info(`Message updated: ${messageId}`);

    res.json({
      message: 'Message updated successfully',
      messageData: message.toJSON(),
    });
  } catch (error) {
    logger.error('Failed to update message:', error);
    res.status(500).json({ error: 'Failed to update message' });
  }
});

// 删除消息
router.delete('/:messageId', authenticateToken, async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.userId;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // 检查权限
    const session = await Session.findById(message.sessionId);
    if (!session || session.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // 减少图片引用计数
    for (const imageId of message.imageIds) {
      const image = await Image.findById(imageId);
      if (image) {
        await image.decrementRefCount();
      }
    }

    // 从会话中移除消息
    await session.removeMessage(messageId);

    // 删除消息
    await message.delete();

    logger.info(`Message deleted: ${messageId}`);

    res.json({
      message: 'Message deleted successfully',
    });
  } catch (error) {
    logger.error('Failed to delete message:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// 添加图片到消息
router.post('/:messageId/images', authenticateToken, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { imageId } = req.body;
    const userId = req.user.userId;

    if (!imageId) {
      return res.status(400).json({ error: 'Image ID is required' });
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // 检查权限
    const session = await Session.findById(message.sessionId);
    if (!session || session.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // 检查图片是否存在
    const image = await Image.findById(imageId);
    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    // 添加图片到消息
    await message.addImage(imageId);

    // 增加图片引用计数
    await image.incrementRefCount();

    logger.info(`Image added to message: ${messageId}, image: ${imageId}`);

    res.json({
      message: 'Image added to message successfully',
      messageData: message.toJSON(),
    });
  } catch (error) {
    logger.error('Failed to add image to message:', error);
    res.status(500).json({ error: 'Failed to add image to message' });
  }
});

// 从消息移除图片
router.delete('/:messageId/images/:imageId', authenticateToken, async (req, res) => {
  try {
    const { messageId, imageId } = req.params;
    const userId = req.user.userId;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // 检查权限
    const session = await Session.findById(message.sessionId);
    if (!session || session.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // 从消息移除图片
    await message.removeImage(imageId);

    // 减少图片引用计数
    const image = await Image.findById(imageId);
    if (image) {
      await image.decrementRefCount();
    }

    logger.info(`Image removed from message: ${messageId}, image: ${imageId}`);

    res.json({
      message: 'Image removed from message successfully',
      messageData: message.toJSON(),
    });
  } catch (error) {
    logger.error('Failed to remove image from message:', error);
    res.status(500).json({ error: 'Failed to remove image from message' });
  }
});

// 获取消息的图片
router.get('/:messageId/images', authenticateToken, async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.userId;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // 检查权限
    const session = await Session.findById(message.sessionId);
    if (!session || session.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // 获取消息的图片
    const images = await message.getImages();

    res.json({
      images: images.map(image => image.toJSON()),
    });
  } catch (error) {
    logger.error('Failed to get message images:', error);
    res.status(500).json({ error: 'Failed to get message images' });
  }
});

export default router;
