# Nano Banana AI Image Editor - Backend

基于 Redis + Express + 云存储的多用户、多端同步 AI 图片编辑后端服务。

## 功能特性

- 🔐 **用户认证**: JWT 身份验证，支持注册、登录、密码管理
- 💬 **会话管理**: 多会话支持，会话隔离，自动标题生成
- 📝 **消息系统**: 支持文本、图片消息，消息编辑和删除
- 🖼️ **图片处理**: 云存储集成（AWS S3/阿里云OSS），自动缩略图生成
- 🔄 **实时同步**: WebSocket 支持多端实时同步
- 📊 **数据持久化**: Redis 数据存储，支持分页和搜索
- 🚀 **高性能**: 连接池、缓存、批量操作优化

## 技术栈

- **Node.js 18+** - 运行时环境
- **Express** - Web 框架
- **Redis** - 数据存储和缓存
- **JWT** - 身份验证
- **Multer + Sharp** - 文件上传和图片处理
- **AWS S3 / 阿里云 OSS** - 云存储
- **WebSocket** - 实时通信
- **Docker** - 容器化部署

## 快速开始

### 环境要求

- Node.js 18+
- Redis 6+
- Docker (可选)

### 1. 安装依赖

```bash
cd server
npm install
```

### 2. 配置环境变量

复制环境变量模板：

```bash
cp env.example .env
```

编辑 `.env` 文件，配置以下变量：

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

### 3. 启动 Redis

使用 Docker：

```bash
docker run -d --name redis -p 6379:6379 redis:7-alpine
```

或直接安装 Redis：

```bash
# Ubuntu/Debian
sudo apt-get install redis-server

# macOS
brew install redis

# 启动 Redis
redis-server
```

### 4. 启动服务

开发模式：

```bash
npm run dev
```

生产模式：

```bash
npm start
```

服务将在 `http://localhost:3001` 启动。

## Docker 部署

### 1. 使用 Docker Compose

```bash
# 复制环境变量
cp env.example .env

# 编辑环境变量
nano .env

# 启动服务
docker-compose up -d
```

### 2. 单独构建镜像

```bash
# 构建镜像
docker build -t nanobanana-server .

# 运行容器
docker run -d \
  --name nanobanana-server \
  -p 3001:3001 \
  --env-file .env \
  nanobanana-server
```

## API 文档

### 认证接口

#### 用户注册
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "username": "username",
  "password": "password123"
}
```

#### 用户登录
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

#### 获取用户信息
```http
GET /api/auth/me
Authorization: Bearer <token>
```

### 会话接口

#### 获取会话列表
```http
GET /api/sessions?limit=20&offset=0
Authorization: Bearer <token>
```

#### 创建会话
```http
POST /api/sessions
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "New Chat"
}
```

#### 获取会话详情
```http
GET /api/sessions/:sessionId
Authorization: Bearer <token>
```

#### 获取会话消息
```http
GET /api/sessions/:sessionId/messages?limit=50&offset=0
Authorization: Bearer <token>
```

### 消息接口

#### 创建消息
```http
POST /api/sessions/:sessionId/messages
Authorization: Bearer <token>
Content-Type: application/json

{
  "role": "user",
  "text": "Hello, world!",
  "imageIds": ["image_id_1", "image_id_2"]
}
```

#### 更新消息
```http
PUT /api/messages/:messageId
Authorization: Bearer <token>
Content-Type: application/json

{
  "text": "Updated message"
}
```

#### 删除消息
```http
DELETE /api/messages/:messageId
Authorization: Bearer <token>
```

### 图片接口

#### 上传图片
```http
POST /api/images/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data

image: <file>
sessionId: <session_id>
type: uploaded
```

#### 批量上传图片
```http
POST /api/images/upload/batch
Authorization: Bearer <token>
Content-Type: multipart/form-data

images: <file1>, <file2>, ...
sessionId: <session_id>
type: uploaded
```

#### 获取图片信息
```http
GET /api/images/:imageId
Authorization: Bearer <token>
```

#### 获取会话图片
```http
GET /api/images/session/:sessionId?type=uploaded&limit=100&offset=0
Authorization: Bearer <token>
```

## WebSocket 连接

### 连接地址
```
ws://localhost:3001/ws/:sessionId?userId=:userId&token=:token
```

### 消息格式

#### 连接确认
```json
{
  "type": "connected",
  "sessionId": "session_id",
  "userId": "user_id",
  "timestamp": "2025-01-27T10:00:00.000Z"
}
```

#### 加入会话
```json
{
  "type": "join_session",
  "payload": {
    "sessionId": "session_id"
  }
}
```

#### 打字状态
```json
{
  "type": "typing",
  "payload": {
    "sessionId": "session_id",
    "isTyping": true
  }
}
```

## 数据模型

### 用户 (User)
```json
{
  "id": "user_id",
  "email": "user@example.com",
  "username": "username",
  "avatar": "avatar_url",
  "createdAt": "2025-01-27T10:00:00.000Z",
  "updatedAt": "2025-01-27T10:00:00.000Z",
  "lastLoginAt": "2025-01-27T10:00:00.000Z",
  "isActive": true
}
```

### 会话 (Session)
```json
{
  "id": "session_id",
  "userId": "user_id",
  "title": "Chat Title",
  "createdAt": "2025-01-27T10:00:00.000Z",
  "updatedAt": "2025-01-27T10:00:00.000Z",
  "messageCount": 10,
  "deletedAt": null
}
```

### 消息 (Message)
```json
{
  "id": "message_id",
  "sessionId": "session_id",
  "role": "user",
  "text": "Message content",
  "params": {},
  "imageIds": ["image_id_1"],
  "createdAt": "2025-01-27T10:00:00.000Z",
  "updatedAt": "2025-01-27T10:00:00.000Z",
  "editedOf": null
}
```

### 图片 (Image)
```json
{
  "id": "image_id",
  "sessionId": "session_id",
  "userId": "user_id",
  "type": "uploaded",
  "path": "https://bucket.s3.amazonaws.com/path/to/image.jpg",
  "thumbPath": "https://bucket.s3.amazonaws.com/path/to/thumb.jpg",
  "mime": "image/jpeg",
  "width": 1920,
  "height": 1080,
  "size": 1024000,
  "refCount": 1,
  "createdAt": "2025-01-27T10:00:00.000Z",
  "updatedAt": "2025-01-27T10:00:00.000Z"
}
```

## 监控和日志

### 健康检查
```http
GET /health
```

### 日志文件
- `logs/combined.log` - 所有日志
- `logs/error.log` - 错误日志

### 监控指标
- Redis 连接状态
- 活跃 WebSocket 连接数
- API 请求统计
- 错误率统计

## 性能优化

### Redis 优化
- 使用连接池
- 批量操作减少网络开销
- 合理设置过期时间
- 监控内存使用

### 图片处理优化
- 异步处理大文件
- 生成多种尺寸缩略图
- 使用 CDN 加速访问
- 压缩图片减少存储空间

### API 优化
- 请求限流防止滥用
- 分页减少数据传输
- 缓存热点数据
- 异步处理耗时操作

## 安全考虑

### 身份验证
- JWT token 过期机制
- 密码加密存储
- 防止暴力破解

### 文件上传
- 文件类型验证
- 文件大小限制
- 病毒扫描（可选）

### API 安全
- CORS 配置
- 请求限流
- 输入验证
- SQL 注入防护

## 故障排除

### 常见问题

1. **Redis 连接失败**
   - 检查 Redis 服务是否启动
   - 验证连接配置
   - 检查防火墙设置

2. **云存储上传失败**
   - 验证访问密钥
   - 检查存储桶权限
   - 确认网络连接

3. **WebSocket 连接失败**
   - 检查 token 有效性
   - 验证用户权限
   - 确认网络代理设置

### 日志分析
```bash
# 查看错误日志
tail -f logs/error.log

# 查看所有日志
tail -f logs/combined.log

# 搜索特定错误
grep "ERROR" logs/combined.log
```

## 开发指南

### 添加新接口
1. 在 `src/routes/` 创建路由文件
2. 在 `src/models/` 创建数据模型
3. 在 `src/index.js` 注册路由
4. 添加相应的测试

### 添加新功能
1. 更新数据模型
2. 实现业务逻辑
3. 添加 API 接口
4. 更新文档

### 代码规范
- 使用 ESLint 检查代码
- 遵循 RESTful API 设计
- 添加适当的错误处理
- 编写单元测试

## 许可证

GNU Affero General Public License v3.0

## 支持

如有问题，请提交 Issue 或联系开发团队。
