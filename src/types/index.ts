export interface Asset {
  id: string;
  type: 'original' | 'mask' | 'output';
  url: string;
  mime: string;
  width: number;
  height: number;
  checksum: string;
}

export interface Generation {
  id: string;
  prompt: string;
  parameters: {
    seed?: number;
    temperature?: number;
  };
  sourceAssets: Asset[];
  outputAssets: Asset[];
  modelVersion: string;
  timestamp: number;
  // 来自模型的文字响应（可选）
  responseText?: string;
  costEstimate?: number;
}

export interface Edit {
  id: string;
  parentGenerationId: string;
  maskAssetId?: string;
  maskReferenceAsset?: Asset;
  instruction: string;
  outputAssets: Asset[];
  // 新增：记录编辑使用的模型版本（用于历史缩略图徽章显示）
  modelVersion?: string;
  timestamp: number;
  // 来自模型的文字响应（可选）
  responseText?: string;
}

export interface Project {
  id: string;
  title: string;
  generations: Generation[];
  edits: Edit[];
  createdAt: number;
  updatedAt: number;
}

export interface SegmentationMask {
  id: string;
  imageData: ImageData;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  feather: number;
}

export interface BrushStroke {
  id: string;
  points: number[];
  brushSize: number;
  color: string;
}

export interface PromptHint {
  category: 'subject' | 'scene' | 'action' | 'style' | 'camera';
  text: string;
  example: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  text?: string;
  images?: string[];
  imageUrl?: string;
  timestamp: number;
  mode?: 'generate' | 'edit' | 'mask';
  parameters?: {
    temperature?: number;
    seed?: number;
  };
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}