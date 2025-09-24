import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import expressWs from 'express-ws';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import gptImage1Routes from './routes/gpt_image_1.js'

// 导入配置和工具
import redis, { checkRedisHealth, closeRedis } from './config/redis.js';
import { createLogger } from './utils/logger.js';

// 导入路由
import authRoutes from './routes/auth.js';
import sessionRoutes from './routes/sessions.js';
import messageRoutes from './routes/messages.js';
import imageRoutes from './routes/images.js';
import fluxRoutes from './routes/flux.js';
import seedreamRoutes from './routes/seedream.js';

// 导入 WebSocket 处理器
import { setupWebSocket } from './websocket/index.js';

// 加载环境变量
dotenv.config();

// 新增：允许无 Redis 运行的开关
const allowNoRedis = process.env.ALLOW_NO_REDIS === '1' || process.env.ALLOW_NO_REDIS === 'true';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const logger = createLogger('app');

// 创建 logs 目录
const logsDir = join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// 基础中间件
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", "ws:"],
    },
  },
}));

app.use(cors({
  origin: (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim()),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 速率限制
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15分钟
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // 限制每个IP 100次请求
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// 健康检查
app.get('/health', async (req, res) => {
  try {
    let redisStatus = 'healthy';
    if (allowNoRedis) {
      redisStatus = 'skipped';
    } else {
      const redisHealthy = await checkRedisHealth();
      redisStatus = redisHealthy ? 'healthy' : 'unhealthy';
    }

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        redis: redisStatus,
      },
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Service unavailable',
    });
  }
});

// API 路由
app.use('/api/auth', authRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/images', imageRoutes);
app.use('/api/flux', fluxRoutes);
app.use('/api/seedream', seedreamRoutes);
app.use('/api/gpt-image-1', gptImage1Routes);

// WebSocket 支持
const { app: wsApp } = expressWs(app);
setupWebSocket(wsApp);

// 404 处理
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: 'The requested resource was not found',
  });
});

// 错误处理中间件
app.use((error, req, res, next) => {
  logger.error('Unhandled error:', error);
  
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      error: 'File too large',
      message: 'The uploaded file exceeds the maximum allowed size',
    });
  }
  
  if (error.message === 'Invalid file type') {
    return res.status(400).json({
      error: 'Invalid file type',
      message: 'Only image files are allowed',
    });
  }

  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'production' 
      ? 'Something went wrong' 
      : error.message,
  });
});

// 启动服务器
const PORT = process.env.PORT || 3001;

const startServer = async () => {
  try {
    // 检查 Redis 连接（可跳过）
    if (allowNoRedis) {
      logger.warn('ALLOW_NO_REDIS enabled. Skipping Redis health check.');
    } else {
      const redisHealthy = await checkRedisHealth();
      if (!redisHealthy) {
        logger.error('Redis is not available. Please check your Redis connection.');
        process.exit(1);
      }
    }

    // 启动服务器
    const server = app.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`📊 Health check: http://localhost:${PORT}/health`);
      logger.info(`🔗 API base URL: http://localhost:${PORT}/api`);
      logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    // 优雅关闭
    const gracefulShutdown = async (signal) => {
      logger.info(`Received ${signal}. Starting graceful shutdown...`);
      
      server.close(async () => {
        logger.info('HTTP server closed');
        
        try {
          await closeRedis();
          logger.info('Redis connection closed');
          process.exit(0);
        } catch (error) {
          logger.error('Error during shutdown:', error);
          process.exit(1);
        }
      });
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

startServer();
