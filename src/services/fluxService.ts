import { createLogger } from '../utils/logger';

const logger = createLogger('fluxService');
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
// Only controlled by explicit env flag to allow switching in dev/prod
const USE_GET_MOCK = ['1', 'true', 'yes', 'on'].includes(String(import.meta.env.VITE_USE_GET_MOCK ?? '').toLowerCase());

export interface FluxEditRequest {
  instruction: string;
  originalImage: string; // base64 (no data url prefix)
  referenceImages?: string[]; // base64 array
  maskImage?: string; // base64
}

export interface FluxGenerationRequest {
  prompt: string;
  referenceImages?: string[]; // base64 array
}

function b64ToBlob(base64: string, type = 'image/png'): Blob {
  // base64 maybe raw or contains data:...;base64, prefix handled by backend; here we just make Blob for FormData
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type });
}

export const fluxService = {
  async editImage(req: FluxEditRequest): Promise<{ images: string[]; text?: string }> {
    try {
      const token = localStorage.getItem('auth_token');
      const form = new FormData();

      // text fields
      form.append('prompt', req.instruction);
      // match backend defaults; these are optional but harmless
      form.append('n', '1');
      form.append('size', '1152x896');
      form.append('output_format', 'png');

      // primary image
      form.append('image[]', b64ToBlob(req.originalImage), 'image.png');

      // reference images
      if (Array.isArray(req.referenceImages)) {
        req.referenceImages.forEach((img, i) => {
          if (!img) return;
          form.append('image[]', b64ToBlob(img), `ref_${i}.png`);
        });
      }

      // mask image
      if (req.maskImage) {
        form.append('mask', b64ToBlob(req.maskImage), 'mask.png');
      }

      const resp = await fetch(`${API_BASE_URL}/flux/edit`, {
        method: 'POST',
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
          // DO NOT set Content-Type; browser sets correct multipart boundary
        } as any,
        body: form,
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${resp.status}`);
      }
      return await resp.json();
    } catch (e) {
      logger.error('flux edit failed', e);
      throw e;
    }
  },

  async generateImage(req: FluxGenerationRequest): Promise<{ images: string[]; text?: string }> {
    try {
      const token = localStorage.getItem('auth_token');

      // Dev-only: use GET mock path to quickly unblock UI without JSON body issues
      if (USE_GET_MOCK) {
        const url = `${API_BASE_URL}/flux/generate?mock=1&prompt=${encodeURIComponent(req.prompt)}`;
        const resp = await fetch(url, {
          method: 'GET',
          headers: {
            ...(token && { Authorization: `Bearer ${token}` }),
            'x-mock': '1',
          } as any,
        });
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          throw new Error(err.error || `HTTP ${resp.status}`);
        }
        const data = await resp.json();
        return { images: Array.isArray(data?.images) ? data.images : [], text: undefined };
      }

      const body = {
        prompt: req.prompt,
        referenceImages: req.referenceImages,
        size: '1152x896',
      } as any;

      const resp = await fetch(`${API_BASE_URL}/flux/generate`, {
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
      logger.error('flux generate failed', e);
      throw e;
    }
  }
};