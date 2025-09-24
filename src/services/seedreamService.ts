import { createLogger } from '../utils/logger';

const logger = createLogger('seedreamService');
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

export interface GeneratePayload {
  prompt: string;
  referenceImages?: string[]; // base64 array (without data url prefix)
  size?: string; // e.g. '2K'
  max_images?: number;
  stream?: boolean;
}

export interface EditPayload {
  instruction: string;
  originalImage?: string; // base64 (without data url prefix)
  referenceImages?: string[]; // base64 array
  maskImage?: string; // base64
  size?: string;
  max_images?: number;
  stream?: boolean;
}

export const seedreamService = {
  async generateImage(req: GeneratePayload): Promise<{ images: string[]; text?: string }> {
    try {
      const token = localStorage.getItem('auth_token');

      const body: any = {
        prompt: req.prompt,
        referenceImages: req.referenceImages,
        size: req.size || '2K',
        max_images: req.max_images || 1,
        stream: false,
      };

      const resp = await fetch(`${API_BASE_URL}/seedream/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        } as any,
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${resp.status}`);
      }

      return await resp.json();
    } catch (e) {
      logger.error('seedream generate failed', e);
      throw e;
    }
  },

  async editImage(req: EditPayload): Promise<{ images: string[]; text?: string }> {
    try {
      const token = localStorage.getItem('auth_token');

      const body: any = {
        instruction: req.instruction,
        originalImage: req.originalImage,
        referenceImages: req.referenceImages,
        maskImage: req.maskImage,
        size: req.size || '2K',
        max_images: req.max_images || 1,
        stream: false,
      };

      const resp = await fetch(`${API_BASE_URL}/seedream/edit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        } as any,
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${resp.status}`);
      }

      return await resp.json();
    } catch (e) {
      logger.error('seedream edit failed', e);
      throw e;
    }
  },
};

export default seedreamService;