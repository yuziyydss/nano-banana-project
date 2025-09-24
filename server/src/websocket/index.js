import { createLogger } from '../utils/logger.js';
import redis from '../config/redis.js';

const logger = createLogger('websocket');

// 存储活跃连接
const activeConnections = new Map();

// 设置 WebSocket
export const setupWebSocket = (app) => {
  app.ws('/ws/:sessionId', (ws, req) => {
    const { sessionId } = req.params;
    const userId = req.query.userId;
    const token = req.query.token;

    if (!userId || !token) {
      ws.close(1008, 'Missing authentication');
      return;
    }

    // 验证 token（简化版，实际应该验证 JWT）
    // 这里可以添加更严格的 token 验证逻辑

    const connectionId = `${userId}-${sessionId}`;
    activeConnections.set(connectionId, {
      ws,
      userId,
      sessionId,
      connectedAt: new Date(),
    });

    logger.info(`WebSocket connected: ${connectionId}`);

    // 发送连接确认
    ws.send(JSON.stringify({
      type: 'connected',
      sessionId,
      userId,
      timestamp: new Date().toISOString(),
    }));

    // 处理消息
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message);
        await handleWebSocketMessage(connectionId, data);
      } catch (error) {
        logger.error('Failed to handle WebSocket message:', error);
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Invalid message format',
        }));
      }
    });

    // 处理连接关闭
    ws.on('close', (code, reason) => {
      logger.info(`WebSocket disconnected: ${connectionId}, code: ${code}, reason: ${reason}`);
      activeConnections.delete(connectionId);
    });

    // 处理错误
    ws.on('error', (error) => {
      logger.error(`WebSocket error for ${connectionId}:`, error);
      activeConnections.delete(connectionId);
    });

    // 发送心跳
    const heartbeat = setInterval(() => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({
          type: 'ping',
          timestamp: new Date().toISOString(),
        }));
      } else {
        clearInterval(heartbeat);
        activeConnections.delete(connectionId);
      }
    }, 30000); // 30秒心跳
  });
};

// 处理 WebSocket 消息
const handleWebSocketMessage = async (connectionId, data) => {
  const connection = activeConnections.get(connectionId);
  if (!connection) return;

  const { type, payload } = data;

  switch (type) {
    case 'pong':
      // 心跳响应
      break;

    case 'join_session':
      // 加入会话（可以用于多用户协作）
      await handleJoinSession(connectionId, payload);
      break;

    case 'leave_session':
      // 离开会话
      await handleLeaveSession(connectionId, payload);
      break;

    case 'typing':
      // 打字状态
      await handleTyping(connectionId, payload);
      break;

    default:
      logger.warn(`Unknown WebSocket message type: ${type}`);
  }
};

// 加入会话
const handleJoinSession = async (connectionId, payload) => {
  const connection = activeConnections.get(connectionId);
  if (!connection) return;

  const { sessionId } = payload;
  
  // 验证用户是否有权限访问该会话
  // 这里可以添加权限检查逻辑

  // 订阅会话事件
  await subscribeToSessionEvents(sessionId, connectionId);
  
  connection.ws.send(JSON.stringify({
    type: 'joined_session',
    sessionId,
    timestamp: new Date().toISOString(),
  }));
};

// 离开会话
const handleLeaveSession = async (connectionId, payload) => {
  const connection = activeConnections.get(connectionId);
  if (!connection) return;

  const { sessionId } = payload;
  
  // 取消订阅会话事件
  await unsubscribeFromSessionEvents(sessionId, connectionId);
  
  connection.ws.send(JSON.stringify({
    type: 'left_session',
    sessionId,
    timestamp: new Date().toISOString(),
  }));
};

// 处理打字状态
const handleTyping = async (connectionId, payload) => {
  const connection = activeConnections.get(connectionId);
  if (!connection) return;

  const { sessionId, isTyping } = payload;
  
  // 广播给同一会话的其他用户
  await broadcastToSession(sessionId, {
    type: 'user_typing',
    userId: connection.userId,
    isTyping,
    timestamp: new Date().toISOString(),
  }, connectionId);
};

// 订阅会话事件
const subscribeToSessionEvents = async (sessionId, connectionId) => {
  try {
    // 使用 Redis Streams 监听会话事件
    const streamKey = `session:${sessionId}:events`;
    
    // 这里可以实现 Redis Streams 的订阅逻辑
    // 为了简化，我们使用轮询方式
    logger.info(`Subscribed to session events: ${sessionId} for connection: ${connectionId}`);
  } catch (error) {
    logger.error('Failed to subscribe to session events:', error);
  }
};

// 取消订阅会话事件
const unsubscribeFromSessionEvents = async (sessionId, connectionId) => {
  try {
    logger.info(`Unsubscribed from session events: ${sessionId} for connection: ${connectionId}`);
  } catch (error) {
    logger.error('Failed to unsubscribe from session events:', error);
  }
};

// 广播消息到会话
export const broadcastToSession = async (sessionId, message, excludeConnectionId = null) => {
  try {
    const connections = Array.from(activeConnections.entries())
      .filter(([id, conn]) => conn.sessionId === sessionId && id !== excludeConnectionId);

    for (const [connectionId, connection] of connections) {
      if (connection.ws.readyState === connection.ws.OPEN) {
        connection.ws.send(JSON.stringify(message));
      } else {
        // 清理无效连接
        activeConnections.delete(connectionId);
      }
    }

    logger.info(`Broadcasted message to ${connections.length} connections in session: ${sessionId}`);
  } catch (error) {
    logger.error('Failed to broadcast message to session:', error);
  }
};

// 广播消息到用户
export const broadcastToUser = async (userId, message) => {
  try {
    const connections = Array.from(activeConnections.entries())
      .filter(([id, conn]) => conn.userId === userId);

    for (const [connectionId, connection] of connections) {
      if (connection.ws.readyState === connection.ws.OPEN) {
        connection.ws.send(JSON.stringify(message));
      } else {
        // 清理无效连接
        activeConnections.delete(connectionId);
      }
    }

    logger.info(`Broadcasted message to ${connections.length} connections for user: ${userId}`);
  } catch (error) {
    logger.error('Failed to broadcast message to user:', error);
  }
};

// 获取活跃连接统计
export const getConnectionStats = () => {
  return {
    totalConnections: activeConnections.size,
    connectionsBySession: Array.from(activeConnections.values())
      .reduce((acc, conn) => {
        acc[conn.sessionId] = (acc[conn.sessionId] || 0) + 1;
        return acc;
      }, {}),
    connectionsByUser: Array.from(activeConnections.values())
      .reduce((acc, conn) => {
        acc[conn.userId] = (acc[conn.userId] || 0) + 1;
        return acc;
      }, {}),
  };
};

// 清理无效连接
export const cleanupConnections = () => {
  const now = new Date();
  const timeout = 5 * 60 * 1000; // 5分钟超时

  for (const [connectionId, connection] of activeConnections.entries()) {
    if (now - connection.connectedAt > timeout) {
      connection.ws.close(1000, 'Connection timeout');
      activeConnections.delete(connectionId);
    }
  }
};

// 定期清理无效连接
setInterval(cleanupConnections, 60000); // 每分钟清理一次
