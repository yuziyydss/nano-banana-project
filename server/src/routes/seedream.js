import 'dotenv/config';
import express from 'express';
import axios from 'axios';

const router = express.Router();

// SeeDream 4.0 (Volcengine) configuration aligned with seedream.py
const BASE_URL = process.env.SEEDREAM4_BASE_URL || process.env.SEEDREAM_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3/images/generations';
const API_KEY = process.env.SEEDREAM4_API_KEY || process.env.SEEDREAM_API_KEY || process.env.VOLCENGINE_API_KEY || '';
const DEFAULT_MODEL = process.env.SEEDREAM_MODEL_ID || 'doubao-seedream-4-0-250828';

function ensureDataUrl(b64OrUrl) {
  if (!b64OrUrl) return null;
  if (typeof b64OrUrl !== 'string') return null;
  if (b64OrUrl.startsWith('http://') || b64OrUrl.startsWith('https://')) return b64OrUrl;
  if (b64OrUrl.startsWith('data:')) return b64OrUrl;
  // assume raw base64
  return `data:image/png;base64,${b64OrUrl}`;
}

function extractImagesFromBody(body) {
  const images = [];
  if (!body) return images;
  const { originalImage, referenceImages } = body;
  if (originalImage) {
    const v = ensureDataUrl(originalImage);
    if (v) images.push(v);
  }
  if (Array.isArray(referenceImages)) {
    for (const img of referenceImages) {
      const v = ensureDataUrl(img);
      if (v) images.push(v);
    }
  }
  return images;
}

function normalizeImagesFromResponse(data) {
  const out = [];
  if (!data) return out;
  if (Array.isArray(data.data)) {
    for (const item of data.data) {
      if (item?.b64_json) {
        out.push(item.b64_json);
      } else if (item?.url) {
        out.push(item.url);
      } else if (item?.image_base64) {
        out.push(item.image_base64);
      }
    }
  }
  return out;
}

function buildPayload({ prompt, size, max_images, stream, images }) {
  return {
    model: DEFAULT_MODEL, // same default as seedream.py
    prompt,
    sequential_image_generation: 'auto',
    sequential_image_generation_options: {
      max_images: Math.max(1, Math.min(3, max_images || 1)),
    },
    response_format: 'b64_json', // return base64 so frontend can render directly
    size: size || '2K',
    stream: Boolean(stream),
    watermark: false,
    ...(images && images.length > 0 ? { image: images } : {}),
  };
}

async function callSeeDream(payload) {
  const resp = await axios.post(BASE_URL, payload, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    timeout: 60_000,
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  });
  return resp.data;
}

// GET is not supported for real generation (kept to guide clients)
router.get('/generate', (_req, res) => {
  return res.status(405).json({ error: 'Method not allowed', message: 'Use POST /seedream/generate with JSON body' });
});

router.post('/generate', async (req, res) => {
  try {
    const { prompt, size, max_images, stream } = (req.body || {});
    if (!prompt) return res.status(400).json({ error: 'prompt is required' });
    if (!API_KEY) return res.status(400).json({ error: 'Missing SEEDREAM_API_KEY/SEEDREAM4_API_KEY' });

    const images = extractImagesFromBody(req.body);
    const payload = buildPayload({ prompt, size, max_images, stream: false, images });

    const data = await callSeeDream(payload);
    const b64s = normalizeImagesFromResponse(data);
    return res.json({ images: b64s });
  } catch (err) {
    const status = err?.response?.status;
    const body = err?.response?.data;
    console.error('SEEDREAM generate failed:', status, body || err.message);
    const message = body?.error?.message || body?.message || err.message || 'SEEDREAM generate failed';
    return res.status(500).json({ error: message });
  }
});

router.post('/edit', async (req, res) => {
  try {
    const { instruction, size, max_images, stream } = (req.body || {});
    if (!instruction) return res.status(400).json({ error: 'instruction is required' });
    if (!API_KEY) return res.status(400).json({ error: 'Missing SEEDREAM_API_KEY/SEEDREAM4_API_KEY' });

    const images = extractImagesFromBody(req.body);
    if (images.length === 0) return res.status(400).json({ error: 'originalImage or referenceImages required' });

    const payload = buildPayload({ prompt: instruction, size, max_images, stream: false, images });

    const data = await callSeeDream(payload);
    const b64s = normalizeImagesFromResponse(data);
    return res.json({ images: b64s });
  } catch (err) {
    const status = err?.response?.status;
    const body = err?.response?.data;
    console.error('SEEDREAM edit failed:', status, body || err.message);
    const message = body?.error?.message || body?.message || err.message || 'SEEDREAM edit failed';
    return res.status(500).json({ error: message });
  }
});

export default router;