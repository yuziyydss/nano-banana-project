import 'dotenv/config';
import express from 'express';
import axios from 'axios';
import FormData from 'form-data';

const router = express.Router();

// 从环境变量读取 Azure FLUX 配置（兼容 AZURE_FLUX_* 与 AZURE_OPENAI_* 命名）
const RAW_ENDPOINT = process.env.AZURE_FLUX_ENDPOINT || process.env.AZURE_OPENAI_ENDPOINT || 'https://user12-3649-flux-kontex-resource.services.ai.azure.com/';
const ENDPOINT = RAW_ENDPOINT.endsWith('/') ? RAW_ENDPOINT : `${RAW_ENDPOINT}/`;
const DEPLOYMENT = process.env.AZURE_FLUX_DEPLOYMENT || process.env.AZURE_OPENAI_DEPLOYMENT || 'FLUX.1-Kontext-pro';
const API_VERSION = process.env.AZURE_FLUX_API_VERSION || process.env.AZURE_OPENAI_API_VERSION || '2025-04-01-preview';
const API_KEY = process.env.AZURE_FLUX_API_KEY || process.env.AZURE_OPENAI_API_KEY || '';
const MOCK = process.env.MOCK_FLUX === '1';

// 仅由显式环境变量控制是否 mock（不再因为缺少 API Key 自动 mock）
function shouldMock() {
  return process.env.MOCK_FLUX === '1';
}

// 一个 1x1 透明 PNG 的 base64（便于本地联调展示）
const PLACEHOLDER_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==';

function isTruthy(v) {
  if (v === undefined || v === null) return false;
  const s = String(v).toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'y' || s === 'on';
}

function parseBase64(input) {
  // 支持 data:[mime];base64,XXXX 或纯 b64 字符串
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

router.post('/edit', async (req, res) => {
  try {
    const useMock = shouldMock() || isTruthy(req.query.mock) || isTruthy(req.headers['x-mock']) || isTruthy(req.body?.mock);
    if (useMock) {
      return res.json({ images: [PLACEHOLDER_B64] });
    }

    // 显式关闭 mock 后，若缺少密钥则直接报错
    const apiKeyNow = process.env.AZURE_FLUX_API_KEY || process.env.AZURE_OPENAI_API_KEY || API_KEY;
    if (!apiKeyNow) {
      return res.status(400).json({ error: 'Missing Azure FLUX API key (AZURE_FLUX_API_KEY or AZURE_OPENAI_API_KEY) while mock is disabled' });
    }

    const { instruction, originalImage, referenceImages = [], maskImage, size = '1152x896' } = req.body || {};
    if (!instruction || !originalImage) {
      return res.status(400).json({ error: 'instruction and originalImage are required' });
    }

    const form = new FormData();

    // 文本字段
    form.append('prompt', instruction);
    form.append('n', '1');
    form.append('size', size);
    form.append('output_format', 'png');

    // 原图与参考图，按照 OpenAI 兼容接口用 image[] 追加
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

    const url = `${ENDPOINT}openai/deployments/${DEPLOYMENT}/images/edits?api-version=${API_VERSION}`;

    const resp = await axios.post(url, form, {
      headers: {
        ...form.getHeaders(),
        'api-key': apiKeyNow,
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });

    const images = (resp.data?.data || []).map((d) => d?.b64_json).filter(Boolean);
    return res.json({ images });
  } catch (err) {
    console.error('FLUX edit failed:', err?.response?.data || err.message);
    const message = err?.response?.data?.error?.message || err.message || 'FLUX edit failed';
    return res.status(500).json({ error: message });
  }
});

router.get('/generate', async (req, res) => {
  try {
    const useMock = shouldMock() || isTruthy(req.query.mock) || isTruthy(req.headers['x-mock']);
    const prompt = req.query.prompt;

    if (useMock) {
      return res.json({ images: [PLACEHOLDER_B64], prompt });
    }

    return res.status(405).json({ error: 'Method not allowed', message: 'Use POST with JSON body for real generation' });
  } catch (err) {
    console.error('FLUX generate(GET) failed:', err?.message || err);
    return res.status(500).json({ error: 'Internal server error', message: err?.message || 'GET generate failed' });
  }
});
router.post('/generate', async (req, res) => {
  try {
    const useMock = shouldMock() || isTruthy(req.query.mock) || isTruthy(req.headers['x-mock']) || isTruthy(req.body?.mock);
    if (useMock) {
      return res.json({ images: [PLACEHOLDER_B64] });
    }

    // 显式关闭 mock 后，若缺少密钥则直接报错
    const apiKeyNow = process.env.AZURE_FLUX_API_KEY || process.env.AZURE_OPENAI_API_KEY || API_KEY;
    if (!apiKeyNow) {
      return res.status(400).json({ error: 'Missing Azure FLUX API key (AZURE_FLUX_API_KEY or AZURE_OPENAI_API_KEY) while mock is disabled' });
    }

    const { prompt, size = '1152x896', n = 1, output_format = 'png' } = req.body || {};
    if (!prompt) {
      return res.status(400).json({ error: 'prompt is required' });
    }

    // Azure Images Generations 接口使用 JSON 请求体
    const url = `${ENDPOINT}openai/deployments/${DEPLOYMENT}/images/generations?api-version=${API_VERSION}`;
    const body = {
      prompt,
      n,
      size,
      // 在部署路径下，通常不强制要求传 model，但为兼容性保留
      model: DEPLOYMENT,
      output_format,
    };

    const resp = await axios.post(url, body, {
      headers: {
        'api-key': apiKeyNow,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });

    const images = (resp.data?.data || []).map((d) => d?.b64_json).filter(Boolean);
    return res.json({ images });
  } catch (err) {
    console.error('FLUX generate failed:', err?.response?.data || err.message, {
      MOCK_FLUX: process.env.MOCK_FLUX,
      hasKey: Boolean(process.env.AZURE_FLUX_API_KEY || process.env.AZURE_OPENAI_API_KEY || API_KEY),
    });
    const message = err?.response?.data?.error?.message || err.message || 'FLUX generate failed';
    return res.status(500).json({ error: message });
  }
});
export default router;