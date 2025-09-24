import { useState, useCallback } from 'react';
import { imageAPI } from '../services/api';
import { createLogger } from '../utils/logger';

const logger = createLogger('useImages');

export interface ImageData {
  id: string;
  sessionId: string;
  userId: string;
  type: 'uploaded' | 'generated';
  path: string;
  thumbPath?: string;
  mime: string;
  width: number;
  height: number;
  size: number;
  refCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface UseImagesReturn {
  images: ImageData[];
  uploadedImages: ImageData[];
  generatedImages: ImageData[];
  isLoading: boolean;
  error: string | null;
  uploadImage: (file: File, sessionId: string, type?: 'uploaded' | 'generated') => Promise<ImageData>;
  uploadImages: (files: File[], sessionId: string, type?: 'uploaded' | 'generated') => Promise<ImageData[]>;
  loadSessionImages: (sessionId: string, type?: 'uploaded' | 'generated') => Promise<void>;
  loadUserImages: (type?: 'uploaded' | 'generated') => Promise<void>;
  deleteImage: (imageId: string) => Promise<void>;
  cleanupImages: () => Promise<void>;
  clearError: () => void;
}

export const useImages = (): UseImagesReturn => {
  const [images, setImages] = useState<ImageData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 计算分类图片
  const uploadedImages = images.filter(img => img.type === 'uploaded');
  const generatedImages = images.filter(img => img.type === 'generated');

  // 上传单张图片
  const uploadImage = useCallback(async (
    file: File, 
    sessionId: string, 
    type: 'uploaded' | 'generated' = 'uploaded'
  ): Promise<ImageData> => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await imageAPI.uploadImage(file, sessionId, type);
      const newImage = response.image;
      
      setImages(prev => [newImage, ...prev]);
      
      logger.info(`Uploaded image: ${newImage.id}`);
      return newImage;
    } catch (error: any) {
      logger.error('Failed to upload image:', error);
      setError(error.message || 'Failed to upload image');
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 批量上传图片
  const uploadImages = useCallback(async (
    files: File[], 
    sessionId: string, 
    type: 'uploaded' | 'generated' = 'uploaded'
  ): Promise<ImageData[]> => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await imageAPI.uploadImages(files, sessionId, type);
      const newImages = response.results.successful;
      
      setImages(prev => [...newImages, ...prev]);
      
      logger.info(`Uploaded ${newImages.length} images`);
      return newImages;
    } catch (error: any) {
      logger.error('Failed to upload images:', error);
      setError(error.message || 'Failed to upload images');
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 加载会话图片
  const loadSessionImages = useCallback(async (
    sessionId: string, 
    type?: 'uploaded' | 'generated'
  ) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await imageAPI.getSessionImages(sessionId, { type, limit: 100 });
      
      setImages(prev => {
        // 合并新图片，避免重复
        const existingIds = new Set(prev.map(img => img.id));
        const newImages = response.images.filter(img => !existingIds.has(img.id));
        return [...newImages, ...prev];
      });
      
      logger.info(`Loaded ${response.images.length} images for session ${sessionId}`);
    } catch (error: any) {
      logger.error('Failed to load session images:', error);
      setError(error.message || 'Failed to load session images');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 加载用户所有图片
  const loadUserImages = useCallback(async (type?: 'uploaded' | 'generated') => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await imageAPI.getUserImages({ type, limit: 1000 });
      setImages(response.images);
      
      logger.info(`Loaded ${response.images.length} user images`);
    } catch (error: any) {
      logger.error('Failed to load user images:', error);
      setError(error.message || 'Failed to load user images');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 删除图片
  const deleteImage = useCallback(async (imageId: string) => {
    try {
      setError(null);
      
      await imageAPI.deleteImage(imageId);
      
      setImages(prev => prev.filter(img => img.id !== imageId));
      
      logger.info(`Deleted image: ${imageId}`);
    } catch (error: any) {
      logger.error('Failed to delete image:', error);
      setError(error.message || 'Failed to delete image');
      throw error;
    }
  }, []);

  // 清理未引用图片
  const cleanupImages = useCallback(async () => {
    try {
      setError(null);
      
      const response = await imageAPI.cleanupImages();
      
      // 重新加载图片列表
      await loadUserImages();
      
      logger.info(`Cleaned up ${response.results.successful} images`);
    } catch (error: any) {
      logger.error('Failed to cleanup images:', error);
      setError(error.message || 'Failed to cleanup images');
      throw error;
    }
  }, [loadUserImages]);

  // 清除错误
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    images,
    uploadedImages,
    generatedImages,
    isLoading,
    error,
    uploadImage,
    uploadImages,
    loadSessionImages,
    loadUserImages,
    deleteImage,
    cleanupImages,
    clearError,
  };
};
