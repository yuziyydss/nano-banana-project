import express from 'express';
import { Session } from '../models/Session.js';
import { Message } from '../models/Message.js';
import { Image } from '../models/Image.js';
import { authenticateToken } from '../utils/auth.js';
import { createLogger } from '../utils/logger.js';
import Joi from 'joi';

const router = express.Router();
const logger = createLogger('sessions');

// 验证规则
const createSessionSchema = Joi.object({
  title: Joi.string().max(100).optional(),
});

const updateSessionSchema = Joi.object({
  title: Joi.string().max(100).required(),
});

// 获取用户的所有会话
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;
    const userId = req.user.userId;

    const sessions = await Session.findByUserId(userId, parseInt(limit), parseInt(offset));

    res.json({
      sessions: sessions.map(session => session.toJSON()),
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: sessions.length,
      },
    });
  } catch (error) {
    logger.error('Failed to get sessions:', error);
    res.status(500).json({ error: 'Failed to get sessions' });
  }
});

// 创建新会话
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { error, value } = createSessionSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: error.details[0].message 
      });
    }

    const { title } = value;
    const userId = req.user.userId;

    const session = await Session.create({
      userId,
      title: title || 'New Chat',
    });

    logger.info(`Session created: ${session.id} for user: ${userId}`);

    res.status(201).json({
      message: 'Session created successfully',
      session: session.toJSON(),
    });
  } catch (error) {
    logger.error('Failed to create session:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// 获取特定会话详情
router.get('/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.userId;

    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // 检查权限
    if (session.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({
      session: session.toJSON(),
    });
  } catch (error) {
    logger.error('Failed to get session:', error);
    res.status(500).json({ error: 'Failed to get session' });
  }
});

// 更新会话
router.put('/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { error, value } = updateSessionSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: error.details[0].message 
      });
    }

    const { sessionId } = req.params;
    const userId = req.user.userId;

    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // 检查权限
    if (session.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await session.update(value);

    logger.info(`Session updated: ${sessionId}`);

    res.json({
      message: 'Session updated successfully',
      session: session.toJSON(),
    });
  } catch (error) {
    logger.error('Failed to update session:', error);
    res.status(500).json({ error: 'Failed to update session' });
  }
});

// 删除会话（软删除）
router.delete('/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.userId;

    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // 检查权限
    if (session.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await session.delete();

    logger.info(`Session deleted: ${sessionId}`);

    res.json({
      message: 'Session deleted successfully',
    });
  } catch (error) {
    logger.error('Failed to delete session:', error);
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

// 获取会话消息
router.get('/:sessionId/messages', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    const userId = req.user.userId;

    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // 检查权限
    if (session.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const messages = await session.getMessages(parseInt(limit), parseInt(offset));

    res.json({
      messages: messages.map(message => ({
        ...message,
        images: [], // 这里可以后续添加图片信息
      })),
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: messages.length,
      },
    });
  } catch (error) {
    logger.error('Failed to get session messages:', error);
    res.status(500).json({ error: 'Failed to get session messages' });
  }
});

// 创建消息
router.post('/:sessionId/messages', authenticateToken, async (req, res) => {
  try {
    const messageSchema = Joi.object({
      role: Joi.string().valid('user', 'assistant').required(),
      text: Joi.string().required(),
      params: Joi.object().optional(),
      imageIds: Joi.array().items(Joi.string()).optional(),
    });

    const { error, value } = messageSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: error.details[0].message 
      });
    }

    const { sessionId } = req.params;
    const userId = req.user.userId;

    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // 检查权限
    if (session.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { role, text, params = {}, imageIds = [] } = value;

    // 创建消息
    const message = await Message.create({
      sessionId,
      role,
      text,
      params,
      imageIds,
    });

    // 添加到会话
    await session.addMessage(message.id);

    // 更新图片引用计数
    for (const imageId of imageIds) {
      const image = await Image.findById(imageId);
      if (image) {
        await image.incrementRefCount();
      }
    }

    logger.info(`Message created: ${message.id} in session: ${sessionId}`);

    res.status(201).json({
      message: 'Message created successfully',
      messageData: message.toJSON(),
    });
  } catch (error) {
    logger.error('Failed to create message:', error);
    res.status(500).json({ error: 'Failed to create message' });
  }
});

// 获取会话统计信息
router.get('/:sessionId/stats', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.userId;

    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // 检查权限
    if (session.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const stats = await session.getStats();

    res.json({
      stats,
    });
  } catch (error) {
    logger.error('Failed to get session stats:', error);
    res.status(500).json({ error: 'Failed to get session stats' });
  }
});

export default router;
