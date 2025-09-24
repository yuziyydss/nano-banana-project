import { createLogger } from '../utils/logger';
import { GPT_IMAGE1_API_BASE_URL } from './api';

const logger = createLogger('gptImage1Service');

export interface GptImage1EditRequest {
  instruction: string;
  originalImage: string; // data URL or raw b64
  referenceImages?: string[];
  maskImage?: string;
  size?: string; // e.g. "1024x1024"
  n?: number;
  quality?: 'high' | 'standard';
  mock?: boolean;
}

export interface GptImage1GenerationRequest {
  prompt: string;
  size?: string; // e.g. "1024x1024"
  n?: number;
  quality?: 'high' | 'standard';
  mock?: boolean;
}

export const gptImage1Service = {
  async editImage(req: GptImage1EditRequest): Promise<{ images: string[]; text?: string; _model: 'gpt-image-1' }> {
    try {
      const resp = await fetch(`${GPT_IMAGE1_API_BASE_URL}/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      });
      if (!resp.ok) throw new Error(`gpt-image-1 edit failed: ${resp.status}`);
      const data = await resp.json();
      return { images: data.images || [], text: data.text, _model: 'gpt-image-1' };
    } catch (e) {
      logger.error('gpt-image-1 edit failed', e);
      throw e;
    }
  },

  async generateImage(req: GptImage1GenerationRequest): Promise<{ images: string[]; text?: string; _model: 'gpt-image-1' }> {
    try {
      const resp = await fetch(`${GPT_IMAGE1_API_BASE_URL}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      });
      if (!resp.ok) throw new Error(`gpt-image-1 generate failed: ${resp.status}`);
      const data = await resp.json();
      return { images: data.images || [], text: data.text, _model: 'gpt-image-1' };
    } catch (e) {
      logger.error('gpt-image-1 generate failed', e);
      throw e;
    }
  },
};

export default gptImage1Service;