import express from 'express';
import { User } from '../models/User.js';
import { generateToken, authenticateToken } from '../utils/auth.js';
import { createLogger } from '../utils/logger.js';
import Joi from 'joi';

const router = express.Router();
const logger = createLogger('auth');

// 验证规则
const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  username: Joi.string().min(3).max(30).required(),
  password: Joi.string().min(6).required(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

// 用户注册
router.post('/register', async (req, res) => {
  try {
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: error.details[0].message 
      });
    }

    const { email, username, password } = value;

    // 检查用户是否已存在
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: 'User already exists' });
    }

    // 创建新用户
    const user = await User.create({ email, username, password });
    
    // 生成 JWT token
    const token = generateToken({ 
      userId: user.id, 
      email: user.email,
      username: user.username 
    });

    logger.info(`User registered: ${user.id}`);

    res.status(201).json({
      message: 'User created successfully',
      user: user.toJSON(),
      token,
    });
  } catch (error) {
    logger.error('Registration failed:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// 用户登录
router.post('/login', async (req, res) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: error.details[0].message 
      });
    }

    const { email, password } = value;

    // 查找用户
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // 验证密码
    const isValidPassword = await user.validatePassword(password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // 检查用户是否激活
    if (!user.isActive) {
      return res.status(403).json({ error: 'Account is deactivated' });
    }

    // 更新最后登录时间
    await user.updateLastLogin();

    // 生成 JWT token
    const token = generateToken({ 
      userId: user.id, 
      email: user.email,
      username: user.username 
    });

    logger.info(`User logged in: ${user.id}`);

    res.json({
      message: 'Login successful',
      user: user.toJSON(),
      token,
    });
  } catch (error) {
    logger.error('Login failed:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// 获取当前用户信息
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: user.toJSON(),
    });
  } catch (error) {
    logger.error('Failed to get user info:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

// 更新用户信息
router.put('/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updateSchema = Joi.object({
      username: Joi.string().min(3).max(30),
      avatar: Joi.string().uri(),
    });

    const { error, value } = updateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: error.details[0].message 
      });
    }

    await user.update(value);

    res.json({
      message: 'User updated successfully',
      user: user.toJSON(),
    });
  } catch (error) {
    logger.error('Failed to update user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// 修改密码
router.put('/password', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const passwordSchema = Joi.object({
      currentPassword: Joi.string().required(),
      newPassword: Joi.string().min(6).required(),
    });

    const { error, value } = passwordSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: error.details[0].message 
      });
    }

    const { currentPassword, newPassword } = value;

    // 验证当前密码
    const isValidPassword = await user.validatePassword(currentPassword);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // 更新密码
    await user.update({ password: newPassword });

    logger.info(`Password updated for user: ${user.id}`);

    res.json({
      message: 'Password updated successfully',
    });
  } catch (error) {
    logger.error('Failed to update password:', error);
    res.status(500).json({ error: 'Failed to update password' });
  }
});

// 删除用户账户
router.delete('/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await user.delete();

    logger.info(`User account deleted: ${user.id}`);

    res.json({
      message: 'Account deleted successfully',
    });
  } catch (error) {
    logger.error('Failed to delete user account:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

// 刷新 token
router.post('/refresh', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // 生成新的 token
    const token = generateToken({ 
      userId: user.id, 
      email: user.email,
      username: user.username 
    });

    res.json({
      message: 'Token refreshed successfully',
      token,
    });
  } catch (error) {
    logger.error('Failed to refresh token:', error);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});

export default router;
