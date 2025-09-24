import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { Image } from '../models/Image.js';
import { uploadFile, deleteFile, generateFilePath, generateThumbPath } from '../config/storage.js';
import { authenticateToken } from '../utils/auth.js';
import { createLogger } from '../utils/logger.js';
import Joi from 'joi';

const router = express.Router();
const logger = createLogger('images');

// 配置 multer 用于内存存储
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = (process.env.ALLOWED_IMAGE_TYPES || 'image/jpeg,image/png,image/webp,image/gif').split(',');
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'), false);
    }
  },
});

// 验证规则
const uploadSchema = Joi.object({
  sessionId: Joi.string().required(),
  type: Joi.string().valid('uploaded', 'generated').required(),
});

// 上传图片
router.post('/upload', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const { error, value } = uploadSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: error.details[0].message 
      });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const { sessionId, type } = value;
    const userId = req.user.userId;
    const file = req.file;

    // 生成文件路径
    const filePath = generateFilePath(userId, sessionId, file.originalname);
    const thumbPath = generateThumbPath(filePath);

    // 处理原图
    const processedImage = await sharp(file.buffer)
      .resize(2048, 2048, { 
        fit: 'inside', 
        withoutEnlargement: true 
      })
      .jpeg({ quality: 90 })
      .toBuffer();

    // 生成缩略图
    const thumbnail = await sharp(file.buffer)
      .resize(300, 300, { 
        fit: 'inside', 
        withoutEnlargement: true 
      })
      .jpeg({ quality: 80 })
      .toBuffer();

    // 获取图片信息
    const imageInfo = await sharp(file.buffer).metadata();

    // 上传到云存储
    const [originalResult, thumbResult] = await Promise.all([
      uploadFile(processedImage, filePath, 'image/jpeg'),
      uploadFile(thumbnail, thumbPath, 'image/jpeg'),
    ]);

    // 创建图片记录
    const image = await Image.create({
      sessionId,
      userId,
      type,
      path: originalResult.url,
      thumbPath: thumbResult.url,
      mime: 'image/jpeg',
      width: imageInfo.width || 0,
      height: imageInfo.height || 0,
      size: processedImage.length,
    });

    logger.info(`Image uploaded: ${image.id} for session: ${sessionId}`);

    res.status(201).json({
      message: 'Image uploaded successfully',
      image: image.toJSON(),
    });
  } catch (error) {
    logger.error('Failed to upload image:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

// 批量上传图片
router.post('/upload/batch', authenticateToken, upload.array('images', 10), async (req, res) => {
  try {
    const { error, value } = uploadSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: error.details[0].message 
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No image files provided' });
    }

    const { sessionId, type } = value;
    const userId = req.user.userId;
    const files = req.files;

    const uploadPromises = files.map(async (file) => {
      try {
        // 生成文件路径
        const filePath = generateFilePath(userId, sessionId, file.originalname);
        const thumbPath = generateThumbPath(filePath);

        // 处理原图
        const processedImage = await sharp(file.buffer)
          .resize(2048, 2048, { 
            fit: 'inside', 
            withoutEnlargement: true 
          })
          .jpeg({ quality: 90 })
          .toBuffer();

        // 生成缩略图
        const thumbnail = await sharp(file.buffer)
          .resize(300, 300, { 
            fit: 'inside', 
            withoutEnlargement: true 
          })
          .jpeg({ quality: 80 })
          .toBuffer();

        // 获取图片信息
        const imageInfo = await sharp(file.buffer).metadata();

        // 上传到云存储
        const [originalResult, thumbResult] = await Promise.all([
          uploadFile(processedImage, filePath, 'image/jpeg'),
          uploadFile(thumbnail, thumbPath, 'image/jpeg'),
        ]);

        // 创建图片记录
        const image = await Image.create({
          sessionId,
          userId,
          type,
          path: originalResult.url,
          thumbPath: thumbResult.url,
          mime: 'image/jpeg',
          width: imageInfo.width || 0,
          height: imageInfo.height || 0,
          size: processedImage.length,
        });

        return image.toJSON();
      } catch (error) {
        logger.error(`Failed to upload image ${file.originalname}:`, error);
        return { error: error.message, filename: file.originalname };
      }
    });

    const results = await Promise.all(uploadPromises);
    const successful = results.filter(result => !result.error);
    const failed = results.filter(result => result.error);

    logger.info(`Batch upload completed: ${successful.length} successful, ${failed.length} failed`);

    res.status(201).json({
      message: 'Batch upload completed',
      results: {
        successful,
        failed,
        total: files.length,
      },
    });
  } catch (error) {
    logger.error('Failed to batch upload images:', error);
    res.status(500).json({ error: 'Failed to batch upload images' });
  }
});

// 获取图片信息
router.get('/:imageId', authenticateToken, async (req, res) => {
  try {
    const { imageId } = req.params;
    const userId = req.user.userId;

    const image = await Image.findById(imageId);
    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    // 检查权限
    if (image.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({
      image: image.toJSON(),
    });
  } catch (error) {
    logger.error('Failed to get image:', error);
    res.status(500).json({ error: 'Failed to get image' });
  }
});

// 获取会话的图片
router.get('/session/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { type, limit = 100, offset = 0 } = req.query;
    const userId = req.user.userId;

    const images = await Image.findBySessionId(sessionId, type);
    
    // 过滤用户权限
    const userImages = images.filter(image => image.userId === userId);

    res.json({
      images: userImages
        .slice(parseInt(offset), parseInt(offset) + parseInt(limit))
        .map(image => image.toJSON()),
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: userImages.length,
      },
    });
  } catch (error) {
    logger.error('Failed to get session images:', error);
    res.status(500).json({ error: 'Failed to get session images' });
  }
});

// 获取用户的所有图片
router.get('/user/all', authenticateToken, async (req, res) => {
  try {
    const { type, limit = 100, offset = 0 } = req.query;
    const userId = req.user.userId;

    const images = await Image.findByUserId(userId, parseInt(limit), parseInt(offset));
    
    // 按类型过滤
    const filteredImages = type ? images.filter(image => image.type === type) : images;

    res.json({
      images: filteredImages.map(image => image.toJSON()),
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: filteredImages.length,
      },
    });
  } catch (error) {
    logger.error('Failed to get user images:', error);
    res.status(500).json({ error: 'Failed to get user images' });
  }
});

// 删除图片
router.delete('/:imageId', authenticateToken, async (req, res) => {
  try {
    const { imageId } = req.params;
    const userId = req.user.userId;

    const image = await Image.findById(imageId);
    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    // 检查权限
    if (image.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // 检查引用计数
    if (image.refCount > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete image that is still referenced by messages' 
      });
    }

    // 从云存储删除文件
    try {
      const pathParts = image.path.split('/');
      const key = pathParts.slice(-4).join('/'); // 获取相对路径
      await deleteFile(key);
      
      if (image.thumbPath) {
        const thumbPathParts = image.thumbPath.split('/');
        const thumbKey = thumbPathParts.slice(-4).join('/');
        await deleteFile(thumbKey);
      }
    } catch (error) {
      logger.warn(`Failed to delete files from storage for image ${imageId}:`, error);
    }

    // 删除图片记录
    await image.delete();

    logger.info(`Image deleted: ${imageId}`);

    res.json({
      message: 'Image deleted successfully',
    });
  } catch (error) {
    logger.error('Failed to delete image:', error);
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

// 清理未引用的图片
router.post('/cleanup', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // 只清理当前用户的图片
    const userImages = await Image.findByUserId(userId, 1000, 0);
    const unreferencedImages = userImages.filter(image => image.refCount === 0);

    const cleanupPromises = unreferencedImages.map(async (image) => {
      try {
        // 从云存储删除文件
        const pathParts = image.path.split('/');
        const key = pathParts.slice(-4).join('/');
        await deleteFile(key);
        
        if (image.thumbPath) {
          const thumbPathParts = image.thumbPath.split('/');
          const thumbKey = thumbPathParts.slice(-4).join('/');
          await deleteFile(thumbKey);
        }

        // 删除图片记录
        await image.delete();
        
        return { success: true, imageId: image.id };
      } catch (error) {
        logger.error(`Failed to cleanup image ${image.id}:`, error);
        return { success: false, imageId: image.id, error: error.message };
      }
    });

    const results = await Promise.all(cleanupPromises);
    const successful = results.filter(result => result.success);
    const failed = results.filter(result => !result.success);

    logger.info(`Cleanup completed: ${successful.length} successful, ${failed.length} failed`);

    res.json({
      message: 'Cleanup completed',
      results: {
        successful: successful.length,
        failed: failed.length,
        total: unreferencedImages.length,
      },
    });
  } catch (error) {
    logger.error('Failed to cleanup images:', error);
    res.status(500).json({ error: 'Failed to cleanup images' });
  }
});

export default router;
