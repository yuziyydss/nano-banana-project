# Nano Banana AI Image Editor - Redis 后端集成

## 🎉 完成状态

✅ **所有功能已实现完成！**

## 📋 实现的功能

### 1. 后端服务架构 ✅
- **Express + Redis + 云存储** 完整后端服务
- **多用户支持** - JWT 身份验证
- **多端同步** - WebSocket 实时通信
- **云存储集成** - AWS S3 / 阿里云 OSS
- **Docker 部署** - 一键启动

### 2. 数据模型 ✅
- **用户管理** - 注册、登录、权限控制
- **会话管理** - 多会话隔离、自动标题生成
- **消息系统** - 文本、图片消息，支持编辑删除
- **图片处理** - 云存储、缩略图、引用计数

### 3. API 接口 ✅
- **RESTful API** - 完整的 CRUD 操作
- **文件上传** - 单张/批量图片上传
- **实时同步** - WebSocket 多端同步
- **权限控制** - 用户隔离、会话权限

### 4. 前端集成 ✅
- **API 服务层** - 完整的 API 封装
- **React Hooks** - useAuth, useSessions, useImages, useWebSocket
- **状态管理** - 从本地状态迁移到 API 驱动
- **错误处理** - 统一的错误处理机制

## 🚀 快速开始

### 1. 启动后端服务

```bash
# 进入后端目录
cd server

# 安装依赖
npm install

# 配置环境变量
cp env.example .env
# 编辑 .env 文件，配置 Redis 和云存储

# 启动 Redis (Docker)
docker run -d --name redis -p 6379:6379 redis:7-alpine

# 启动后端服务
npm run dev
```

### 2. 配置前端

```bash
# 在项目根目录
cp env.example .env

# 编辑 .env 文件
VITE_API_BASE_URL=http://localhost:3001/api
VITE_WS_BASE_URL=ws://localhost:3001/ws
```

### 3. 启动前端

```bash
npm run dev
```

## 📁 文件结构

```
server/                          # 后端服务
├── src/
│   ├── config/                  # 配置文件
│   │   ├── redis.js            # Redis 配置
│   │   └── storage.js          # 云存储配置
│   ├── models/                  # 数据模型
│   │   ├── User.js             # 用户模型
│   │   ├── Session.js          # 会话模型
│   │   ├── Message.js          # 消息模型
│   │   └── Image.js            # 图片模型
│   ├── routes/                  # API 路由
│   │   ├── auth.js             # 认证接口
│   │   ├── sessions.js         # 会话接口
│   │   ├── messages.js         # 消息接口
│   │   └── images.js           # 图片接口
│   ├── websocket/              # WebSocket 处理
│   │   └── index.js            # WebSocket 管理器
│   ├── utils/                  # 工具函数
│   │   ├── auth.js             # 认证工具
│   │   └── logger.js           # 日志工具
│   └── index.js                # 主入口文件
├── docker-compose.yml          # Docker 配置
├── Dockerfile                  # Docker 镜像
├── redis.conf                  # Redis 配置
└── README.md                   # 后端文档

src/                            # 前端代码
├── services/
│   └── api.ts                  # API 服务层
├── hooks/                      # React Hooks
│   ├── useAuth.ts              # 认证 Hook
│   ├── useSessions.ts          # 会话 Hook
│   ├── useImages.ts            # 图片 Hook
│   └── useWebSocket.ts         # WebSocket Hook
└── utils/
    └── logger.ts               # 日志工具
```

## 🔧 配置说明

### 后端环境变量

```env
# 服务器配置
PORT=3001
NODE_ENV=development

# Redis 配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# JWT 配置
JWT_SECRET=your-super-secret-jwt-key

# 云存储配置（选择一种）
STORAGE_TYPE=aws
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1
AWS_S3_BUCKET=nanobanana-images

# 或者使用阿里云 OSS
# STORAGE_TYPE=aliyun
# ALIYUN_ACCESS_KEY_ID=your-aliyun-access-key
# ALIYUN_ACCESS_KEY_SECRET=your-aliyun-secret-key
# ALIYUN_REGION=oss-cn-hangzhou
# ALIYUN_BUCKET=nanobanana-images
```

### 前端环境变量

```env
VITE_API_BASE_URL=http://localhost:3001/api
VITE_WS_BASE_URL=ws://localhost:3001/ws
```

## 🔄 数据流程

### 1. 用户认证流程
```
用户注册/登录 → JWT Token → 本地存储 → API 请求头
```

### 2. 会话管理流程
```
创建会话 → Redis 存储 → 前端状态更新 → WebSocket 同步
```

### 3. 图片上传流程
```
选择文件 → 上传到云存储 → 生成缩略图 → 保存元数据到 Redis → 更新前端状态
```

### 4. 实时同步流程
```
用户操作 → WebSocket 发送 → 后端处理 → 广播给其他客户端 → 更新界面
```

## 🎯 核心特性

### 1. 多用户支持
- JWT 身份验证
- 用户数据隔离
- 权限控制

### 2. 多端同步
- WebSocket 实时通信
- 打字状态同步
- 消息实时推送

### 3. 云存储集成
- AWS S3 / 阿里云 OSS
- 自动缩略图生成
- 图片引用计数管理

### 4. 数据持久化
- Redis 数据存储
- 会话和消息持久化
- 图片元数据管理

## 🔍 API 文档

### 认证接口
- `POST /api/auth/register` - 用户注册
- `POST /api/auth/login` - 用户登录
- `GET /api/auth/me` - 获取用户信息
- `PUT /api/auth/me` - 更新用户信息

### 会话接口
- `GET /api/sessions` - 获取会话列表
- `POST /api/sessions` - 创建会话
- `GET /api/sessions/:id` - 获取会话详情
- `PUT /api/sessions/:id` - 更新会话
- `DELETE /api/sessions/:id` - 删除会话

### 消息接口
- `GET /api/sessions/:id/messages` - 获取会话消息
- `POST /api/sessions/:id/messages` - 创建消息
- `PUT /api/messages/:id` - 更新消息
- `DELETE /api/messages/:id` - 删除消息

### 图片接口
- `POST /api/images/upload` - 上传图片
- `POST /api/images/upload/batch` - 批量上传
- `GET /api/images/session/:id` - 获取会话图片
- `DELETE /api/images/:id` - 删除图片

## 🚀 部署指南

### Docker 部署

```bash
# 启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

### 生产环境部署

1. **配置云存储**
   - 创建 AWS S3 存储桶或阿里云 OSS 存储桶
   - 配置访问密钥和权限

2. **配置 Redis**
   - 使用云 Redis 服务（如 AWS ElastiCache）
   - 配置持久化和备份

3. **配置域名和 SSL**
   - 配置反向代理（Nginx）
   - 启用 HTTPS

4. **监控和日志**
   - 配置日志收集
   - 设置监控告警

## 🔧 开发指南

### 添加新功能

1. **后端**
   - 在 `src/models/` 添加数据模型
   - 在 `src/routes/` 添加 API 接口
   - 更新 WebSocket 处理逻辑

2. **前端**
   - 在 `src/services/api.ts` 添加 API 调用
   - 在 `src/hooks/` 添加 React Hook
   - 更新组件状态管理

### 调试技巧

1. **后端调试**
   ```bash
   # 查看 Redis 数据
   redis-cli
   > KEYS *
   > HGETALL user:user_id
   ```

2. **前端调试**
   ```javascript
   // 在浏览器控制台
   localStorage.getItem('auth_token')
   // 查看 API 请求
   // Network 标签页
   ```

## 📊 性能优化

### 后端优化
- Redis 连接池
- 批量操作
- 图片压缩
- 缓存策略

### 前端优化
- 虚拟滚动
- 图片懒加载
- 状态缓存
- 防抖节流

## 🔒 安全考虑

### 认证安全
- JWT 过期机制
- 密码加密存储
- 防止暴力破解

### 文件安全
- 文件类型验证
- 文件大小限制
- 病毒扫描

### API 安全
- CORS 配置
- 请求限流
- 输入验证

## 🎉 总结

Redis 后端集成已完全实现，包括：

✅ **完整的后端服务** - Express + Redis + 云存储  
✅ **多用户支持** - JWT 认证 + 权限控制  
✅ **多端同步** - WebSocket 实时通信  
✅ **前端集成** - API 驱动 + React Hooks  
✅ **Docker 部署** - 一键启动 + 生产就绪  
✅ **完整文档** - API 文档 + 部署指南  

现在你可以：
1. 启动后端服务
2. 配置云存储
3. 运行前端应用
4. 享受多用户、多端同步的 AI 图片编辑体验！

有任何问题，请参考 `server/README.md` 或联系开发团队。
