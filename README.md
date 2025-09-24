# 🍌 Nano Banana AI Image Editor 
Release Version: (v1.0)

### **⏬ Get Your 1-Click Install Copy!** 
Join the [Vibe Coding is Life Skool Community](https://www.skool.com/vibe-coding-is-life/about?ref=456537abaf37491cbcc6976f3c26af41) and get a **1-click ⚡Bolt.new installation clone**  of this app, plus access to live build sessions, exclusive project downloads, AI prompts, masterclasses, and the best vibe coding community on the web!

---

**Professional AI Image Generation & Conversational Editing Platform**

A production-ready React + TypeScript application for delightful image generation and conversational, region-aware revisions using Google's Gemini 2.5 Flash Image model. Built with modern web technologies and designed for both creators and developers.

[![Nano Banana Image Editor](https://getsmartgpt.com/nano-banana-editor.jpg)](https://nanobananaeditor.dev)

🍌 [Try the LIVE Demo](https://nanobananaeditor.dev)

## ✨ Key Features

### 🎨 **AI-Powered Creation**
- **Text-to-Image Generation** - Create stunning images from descriptive prompts
- **Live Quality Tips** - Real-time feedback to improve your prompts
- **Reference Image Support** - Use up to 2 reference images to guide generation
- **Advanced Controls** - Fine-tune creativity levels and use custom seeds

### ✏️ **Intelligent Editing**
- **Conversational Editing** - Modify images using natural language instructions
- **Region-Aware Selection** - Paint masks to target specific areas for editing
- **Style Reference Images** - Upload reference images to guide editing style
- **Non-Destructive Workflow** - All edits preserve the original image

### 🖼️ **Professional Canvas**
- **Interactive Canvas** - Zoom, pan, and navigate large images smoothly
- **Brush Tools** - Variable brush sizes for precise mask painting
- **Mobile Optimized** - Responsive design that works beautifully on all devices
- **Keyboard Shortcuts** - Efficient workflow with hotkeys

### 📚 **Project Management**
- **Generation History** - Track all your creations and edits
- **Variant Comparison** - Generate and compare multiple versions side-by-side
- **Full Undo/Redo** - Complete generation tree with branching history
- **Asset Management** - Organized storage of all generated content

### 🔒 **Enterprise Features**
- **SynthID Watermarking** - Built-in AI provenance with invisible watermarks
- **Offline Caching** - IndexedDB storage for offline asset access
- **Type Safety** - Full TypeScript implementation with strict typing
- **Performance Optimized** - React Query for efficient state management

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- A [Google AI Studio](https://aistudio.google.com/) API key

### Installation

1. **Clone and install dependencies**:
   ```bash
   git clone <repository-url>
   cd nano-banana-image-editor
   npm install
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   # Add your Gemini API key to VITE_GEMINI_API_KEY
   ```

3. **Start development server**:
   ```bash
   npm run dev
   ```

4. **Open in browser**: Navigate to `http://localhost:5173`

## 🎯 Usage Guide

### Creating Images
1. Select **Generate** mode
2. Write a detailed prompt describing your desired image
3. Optionally upload reference images (max 2)
4. Adjust creativity settings if needed
5. Click **Generate** or press `Cmd/Ctrl + Enter`

### Editing Images
1. Switch to **Edit** mode
2. Upload an image or use a previously generated one
3. Optionally paint a mask to target specific areas
4. Describe your desired changes in natural language
5. Click **Apply Edit** to see the results

### Advanced Workflows
- Use **Select** mode to paint precise masks for targeted edits
- Compare variants in the History panel
- Download high-quality PNG outputs
- Use keyboard shortcuts for efficient navigation

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + Enter` | Generate/Apply Edit |
| `Shift + R` | Re-roll variants |
| `E` | Switch to Edit mode |
| `G` | Switch to Generate mode |
| `M` | Switch to Select mode |
| `H` | Toggle history panel |
| `P` | Toggle prompt panel |

## 🏗️ Architecture

### Tech Stack
- **Frontend**: React 18, TypeScript, Tailwind CSS
- **State Management**: Zustand for app state, React Query for server state  
- **Canvas**: Konva.js for interactive image display and mask overlays
- **AI Integration**: Google Generative AI SDK (Gemini 2.5 Flash Image)
- **Storage**: IndexedDB for offline asset caching
- **Build Tool**: Vite for fast development and optimized builds

### Project Structure
```
src/
├── components/          # React components
│   ├── ui/             # Reusable UI components (Button, Input, etc.)
│   ├── PromptComposer.tsx  # Prompt input and tool selection
│   ├── ImageCanvas.tsx     # Interactive canvas with Konva
│   ├── HistoryPanel.tsx    # Generation history and variants
│   ├── Header.tsx          # App header and navigation
│   └── InfoModal.tsx       # About modal with links
├── services/           # External service integrations
│   ├── geminiService.ts    # Gemini API client
│   ├── cacheService.ts     # IndexedDB caching layer
│   └── imageProcessing.ts  # Image manipulation utilities
├── store/              # Zustand state management
│   └── useAppStore.ts      # Global application state
├── hooks/              # Custom React hooks
│   ├── useImageGeneration.ts  # Generation and editing logic
│   └── useKeyboardShortcuts.ts # Keyboard navigation
├── utils/              # Utility functions
│   ├── cn.ts              # Class name utility
│   └── imageUtils.ts      # Image processing helpers
└── types/              # TypeScript type definitions
    └── index.ts           # Core type definitions
```

## 🔧 Configuration

### Environment Variables
```bash
VITE_GEMINI_API_KEY=your_gemini_api_key_here
```

### Model Configuration
- **Model**: `gemini-2.5-flash-image-preview`
- **Output Format**: 1024×1024 PNG with SynthID watermarks
- **Input Formats**: PNG, JPEG, WebP
- **Temperature Range**: 0-1 (0 = deterministic, 1 = creative)

## 🚀 Deployment

### Development
```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # Run ESLint
```

### Production Considerations
- **API Security**: Implement backend proxy for API calls in production
- **Rate Limiting**: Add proper rate limiting and usage quotas
- **Authentication**: Consider user authentication for multi-user deployments
- **Storage**: Set up cloud storage for generated assets
- **Monitoring**: Add error tracking and analytics

## 📄 License & Copyright

**Copyright © 2025 [Mark Fulton](https://markfulton.com)**

This project is licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0).

### What this means:
- ✅ **Free to use** for personal and commercial projects
- ✅ **Modify and distribute** with proper attribution
- ⚠️ **Share modifications** - Any changes must be shared under the same license
- ⚠️ **Network use** - If you run this as a web service, you must provide source code

See the [LICENSE](LICENSE) file for full details.

## 🤝 Contributing

We welcome contributions! Please:

1. **Follow the established patterns** - Keep components under 200 lines
2. **Maintain type safety** - Use TypeScript strictly with proper definitions
3. **Test thoroughly** - Ensure keyboard navigation and accessibility
4. **Document changes** - Update README and add inline comments
5. **Respect the license** - All contributions will be under AGPL-3.0

## 🔗 Links & Resources

- **Creator**: [Mark Fulton](https://markfulton.com)
- **AI Training Program**: [Reinventing.AI](https://www.reinventing.ai/)
- **Community**: [Vibe Coding is Life Skool](https://www.skool.com/vibe-coding-is-life/about?ref=456537abaf37491cbcc6976f3c26af41)
- **Google AI Studio**: [Get your API key](https://aistudio.google.com/)
- **Gemini API Docs**: [Official Documentation](https://ai.google.dev/gemini-api/docs)

## 🐛 Known Issues & Limitations

- **Client-side API calls** - Currently uses direct API calls (implement backend proxy for production)
- **Browser compatibility** - Requires modern browsers with Canvas and WebGL support
- **Rate limits** - Subject to Google AI Studio rate limits
- **Image size** - Optimized for 1024×1024 outputs (Gemini model output dimensions may vary)

## 🎯 Suggested Updates

- [ ] Backend API proxy implementation
- [ ] User authentication and project sharing
- [ ] Advanced brush tools and selection methods
- [ ] Plugin system for custom filters
- [ ] Integration with cloud storage providers

---

**Built by [Mark Fulton](https://markfulton.com)** | **Powered by Gemini 2.5 Flash Image** | **Made with Bolt.new**

## 🆕 Backend Integration and Multi-Provider Support

This project now includes a Node.js/Express backend proxy with three image models, all exposed under /api via Vite proxy:

- Azure OpenAI gpt-image-1: high-quality text-to-image and image editing
- Azure FLUX: fast and flexible image generations and edits
- SeeDream 4.0 (Volcengine): powerful multi-image generation with b64_json output

The frontend model switch lets you choose among gpt-image-1, flux, and seedream right in the UI.

### Dev Quick Start (Backend + Frontend)

1) Backend (server)
- Configure environment:
  - Copy server/.env from server/env.example (or create server/.env) and fill provider keys
- Install and run
  ```bash
  cd server
  npm install
  npm run dev
  ```
  This starts the backend on http://localhost:3001

2) Frontend (root)
```bash
npm install
npm run dev
```
Open the URL shown by Vite (e.g., http://localhost:5173 or 5176). Requests to /api/* are proxied to the backend.

### API Endpoints

All endpoints return base64 images in { images: string[] }.

- gpt-image-1 (Azure OpenAI)
  - POST /api/gpt-image-1/generate
    - Body (JSON): { prompt: string, n?: number, size?: string, quality?: 'high'|'standard', output_format?: 'png' }
  - POST /api/gpt-image-1/edit
    - Body (JSON): { instruction: string, originalImage: base64|dataURL, referenceImages?: (base64|dataURL)[], maskImage?: base64|dataURL, n?: number, size?: string, quality?: string }

- FLUX (Azure)
  - POST /api/flux/generate
    - Body (JSON): { prompt: string, n?: number, size?: string, output_format?: 'png' }
  - POST /api/flux/edit
    - Body (JSON): { instruction: string, originalImage: base64|dataURL, referenceImages?: (base64|dataURL)[], maskImage?: base64|dataURL, size?: string }

- SeeDream 4.0 (Volcengine)
  - POST /api/seedream/generate
    - Body (JSON): { prompt: string, size?: string, max_images?: number, stream?: boolean, originalImage?: base64|dataURL, referenceImages?: (base64|dataURL)[] }
  - POST /api/seedream/edit
    - Body (JSON): { instruction: string, originalImage?: base64|dataURL, referenceImages?: (base64|dataURL)[], size?: string, max_images?: number }

Note: GET /api/flux/generate and /api/seedream/generate are not for real generations; use POST with JSON body.

### Server Environment Variables (server/.env)

Do NOT commit secrets. Ensure server/.env is gitignored (already configured).

Core
```env
PORT=3001
CORS_ORIGIN=http://localhost:5173
ALLOW_NO_REDIS=1
DISABLE_AUTH=1
```

Azure OpenAI (gpt-image-1)
```env
AZURE_OPENAI_ENDPOINT=
AZURE_OPENAI_API_KEY=
# optional override names
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-image-1
AZURE_OPENAI_DEPLOYMENT=gpt-image-1
AZURE_OPENAI_API_VERSION=2025-03-01-preview
AZURE_OPENAI_API_VERSION_EDITS=2025-04-01-preview
# mock switch (for local demo without calling the API)
MOCK_GPT_IMAGE_1=0
```

Azure FLUX
```env
AZURE_FLUX_ENDPOINT=
AZURE_FLUX_DEPLOYMENT=
AZURE_FLUX_API_VERSION=2025-04-01-preview
AZURE_FLUX_API_KEY=
# mock switch (disabled by default)
MOCK_FLUX=0
```

SeeDream 4.0
```env
SEEDREAM4_BASE_URL=https://ark.cn-beijing.volces.com/api/v3/images/generations
SEEDREAM4_API_KEY=
SEEDREAM_MODEL_ID=doubao-seedream-4-0-250828
```

### Model Switching in the UI

- Use the model dropdown in the header to choose gpt-image-1, flux, or seedream.
- The app routes requests to the corresponding backend endpoint and renders base64 results.

### Troubleshooting

- 401/403 Unauthorized: Check your provider API keys in server/.env and service subscription/region.
- 405 Method Not Allowed: Use POST with JSON body for /api/*/generate.
- 500 Internal Error: See server terminal logs (nodemon restarts automatically on code changes).
- CORS or network errors: Ensure CORS_ORIGIN matches the Vite URL and Vite proxy forwards /api to http://localhost:3001.
- Mocking: You can set MOCK_FLUX=1 or MOCK_GPT_IMAGE_1=1 to return a 1x1 placeholder image for UI testing without hitting providers.
