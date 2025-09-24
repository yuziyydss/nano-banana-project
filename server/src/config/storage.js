import AWS from 'aws-sdk';
import OSS from 'ali-oss';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('storage');

let storageClient = null;
const storageType = process.env.STORAGE_TYPE || 'aws';

// 初始化存储客户端
const initStorage = () => {
  try {
    if (storageType === 'aws') {
      AWS.config.update({
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION || 'us-east-1',
      });
      storageClient = new AWS.S3();
      logger.info('AWS S3 storage initialized');
    } else if (storageType === 'aliyun') {
      storageClient = new OSS({
        accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID,
        accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET,
        region: process.env.ALIYUN_REGION || 'oss-cn-hangzhou',
        bucket: process.env.ALIYUN_BUCKET,
      });
      logger.info('Aliyun OSS storage initialized');
    } else {
      throw new Error(`Unsupported storage type: ${storageType}`);
    }
  } catch (error) {
    logger.error('Failed to initialize storage:', error);
    throw error;
  }
};

// 上传文件到云存储
export const uploadFile = async (fileBuffer, key, contentType) => {
  if (!storageClient) {
    initStorage();
  }

  try {
    if (storageType === 'aws') {
      const params = {
        Bucket: process.env.AWS_S3_BUCKET,
        Key: key,
        Body: fileBuffer,
        ContentType: contentType,
        ACL: 'public-read',
      };
      const result = await storageClient.upload(params).promise();
      return {
        url: result.Location,
        key: result.Key,
        bucket: result.Bucket,
      };
    } else if (storageType === 'aliyun') {
      const result = await storageClient.put(key, fileBuffer, {
        headers: {
          'Content-Type': contentType,
        },
      });
      return {
        url: result.url,
        key: result.name,
        bucket: result.bucket,
      };
    }
  } catch (error) {
    logger.error('Failed to upload file:', error);
    throw error;
  }
};

// 删除文件
export const deleteFile = async (key) => {
  if (!storageClient) {
    initStorage();
  }

  try {
    if (storageType === 'aws') {
      const params = {
        Bucket: process.env.AWS_S3_BUCKET,
        Key: key,
      };
      await storageClient.deleteObject(params).promise();
    } else if (storageType === 'aliyun') {
      await storageClient.delete(key);
    }
    logger.info(`File deleted: ${key}`);
  } catch (error) {
    logger.error('Failed to delete file:', error);
    throw error;
  }
};

// 生成文件路径
export const generateFilePath = (userId, sessionId, filename) => {
  const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '/');
  const ext = filename.split('.').pop();
  const hash = Math.random().toString(36).substring(2, 15);
  return `images/${userId}/${sessionId}/${timestamp}/${hash}.${ext}`;
};

// 生成缩略图路径
export const generateThumbPath = (originalPath) => {
  const parts = originalPath.split('.');
  const ext = parts.pop();
  return `${parts.join('.')}_thumb.${ext}`;
};

export { storageType };
