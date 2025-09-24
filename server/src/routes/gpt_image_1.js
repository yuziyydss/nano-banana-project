import 'dotenv/config';
import express from 'express';
import axios from 'axios';
import FormData from 'form-data';

const router = express.Router();

// Azure OpenAI gpt-image-1 配置（与 gpt_image_1.py 对齐）
const RAW_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT || '';
const ENDPOINT = RAW_ENDPOINT.endsWith('/') ? RAW_ENDPOINT : `${RAW_ENDPOINT}/`;
const DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT_NAME || process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-image-1';
const API_VERSION_GENERATE = process.env.AZURE_OPENAI_API_VERSION || '2025-03-01-preview';
const API_VERSION_EDITS = process.env.AZURE_OPENAI_API_VERSION_EDITS || '2025-04-01-preview';
const API_KEY = process.env.AZURE_OPENAI_API_KEY || '';

function shouldMock(req) {
  const any = (v) => {
    if (v === undefined || v === null) return false;
    const s = String(v).toLowerCase();
    return s === '1' || s === 'true' || s === 'yes' || s === 'y' || s === 'on';
  };
  return any(process.env.MOCK_GPT_IMAGE_1) || any(req?.query?.mock) || any(req?.headers?.['x-mock']) || any(req?.body?.mock);
}

const PLACEHOLDER_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==';

function parseBase64(input) {
  let mime = 'image/png';
  let b64 = input;
  if (typeof input === 'string' && input.startsWith('data:')) {
    const [head, body] = input.split('base64,');
    b64 = body;
    const m = /data:(.*?);base64/.exec(head);
    if (m && m[1]) mime = m[1];
  }
  return { buffer: Buffer.from(b64, 'base64'), mime };
}

router.post('/generate', async (req, res) => {
  try {
    if (shouldMock(req)) return res.json({ images: [PLACEHOLDER_B64] });

    if (!RAW_ENDPOINT) return res.status(400).json({ error: 'Missing AZURE_OPENAI_ENDPOINT' });
    if (!API_KEY) return res.status(400).json({ error: 'Missing AZURE_OPENAI_API_KEY' });
    if (!DEPLOYMENT) return res.status(400).json({ error: 'Missing AZURE_OPENAI_DEPLOYMENT_NAME' });

    const { prompt, size = '1024x1024', n = 1, quality = 'high', output_format = 'png' } = req.body || {};
    if (!prompt) return res.status(400).json({ error: 'prompt is required' });

    const url = `${ENDPOINT}openai/deployments/${DEPLOYMENT}/images/generations?api-version=${API_VERSION_GENERATE}`;
    const body = { prompt, n, size, quality, model: DEPLOYMENT, output_format };

    const resp = await axios.post(url, body, {
      headers: {
        'api-key': API_KEY,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });

    const images = (resp.data?.data || []).map((d) => d?.b64_json).filter(Boolean);
    return res.json({ images });
  } catch (err) {
    console.error('gpt-image-1 generate failed:', err?.response?.data || err.message);
    const message = err?.response?.data?.error?.message || err.message || 'gpt-image-1 generate failed';
    return res.status(500).json({ error: message });
  }
});

router.post('/edit', async (req, res) => {
  try {
    if (shouldMock(req)) return res.json({ images: [PLACEHOLDER_B64] });

    if (!RAW_ENDPOINT) return res.status(400).json({ error: 'Missing AZURE_OPENAI_ENDPOINT' });
    if (!API_KEY) return res.status(400).json({ error: 'Missing AZURE_OPENAI_API_KEY' });
    if (!DEPLOYMENT) return res.status(400).json({ error: 'Missing AZURE_OPENAI_DEPLOYMENT_NAME' });

    const { instruction, originalImage, referenceImages = [], maskImage, size = '1024x1024', n = 1, quality = 'high' } = req.body || {};
    if (!instruction || !originalImage) return res.status(400).json({ error: 'instruction and originalImage are required' });

    const form = new FormData();
    form.append('prompt', instruction);
    form.append('n', String(n));
    form.append('size', size);
    form.append('output_format', 'png');
    if (quality) form.append('quality', quality);

    const { buffer: origBuf, mime: origMime } = parseBase64(originalImage);
    form.append('image[]', origBuf, { filename: 'image.png', contentType: origMime });

    if (Array.isArray(referenceImages)) {
      referenceImages.forEach((img, i) => {
        if (!img) return;
        const { buffer, mime } = parseBase64(img);
        form.append('image[]', buffer, { filename: `ref_${i}.png`, contentType: mime });
      });
    }

    if (maskImage) {
      const { buffer: maskBuf, mime } = parseBase64(maskImage);
      form.append('mask', maskBuf, { filename: 'mask.png', contentType: mime });
    }

    const url = `${ENDPOINT}openai/deployments/${DEPLOYMENT}/images/edits?api-version=${API_VERSION_EDITS}`;

    const resp = await axios.post(url, form, {
      headers: {
        ...form.getHeaders(),
        'api-key': API_KEY,
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });

    const images = (resp.data?.data || []).map((d) => d?.b64_json).filter(Boolean);
    return res.json({ images });
  } catch (err) {
    console.error('gpt-image-1 edit failed:', err?.response?.data || err.message);
    const message = err?.response?.data?.error?.message || err.message || 'gpt-image-1 edit failed';
    return res.status(500).json({ error: message });
  }
});

export default router;