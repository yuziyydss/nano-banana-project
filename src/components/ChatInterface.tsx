import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useImageGeneration } from '../hooks/useImageGeneration';
import { Button } from './ui/Button';
import { Textarea } from './ui/Textarea';
import { Trash2, RotateCcw, Settings, Download, Square, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { blobToBase64 } from '../utils/imageUtils';
import { cn } from '../utils/cn';
import { Message } from '../types';

export const ChatInterface: React.FC = () => {
  const {
    currentPrompt,
    setCurrentPrompt,
    temperature,
    setTemperature,
    seed,
    setSeed,
    isGenerating,
    uploadedImages,
    addUploadedImage,
    removeUploadedImage,
    updateUploadedImage,
    clearUploadedImages,
    // canvasImage 仅用于旧逻辑，已不再参与上下文
    clearBrushStrokes,
    currentProject,
    // Chat session management
    chatSessions,
    currentSessionId,
    createNewSession,
    switchToSession,
    deleteSession,
    addMessageToCurrentSession,
    getCurrentSession,
  } = useAppStore();

  const { generate } = useImageGeneration();

  // 从当前会话获取消息，如果没有会话则显示空数组
  const currentSession = getCurrentSession();
  const messages = useMemo(() => currentSession?.messages || [], [currentSession]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [showDownloadButton, setShowDownloadButton] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [allGeneratedImages, setAllGeneratedImages] = useState<{ url: string; title: string; timestamp: number }[]>([]);
  const [allUploadedImages, setAllUploadedImages] = useState<{ url: string; title: string; timestamp: number }[]>([]);
  const [previewSource, setPreviewSource] = useState<'generated' | 'uploaded'>('generated');

  // 上传图片编辑器状态
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorIndex, setEditorIndex] = useState<number | null>(null);
  // 当前编辑图片源（可用于后续扩展保存原图），暂不直接使用
  const [editorSrc, setEditorSrc] = useState<string>('');
  const [editorAspect, setEditorAspect] = useState<'original' | '1:1' | '4:3' | '3:4' | '16:9' | '9:16'>('original');
  const [editorRotation, setEditorRotation] = useState<number>(0); // 0/90/180/270
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  // 工具与视图
  const [tool, setTool] = useState<'pan'|'pen'|'erase'|'mark'|'crop'|'text'|'none'>('none');
  const [penColor, setPenColor] = useState<string>('#ff0000');
  const [penSize, setPenSize] = useState<number>(6);
  const [viewScale, setViewScale] = useState<number>(1);
  const [viewPan, setViewPan] = useState<{x:number;y:number}>({x:0,y:0});
  const editorCanvasRef = useRef<HTMLCanvasElement>(null);
  const editorDrawCanvasRef = useRef<HTMLCanvasElement>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const editorImgRef = useRef<HTMLImageElement | null>(null);
  const isDrawingRef = useRef(false);
  const viewPanStartRef = useRef<{x:number;y:number;ox:number;oy:number}|null>(null);

  // 涂鸦与文本、标记框
  type Path = { mode:'draw'|'erase'; color:string; size:number; points:{x:number;y:number}[] };
  const [paths, setPaths] = useState<Path[]>([]);
  const [texts, setTexts] = useState<{x:number;y:number;text:string;color:string;size:number}[]>([]);
  const [markColor, setMarkColor] = useState<string>('#00a3ff');
  const [marks, setMarks] = useState<{x:number;y:number;w:number;h:number;color:string}[]>([]);
  const markDraftRef = useRef<{startX:number;startY:number;active:boolean}>({startX:0,startY:0,active:false});
  // 裁剪框（以主显示画布尺寸为坐标系）
  const [cropRect] = useState<{x:number;y:number;w:number;h:number} | null>(null);
  // 预览增强：缩放、平移、尺寸信息
  const [previewZoom, setPreviewZoom] = useState(1);
  const [previewOffset, setPreviewOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number; y: number; originX: number; originY: number } | null>(null);
  const [previewNatural, setPreviewNatural] = useState<{ width: number; height: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isPasting, setIsPasting] = useState(false);
  const [pasteSuccess, setPasteSuccess] = useState(false);
  const [showPasteHint, setShowPasteHint] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingPrompt, setEditingPrompt] = useState('');
  // 防止旧会话生成结果被同步到新会话：记录已同步到聊天的生成/编辑ID
  const syncedGenerationIdsRef = useRef<Set<string>>(new Set());
  const syncedEditIdsRef = useRef<Set<string>>(new Set());

  const fileInputRef = useRef<HTMLInputElement>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  const maxImages = 10;

  // 确保总是有一个活动的会话
  useEffect(() => {
    if (chatSessions.length === 0 || !currentSessionId) {
      createNewSession();
    }
  }, [chatSessions.length, currentSessionId, createNewSession]);

  // 保持输入框固定高度
  const autoResizePrompt = () => {
    // 不再自动调整高度，保持固定60px高度
    const el = promptRef.current;
    if (!el) return;
    el.style.height = '60px';
  };

  // 滚动到底部
  const scrollToBottom = () => {
    const el = chatRef.current;
    if (!el) return;
    try {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    } catch {
      el.scrollTop = el.scrollHeight;
    }
  };

  // 生成消息ID
  const createId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // 处理图片文件的通用函数
  const processImageFiles = useCallback(async (files: File[]) => {
    if (!files.length) return false;

    const remain = Math.max(0, maxImages - uploadedImages.length);
    if (remain === 0) return false;
    
    const selected = files.slice(0, remain);
    let processed = 0;

    for (const file of selected) {
      if (file.type.startsWith('image/')) {
        try {
          const base64 = await blobToBase64(file);
          const dataUrl = `data:${file.type};base64,${base64}`;
            addUploadedImage(dataUrl);
          processed++;
        } catch (error) {
          console.error('Failed to upload image:', error);
        }
      }
    }
    
    return processed > 0;
  }, [uploadedImages.length, maxImages, addUploadedImage]);

  // 处理文件选择上传
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    await processImageFiles(files);
    event.target.value = '';
  };

  // 处理复制粘贴上传
  const handlePaste = useCallback(async (event: ClipboardEvent) => {
    console.log('粘贴事件触发', event.clipboardData);
    
    if (!event.clipboardData) {
      console.log('无剪贴板数据');
      return false;
    }

    const items = Array.from(event.clipboardData.items || []);
    const files = Array.from(event.clipboardData.files || []);
    
    console.log('剪贴板items:', items.map(item => ({ kind: item.kind, type: item.type })));
    console.log('剪贴板files:', files.map(file => ({ name: file.name, type: file.type, size: file.size })));

    const imageFiles: File[] = [];
    let foundImages = false;

    // 优先使用 files 数组，这是最可靠的方法
    for (const file of files) {
      if (file.type.startsWith('image/')) {
        console.log('通过files数组找到图片:', file);
        imageFiles.push(file);
        foundImages = true;
      }
    }

    // 如果 files 数组为空，则检查 items
    if (!foundImages) {
      for (const item of items) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const file = item.getAsFile();
          console.log('通过item获取到文件:', file);
          if (file) {
            imageFiles.push(file);
            foundImages = true;
          }
        }
      }
    }

    console.log('最终找到的图片文件:', imageFiles.length);

    if (foundImages && imageFiles.length > 0) {
      event.preventDefault();
      
      // 显示粘贴处理动画
      setIsPasting(true);
      
      try {
        const success = await processImageFiles(imageFiles);
        
        if (success) {
          // 显示成功动画
          setPasteSuccess(true);
          setTimeout(() => setPasteSuccess(false), 2000);
        } else {
          console.log('处理图片失败');
        }
      } catch (error) {
        console.error('粘贴图片失败:', error);
      } finally {
        setIsPasting(false);
      }
      
      return true; // 表示已处理图片
    } else {
      console.log('未找到图片文件');
      return false; // 表示未处理图片，可以继续文本粘贴
    }
  }, [processImageFiles]);

  // 监听全局复制粘贴事件（仅处理非输入框区域的粘贴）
  useEffect(() => {
    const handleGlobalPaste = (event: ClipboardEvent) => {
      console.log('全局粘贴事件触发');
      
      // 检查是否在输入框或其他可编辑元素中
      const target = event.target as HTMLElement;
      
      // 如果是在输入框中，不处理（让输入框的onPaste事件处理）
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
        console.log('在输入框中，由输入框处理粘贴');
        return;
      }
      
      console.log('在非输入区域粘贴，重定向到输入框处理');
      // 将焦点移到输入框并处理粘贴
      if (promptRef.current) {
        promptRef.current.focus();
        handlePaste(event);
      }
    };

    document.addEventListener('paste', handleGlobalPaste);
    return () => document.removeEventListener('paste', handleGlobalPaste);
  }, [handlePaste]);

  // 监听键盘事件显示粘贴提示
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key === 'v') {
        setShowPasteHint(true);
        setTimeout(() => setShowPasteHint(false), 1000);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 处理拖拽上传
  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);

    const files = Array.from(event.dataTransfer.files);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length > 0) {
      await processImageFiles(imageFiles);
    }
  };

  // 移除图片
  const removeImage = (index: number) => {
      removeUploadedImage(index);
  };

  // 运行生成
  const onRun = async () => {
    if (!canRun || isGenerating) return;
    
    // 创建用户消息
    const userMsg: Message = {
      id: createId(),
      role: 'user',
      text: currentPrompt,
      images: [...uploadedImages],
      timestamp: Date.now(),
      mode: 'generate',
      parameters: { temperature, seed: seed || undefined }
    };
    
    addMessageToCurrentSession(userMsg);
    
    // 清空输入
    setCurrentPrompt('');
      clearUploadedImages();
    
    setTimeout(() => scrollToBottom(), 200);

    try {
      // 上下文仅绑定当前会话：不携带其他会话遗留的画布图片
      const ctxImages: string[] = uploadedImages
          .filter(img => img.includes('base64,'))
        .map(img => img.split('base64,')[1]);

        generate({
          prompt: currentPrompt,
          referenceImages: ctxImages.length > 0 ? ctxImages : undefined,
          temperature,
          seed: seed || undefined
        });
    } catch (error) {
      const errorMsg: Message = {
        id: createId(),
        role: 'assistant',
        text: '生成失败：' + (error as Error).message,
        timestamp: Date.now()
      };
      addMessageToCurrentSession(errorMsg);
    }
  };

  // 监听生成结果，添加助手消息（展示API返回的文字）
  useEffect(() => {
    if (!currentProject?.generations.length) return;
      const latestGeneration = currentProject.generations[currentProject.generations.length - 1];
    if (syncedGenerationIdsRef.current.has(latestGeneration.id)) return;

    // 允许“只有文本”或“只有图片”的结果
    const hasImage = latestGeneration.outputAssets.length > 0;
    const hasText = !!(latestGeneration.responseText && latestGeneration.responseText.trim());
    if (!hasImage && !hasText) return;

    syncedGenerationIdsRef.current.add(latestGeneration.id);
        const assistantMsg: Message = {
          id: createId(),
          role: 'assistant',
          text: latestGeneration.responseText || '',
      imageUrl: hasImage ? latestGeneration.outputAssets[0].url : undefined,
          timestamp: Date.now()
        };
    addMessageToCurrentSession(assistantMsg);
        setTimeout(() => scrollToBottom(), 200);
  }, [currentProject?.generations, addMessageToCurrentSession]);

  // 监听编辑结果（展示API返回的文字）
  useEffect(() => {
    if (!currentProject?.edits.length) return;
      const latestEdit = currentProject.edits[currentProject.edits.length - 1];
    if (latestEdit.outputAssets.length === 0) return;

    if (syncedEditIdsRef.current.has(latestEdit.id)) return;
    syncedEditIdsRef.current.add(latestEdit.id);

        const assistantMsg: Message = {
          id: createId(),
          role: 'assistant',
          text: latestEdit.responseText || '',
          imageUrl: latestEdit.outputAssets[0].url,
          timestamp: Date.now()
        };
    addMessageToCurrentSession(assistantMsg);
        setTimeout(() => scrollToBottom(), 200);
  }, [currentProject?.edits, addMessageToCurrentSession]);

  // 收集“当前会话”中的图片用于预览左右切换
  useEffect(() => {
    const gen: { url: string; title: string; timestamp: number }[] = [];
    const uploads: { url: string; title: string; timestamp: number }[] = [];
    messages.forEach((m) => {
      if (m.role === 'assistant' && m.imageUrl) {
        gen.push({ url: m.imageUrl, title: '对话图片', timestamp: m.timestamp });
      }
      if (m.role === 'user' && Array.isArray(m.images)) {
        m.images.forEach((u) => uploads.push({ url: u, title: '用户上传', timestamp: m.timestamp }));
      }
    });
    gen.sort((a, b) => a.timestamp - b.timestamp);
    uploads.sort((a, b) => a.timestamp - b.timestamp);
    setAllGeneratedImages(gen);
    setAllUploadedImages(uploads);
  }, [messages, currentSessionId]);

  // 监听消息变化，自动滚动到底部
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => scrollToBottom(), 100);
    }
  }, [messages]);

  // 确保对话框容器在初始化时就有正确的滚动设置
  useEffect(() => {
    const chatContainer = chatRef.current;
    if (chatContainer) {
      // 确保滚动容器正确初始化
      chatContainer.style.overflowY = 'auto';
      chatContainer.style.height = '100%';
    }
  }, []);

  const canRun = currentPrompt.trim().length > 0 || uploadedImages.length > 0;

  // 图片预览（区分来源：对话生成图 / 用户上传图）
  const openImagePreview = (url: string, showDownload: boolean = false, source: 'generated' | 'uploaded' = 'generated') => {
    setPreviewSource(source);
    const list = source === 'generated' ? allGeneratedImages : allUploadedImages;
    const index = list.findIndex(img => img.url === url);
    setCurrentImageIndex(Math.max(0, index));
    setPreviewUrl(url);
    setShowDownloadButton(showDownload);
    setPreviewVisible(true);
  };

  // 简易上传图片编辑：裁剪和涂抹（占位示例：此处只演示裁剪为中心正方形）
  // 打开上传图片编辑器
  const openUploadEditor = (index: number) => {
    const src = uploadedImages[index];
    if (!src) return;
    setEditorIndex(index);
    setEditorSrc(src);
    setEditorAspect('original');
    setEditorRotation(0);
    setFlipH(false);
    setFlipV(false);
    setViewScale(1);
    setViewPan({x:0,y:0});
    setPaths([]); setTexts([]); setMarks([]);
    setEditorOpen(true);
    // 加载图像
    const img = new Image();
    img.src = src;
    img.onload = () => {
      editorImgRef.current = img;
      renderEditorCanvas();
    };
  };

  const closeUploadEditor = () => {
    setEditorOpen(false);
    setEditorIndex(null);
    setEditorSrc('');
  };

  // 计算中心裁剪区域
  const getCenteredCrop = (w: number, h: number) => {
    if (editorAspect === 'original') return { sx: 0, sy: 0, sw: w, sh: h };
    const aspect = editorAspect === '1:1' ? 1 
      : editorAspect === '4:3' ? 4 / 3 
      : editorAspect === '3:4' ? 3 / 4 
      : editorAspect === '16:9' ? 16 / 9 
      : 9 / 16;
    let cw = w;
    let ch = cw / aspect;
    if (ch > h) {
      ch = h;
      cw = ch * aspect;
    }
    const sx = (w - cw) / 2;
    const sy = (h - ch) / 2;
    return { sx, sy, sw: cw, sh: ch };
  };

  // 渲染编辑器主画布和涂鸦层
  const renderEditorCanvas = () => {
    const img = editorImgRef.current;
    const canvas = editorCanvasRef.current;
    const drawCanvas = editorDrawCanvasRef.current;
    if (!img || !canvas || !drawCanvas) return;

    const maxW = Math.min(900, window.innerWidth - 160);
    const scale = Math.min(maxW / img.width, 600 / img.height, 1);
    const baseW = Math.round(img.width * scale);
    const baseH = Math.round(img.height * scale);
    canvas.width = baseW;
    canvas.height = baseH;
    drawCanvas.width = baseW;
    drawCanvas.height = baseH;

    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, baseW, baseH);

    // 将编辑变换绘制到中间临时画布后再缩放到显示画布
    const temp = document.createElement('canvas');
    const tctx = temp.getContext('2d')!;
    temp.width = img.width;
    temp.height = img.height;
    tctx.save();
    // 变换：翻转和旋转都在源图大小上处理
    // 应用翻转
    tctx.translate(img.width / 2, img.height / 2);
    tctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
    tctx.rotate((editorRotation % 360) * Math.PI / 180);
    tctx.drawImage(img, -img.width / 2, -img.height / 2);
    tctx.restore();

    // 裁剪（预览阶段仅按比例填充全画布；裁剪在保存阶段才真正裁）
    const { sx, sy, sw, sh } = getCenteredCrop(temp.width, temp.height);
    ctx.drawImage(temp, sx, sy, sw, sh, 0, 0, baseW, baseH);

    // 清空涂鸦层
    const dctx = drawCanvas.getContext('2d')!;
    dctx.clearRect(0, 0, baseW, baseH);
    // 重绘所有路径与文本、标记
    redrawDrawCanvas();
  };

  // 还原到上传时的原始状态（包含图像与所有参数）
  const restoreEditorToOriginal = () => {
    if (!editorSrc) return;
    setEditorAspect('original');
    setEditorRotation(0);
    setFlipH(false);
    setFlipV(false);
    setViewScale(1);
    setViewPan({x:0,y:0});
    setPaths([]); setTexts([]); setMarks([]);
    const img = new Image();
    img.src = editorSrc;
    img.onload = () => {
      editorImgRef.current = img;
      renderEditorCanvas();
    };
  };

  const redrawDrawCanvas = () => {
    const drawCanvas = editorDrawCanvasRef.current;
    const baseCanvas = editorCanvasRef.current;
    if (!drawCanvas || !baseCanvas) return;
    const dctx = drawCanvas.getContext('2d')!;
    dctx.clearRect(0,0,drawCanvas.width, drawCanvas.height);
    // paths
    paths.forEach(p => {
      dctx.save();
      dctx.lineCap = 'round';
      dctx.lineJoin = 'round';
      dctx.strokeStyle = p.color;
      dctx.lineWidth = p.size;
      dctx.globalCompositeOperation = p.mode === 'erase' ? 'destination-out' : 'source-over';
      dctx.beginPath();
      p.points.forEach((pt, idx) => {
        if (idx === 0) dctx.moveTo(pt.x, pt.y); else dctx.lineTo(pt.x, pt.y);
      });
      dctx.stroke();
      dctx.restore();
    });
    // marks
    dctx.save();
    dctx.lineWidth = 2;
    marks.forEach(r => { dctx.strokeStyle = r.color || markColor; dctx.strokeRect(r.x, r.y, r.w, r.h); });
    dctx.restore();
    // texts
    texts.forEach(t => {
      dctx.save();
      dctx.fillStyle = t.color;
      dctx.font = `${t.size}px sans-serif`;
      dctx.textBaseline = 'top';
      dctx.fillText(t.text, t.x, t.y);
      dctx.restore();
    });
  };

  // 涂鸦交互
  const onDrawPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!(tool === 'pen' || tool === 'erase' || tool === 'mark')) return;
    isDrawingRef.current = true;
    try { (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId); } catch {/* noop */}
    const c = editorDrawCanvasRef.current!;
    const rect = c.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (tool === 'mark') {
      markDraftRef.current = {startX:x, startY:y, active:true};
      setMarks(prev => [...prev, {x, y, w:0, h:0, color: markColor}]);
      return;
    }
    // start new path
    setPaths(prev => [...prev, { mode: tool==='erase'?'erase':'draw', color: penColor, size: penSize, points: [{x,y}] }]);
  };
  const onDrawPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const c = editorDrawCanvasRef.current!;
    const rect = c.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (tool === 'mark') {
      setMarks(prev => {
        if (prev.length === 0) return prev;
        // 将绘制限定在画布内
        const width = c.width; const height = c.height;
        const clamp = (v:number, min:number, max:number)=> Math.max(min, Math.min(max, v));
        const sx = clamp(markDraftRef.current.startX, 0, width);
        const sy = clamp(markDraftRef.current.startY, 0, height);
        const cx = clamp(x, 0, width);
        const cy = clamp(y, 0, height);
        const last = {...prev[prev.length-1]};
        last.x = Math.min(sx, cx); last.y = Math.min(sy, cy); last.w = Math.abs(cx-sx); last.h = Math.abs(cy-sy);
        const next = prev.slice(0, prev.length-1).concat(last);
        return next;
      });
      redrawDrawCanvas();
      return;
    }
    // push to last path
    setPaths(prev => {
      const next = prev.slice();
      const p = next[next.length-1];
      if (p) { p.points = [...p.points, {x,y}]; }
      return next;
    });
    redrawDrawCanvas();
  };
  const onDrawPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isDrawingRef.current = false; markDraftRef.current.active=false;
    try { (e.currentTarget as HTMLCanvasElement).releasePointerCapture(e.pointerId); } catch {/* noop */}
  };

  // 画布拖拽平移
  const onViewPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (tool !== 'pan') return;
    viewPanStartRef.current = {x: e.clientX, y: e.clientY, ox: viewPan.x, oy: viewPan.y};
    try { (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId); } catch {/* noop */}
  };
  const onViewPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (tool !== 'pan' || !viewPanStartRef.current) return;
    const dx = e.clientX - viewPanStartRef.current.x;
    const dy = e.clientY - viewPanStartRef.current.y;
    setViewPan({x: viewPanStartRef.current.ox + dx, y: viewPanStartRef.current.oy + dy});
  };
  const onViewPointerUp = (e: React.PointerEvent<HTMLDivElement>) => { 
    viewPanStartRef.current = null; 
    try { (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId); } catch {/* noop */}
  };

  const onWheelZoom = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!editorOpen) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setViewScale(s => Math.max(0.2, Math.min(4, parseFloat((s + delta).toFixed(2)))));
  };

  // 应用并替换上传图片
  const applyUploadEdit = () => {
    const base = editorCanvasRef.current;
    const draw = editorDrawCanvasRef.current;
    if (!base || !draw || editorIndex == null) return;
    const comp = document.createElement('canvas');
    comp.width = base.width;
    comp.height = base.height;
    const ctx = comp.getContext('2d')!;
    ctx.drawImage(base, 0, 0);
    ctx.drawImage(draw, 0, 0);
    // 应用裁剪
    let url: string;
    if (cropRect) {
      const cr = cropRect;
      const cropCanvas = document.createElement('canvas');
      const sx = Math.max(0, cr.x);
      const sy = Math.max(0, cr.y);
      const sw = Math.max(1, Math.min(cr.w, comp.width - sx));
      const sh = Math.max(1, Math.min(cr.h, comp.height - sy));
      cropCanvas.width = sw;
      cropCanvas.height = sh;
      const cctx = cropCanvas.getContext('2d')!;
      cctx.drawImage(comp, sx, sy, sw, sh, 0, 0, sw, sh);
      url = cropCanvas.toDataURL('image/png');
    } else {
      url = comp.toDataURL('image/png');
    }
    updateUploadedImage(editorIndex, url);
    closeUploadEditor();
  };

  // 导航到上一张图片
  const goToPreviousImage = useCallback(() => {
    const list = previewSource === 'generated' ? allGeneratedImages : allUploadedImages;
    if (list.length === 0) return;
    const newIndex = currentImageIndex > 0 ? currentImageIndex - 1 : list.length - 1;
    setCurrentImageIndex(newIndex);
    setPreviewUrl(list[newIndex].url);
  }, [previewSource, allGeneratedImages, allUploadedImages, currentImageIndex]);

  // 导航到下一张图片
  const goToNextImage = useCallback(() => {
    const list = previewSource === 'generated' ? allGeneratedImages : allUploadedImages;
    if (list.length === 0) return;
    const newIndex = currentImageIndex < list.length - 1 ? currentImageIndex + 1 : 0;
    setCurrentImageIndex(newIndex);
    setPreviewUrl(list[newIndex].url);
  }, [previewSource, allGeneratedImages, allUploadedImages, currentImageIndex]);

  const closeImagePreview = useCallback(() => {
    setPreviewVisible(false);
    setPreviewUrl('');
    setShowDownloadButton(false);
  }, []);

  // 监听键盘事件进行图片导航
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!previewVisible) return;
      
      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault();
          goToPreviousImage();
          break;
        case 'ArrowRight':
          event.preventDefault();
          goToNextImage();
          break;
        case 'Escape':
          event.preventDefault();
          closeImagePreview();
          break;
      }
    };

    if (previewVisible) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [previewVisible, goToPreviousImage, goToNextImage, closeImagePreview]);

  // 下载图片
  const downloadImage = async () => {
    if (!previewUrl) return;
    
    try {
      const response = await fetch(previewUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `nano-banana-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('下载失败:', error);
    }
  };

  // 终止生成
  const stopGeneration = () => {
    const { setIsGenerating } = useAppStore.getState();
    setIsGenerating(false);
    
    // 添加一条终止消息
    const stopMsg: Message = {
      id: createId(),
      role: 'assistant',
      text: '生成已被用户终止',
      timestamp: Date.now()
    };
    addMessageToCurrentSession(stopMsg);
  };

  // 复制文本
  const onCopyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text || '');
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text || '';
      document.body.appendChild(ta);
      ta.select();
      try { 
        document.execCommand('copy'); 
      } catch {
        // 复制失败时忽略错误
      }
      document.body.removeChild(ta);
    }
  };

  // 重发消息（直接重试）
  const onResendMessage = (msg: Message) => {
    if (isGenerating) return;
    
    const prompt = (msg.text || '').trim();
    if (!prompt) return;

    const temp = msg.parameters?.temperature ?? temperature;
    const seedValue = msg.parameters?.seed ?? (seed || undefined);

    // 从消息中的图片提取 base64 作为参考图
    const refImages = (msg.images || [])
      .filter((img) => img.includes('base64,'))
      .map((img) => img.split('base64,')[1]);

    // 直接按照 useImageGeneration 的请求格式调用
    generate({
      prompt,
      referenceImages: refImages.length > 0 ? refImages : undefined,
      temperature: temp,
      seed: seedValue,
    });
  };

  // 开始编辑提示词
  const startEditingPrompt = (msg: Message) => {
    setEditingMessageId(msg.id);
    setEditingPrompt(msg.text || '');
  };

  // 取消编辑
  const cancelEditing = () => {
    setEditingMessageId(null);
    setEditingPrompt('');
  };

  // 保存编辑并生成
  const saveEditAndGenerate = (msg: Message) => {
    if (isGenerating) return;
    const nextPrompt = editingPrompt.trim();
    if (!nextPrompt) return;

    const images = msg.images || [];
    const temp = msg.parameters?.temperature ?? temperature;
    const seedValue = msg.parameters?.seed ?? (seed || undefined);

    // 记录一条新的用户消息（编辑后的提示词）
    addMessageToCurrentSession({
      id: createId(),
      role: 'user',
      text: nextPrompt,
      images: images,
      timestamp: Date.now(),
      mode: 'generate',
      parameters: { temperature: temp, seed: seedValue },
    });

    // 从图片提取 base64 引用，发起生成
    const refImages = images
      .filter((img) => img.includes('base64,'))
      .map((img) => img.split('base64,')[1]);

    generate({
      prompt: nextPrompt,
      referenceImages: refImages.length > 0 ? refImages : undefined,
      temperature: temp,
      seed: seedValue,
    });

    // 清理编辑态并滚动到底部
    cancelEditing();
    setTimeout(() => scrollToBottom(), 200);
  };

  // 清空当前会话
  const clearCurrentSession = () => {
    if (currentSessionId) {
      // 创建一个新的空会话来替换当前会话
      createNewSession();
      // 删除旧会话
      deleteSession(currentSessionId);
    }
    setCurrentPrompt('');
    clearUploadedImages();
    clearBrushStrokes();
  };

  // 新建对话
  const createNewChat = () => {
    // 新对话：清空已同步标记，避免旧生成结果被带入
    syncedGenerationIdsRef.current.clear();
    syncedEditIdsRef.current.clear();
    createNewSession();
    setCurrentPrompt('');
    clearUploadedImages();
    clearBrushStrokes();
    // 新会话重置画布图像
    const { setCanvasImage } = useAppStore.getState();
    setCanvasImage(null);
  };

  return (
    <div className="h-screen flex" style={{ background: '#f7f7f8' }}>
      {/* 左侧对话列表 */}
      <div className="w-80 bg-gray-900 text-white flex flex-col">
        {/* 新建对话按钮 */}
        <div className="p-4 border-b border-gray-700">
              <Button
            onClick={createNewChat}
            className="w-full bg-transparent border border-gray-600 hover:bg-gray-800 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            新建对话
              </Button>
          </div>

        {/* 对话历史列表 */}
        <div className="flex-1 overflow-y-auto p-2">
          {chatSessions.length > 0 ? (
            <div className="space-y-1">
              {chatSessions
                .slice()
                .sort((a, b) => b.updatedAt - a.updatedAt)
                .map((session) => (
                <div 
                  key={session.id} 
                  className={cn(
                    "group relative flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-colors",
                    session.id === currentSessionId 
                      ? "bg-gray-800" 
                      : "hover:bg-gray-800"
                  )}
                  onClick={() => switchToSession(session.id)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">
                      {session.title}
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(session.updatedAt).toLocaleDateString()}
                    </p>
            </div>
                  {session.id !== currentSessionId && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSession(session.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 w-6 h-6 text-gray-400 hover:text-white flex items-center justify-center transition-opacity"
                      title="删除对话"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
                </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <p className="text-sm">还没有对话历史</p>
              </div>
            )}
        </div>
          </div>

      {/* 主内容区域 */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* 标题 */}
        <div className="bg-white border-b border-gray-200 py-4">
          <h1 className="text-center text-2xl font-semibold text-gray-800">
            Spes X 🍌 Nano Banana AI Studio
          </h1>
        </div>

        {/* 主对话和右侧面板 */}
        <div className="flex-1 flex gap-4 p-4 min-h-0">

        {/* 主对话区域 */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 relative">
          {/* Ctrl+V 提示 */}
          {showPasteHint && (
            <div className="absolute top-4 right-4 bg-black bg-opacity-80 text-white px-3 py-2 rounded-lg text-sm z-10 animate-pulse">
              <div className="flex items-center space-x-2">
                <kbd className="bg-gray-700 px-2 py-1 rounded text-xs">Ctrl</kbd>
                <span>+</span>
                <kbd className="bg-gray-700 px-2 py-1 rounded text-xs">V</kbd>
                <span>在输入框粘贴图片</span>
        </div>
            </div>
          )}

          {/* 对话框容器（自适应剩余高度） */}
          <div className="flex-1 bg-white border border-gray-200 rounded-xl shadow-sm mb-4 min-h-0 overflow-hidden">
            <div 
              ref={chatRef}
              className="chat-container h-full overflow-y-auto p-4"
              tabIndex={0}
            >
              <div className="space-y-4">
                {messages.length > 0 ? (
                  <>
                    {messages.map((msg) => (
                    <div key={msg.id} className={cn("flex w-full", msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                      <div className={cn(
                        "relative max-w-3xl border rounded-xl p-4 shadow-sm",
                        msg.role === 'user' 
                          ? "bg-blue-50 border-blue-200" 
                          : "bg-gray-50 border-gray-200"
                      )}>
                        {msg.text && (
                          editingMessageId === msg.id ? (
                            <div className="space-y-3 mb-2">
                              <Textarea
                                value={editingPrompt}
                                onChange={(e) => setEditingPrompt(e.target.value)}
                                className="min-h-20"
                                placeholder="编辑提示词..."
                              />
                              <div className="flex space-x-2">
                                <Button
                                  onClick={() => saveEditAndGenerate(msg)}
                                  disabled={isGenerating || !editingPrompt.trim()}
                                  className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 text-sm"
                                >
                                  {isGenerating ? '生成中...' : '生成'}
                                </Button>
                                <Button
                                  onClick={cancelEditing}
                                  disabled={isGenerating}
                                  className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 text-sm"
                                >
                                  取消
                                </Button>
                              </div>
                            </div>
                          ) : (
                          <p className="text-gray-800 mb-2 whitespace-pre-wrap">{msg.text}</p>
                          )
                        )}
                        
                        {/* 用户消息的图片 */}
                        {msg.role === 'user' && msg.images && msg.images.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-2">
                            {msg.images.map((img, i) => (
                              <div key={i} className="w-20 h-20 rounded-lg overflow-hidden border border-gray-200">
                                <img 
                                  src={img} 
                                  alt={`上传图片 ${i+1}`}
                                  className="w-full h-full object-cover cursor-pointer"
                                  onClick={() => openImagePreview(img, false, 'uploaded')}
                                />
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {/* 助手消息的生成图片 */}
                        {msg.role === 'assistant' && msg.imageUrl && (
                          <div className="mt-2">
                            <div className="w-full max-w-md">
                            <img 
                              src={msg.imageUrl} 
                              alt="生成结果"
                                className="w-full h-auto rounded-lg shadow-sm cursor-pointer"
                              onClick={() => openImagePreview(msg.imageUrl!, true, 'generated')}
                            />
                            </div>
                          </div>
                        )}
                        
                        {/* 用户消息操作栏 */}
                        {msg.role === 'user' && editingMessageId !== msg.id && (
                          <div className="absolute right-2 bottom-2 flex space-x-2">
                            <button
                              onClick={() => onResendMessage(msg)}
                              className="w-6 h-6 border border-gray-300 rounded bg-white hover:bg-gray-50 flex items-center justify-center"
                              title="重试"
                              disabled={isGenerating}
                            >
                              <RotateCcw className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => startEditingPrompt(msg)}
                              className="w-6 h-6 border border-gray-300 rounded bg-white hover:bg-gray-50 flex items-center justify-center"
                              title="编辑提示词"
                              disabled={isGenerating}
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => onCopyText(msg.text || '')}
                              className="w-6 h-6 border border-gray-300 rounded bg-white hover:bg-gray-50 flex items-center justify-center"
                              title="复制文本"
                            >
                              📋
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    ))}
                    
                    {/* 生成中状态指示器 */}
                    {isGenerating && (
                      <div className="flex justify-start">
                        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 shadow-sm">
                          <div className="flex items-center space-x-3">
                            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-gray-600">AI正在生成图像...</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center justify-center text-gray-500" style={{ minHeight: '300px' }}>
                    <div className="text-center">
                      <div className="text-6xl mb-4">🎨</div>
                      <h3 className="text-lg font-medium mb-2">开始您的AI创作之旅</h3>
                      <p className="text-sm">在下方输入提示词或粘贴图片，生成精美的图像</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 输入区域 */}
          <div 
            className="flex-shrink-0 bg-white border border-gray-200 rounded-xl shadow-sm relative"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {/* 拖拽覆盖层（输入区域） */}
            {isDragging && (
              <div className="absolute inset-0 bg-blue-500 bg-opacity-20 border-4 border-dashed border-blue-500 rounded-xl z-10 flex items-center justify-center">
                <div className="bg-white rounded-lg p-4 shadow-lg text-center">
                  <div className="text-3xl mb-2">📎</div>
                  <p className="text-sm font-medium text-gray-800">拖拽图片到输入框</p>
                  <p className="text-xs text-gray-600">支持 JPG、PNG、GIF 等格式</p>
                </div>
              </div>
            )}

            {/* 粘贴处理中覆盖层（输入区域） */}
            {isPasting && (
              <div className="absolute inset-0 bg-green-500 bg-opacity-20 border-4 border-dashed border-green-500 rounded-xl z-10 flex items-center justify-center">
                <div className="bg-white rounded-lg p-4 shadow-lg text-center">
                  <div className="animate-spin text-3xl mb-2">🔄</div>
                  <p className="text-sm font-medium text-gray-800">正在处理图片...</p>
                </div>
              </div>
            )}

            {/* 粘贴成功动画（输入区域） */}
            {pasteSuccess && (
              <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center">
                <div className="bg-green-500 text-white rounded-lg p-3 shadow-lg animate-bounce">
                  <div className="flex items-center space-x-2">
                    <span className="text-xl">✅</span>
                    <span className="text-sm font-medium">图片粘贴成功!</span>
                  </div>
                </div>
              </div>
            )}

            {/* 上传图片区域 */}
            {uploadedImages.length > 0 && (
              <div className="p-3 border-b border-gray-200">
                <div className="flex items-center gap-2 flex-nowrap overflow-x-auto">
                  {uploadedImages.map((img, i) => (
                    <div key={i} className="relative flex-shrink-0 group">
                      <div className="w-16 h-16 rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                        <img 
                          src={img} 
                          alt={`图片 ${i+1}`} 
                          className="w-full h-full object-cover cursor-pointer"
                          onClick={() => openImagePreview(img, false, 'uploaded')}
                        />
                      </div>
                      <div className="absolute -bottom-2 left-0 right-0 flex justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openUploadEditor(i)}
                          className="px-2 py-0.5 text-xs bg-white border rounded shadow"
                          title="编辑图片"
                        >
                          编辑
                        </button>
                      </div>
                      <button
                        onClick={() => removeImage(i)}
                        className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 输入框和控制区域 */}
            <div className="relative p-4">
              <div className="flex items-end space-x-3">
                {/* 上传按钮 */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-shrink-0 w-10 h-10 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors"
                  title={`上传图片（最多${maxImages}张）\n支持：点击选择、拖拽上传、复制粘贴`}
                  disabled={uploadedImages.length >= maxImages}
                >
                  📎
                </button>

                {/* 输入框 */}
                <div className="flex-1">
                  <Textarea
                    ref={promptRef}
                    value={currentPrompt}
                    onChange={(e) => {
                      setCurrentPrompt(e.target.value);
                      autoResizePrompt();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        onRun();
                      }
                    }}
                    onPaste={async (e) => {
                      // 让图片粘贴优先处理，如果没有图片则继续文本粘贴
                      const handled = await handlePaste(e.nativeEvent);
                      if (handled) {
                        e.preventDefault(); // 如果处理了图片，阻止默认的文本粘贴
                      }
                      // 如果没有图片，让默认的文本粘贴继续进行
                    }}
                    onWheel={(e) => {
                      // 当输入框内容不需要滚动时，将滚轮事件传递给对话框
                      const target = e.currentTarget;
                      const isAtTop = target.scrollTop === 0;
                      const isAtBottom = target.scrollTop >= target.scrollHeight - target.clientHeight;
                      
                      if ((e.deltaY < 0 && isAtTop) || (e.deltaY > 0 && isAtBottom)) {
                        e.preventDefault();
                        const chatContainer = chatRef.current;
                        if (chatContainer) {
                          chatContainer.scrollTop += e.deltaY;
                        }
                      }
                    }}
                    placeholder="输入生成提示词..."
                    className="fixed-height-textarea w-full border border-gray-300 rounded-lg px-4 py-3 outline-none text-gray-800 placeholder-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 bg-white"
                    style={{ height: '60px' }}
                  />
                </div>

                {/* 运行/终止按钮 */}
                <div className="flex space-x-2">
                  {isGenerating ? (
                    <Button
                      onClick={stopGeneration}
                      className="flex-shrink-0 bg-red-500 hover:bg-red-600 text-white font-semibold px-6 py-3 rounded-lg border border-red-600"
                    >
                      <div className="flex items-center space-x-2">
                        <Square className="w-4 h-4" />
                        <span>终止</span>
                      </div>
                    </Button>
                  ) : (
                    <Button
                      onClick={onRun}
                      disabled={!canRun}
                      className="flex-shrink-0 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold px-6 py-3 rounded-lg border border-yellow-500"
                    >
                      运行
                    </Button>
                  )}
                </div>
              </div>

              {/* 隐藏的文件输入 */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileUpload}
              />
              
              {/* 已移除输入框下方提示与调试链接 */}
            </div>
          </div>
        </div>

          {/* 右侧：控制面板 */}
        <div className="w-72 flex-shrink-0 flex flex-col space-y-4">
            {/* 参数设置 */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-700">参数设置</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </div>
              
              {showAdvanced && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      创造性: {temperature}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={temperature}
                      onChange={(e) => setTemperature(parseFloat(e.target.value))}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      随机种子
                    </label>
                    <input
                      type="number"
                      value={seed || ''}
                      onChange={(e) => setSeed(e.target.value ? parseInt(e.target.value) : null)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      placeholder="留空为随机"
                    />
                  </div>
                </div>
              )}
            </div>

          {/* 生成历史 */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex-1">
            <h3 className="text-sm font-medium text-gray-700 mb-3">生成历史</h3>
            
            {currentProject && (currentProject.generations.length > 0 || currentProject.edits.length > 0) ? (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {/* 显示生成历史 */}
                {currentProject.generations.map((generation) => (
                  <div key={generation.id} className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 cursor-pointer">
                    <div className="flex items-start space-x-3">
                      {generation.outputAssets.length > 0 && (
                        <img 
                          src={generation.outputAssets[0].url} 
                          alt="生成结果"
                          className="w-12 h-12 object-cover rounded"
                          onClick={() => openImagePreview(generation.outputAssets[0].url, true, 'generated')}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-500 mb-1">
                          {new Date(generation.timestamp).toLocaleString()}
                        </p>
                        <p className="text-sm text-gray-800 line-clamp-2">{generation.prompt}</p>
                        {generation.parameters.temperature && (
                          <p className="text-xs text-gray-400 mt-1">
                            温度: {generation.parameters.temperature}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                
                {/* 显示编辑历史 */}
                {currentProject.edits.map((edit) => (
                  <div key={edit.id} className="border border-green-200 rounded-lg p-3 hover:bg-green-50 cursor-pointer">
                    <div className="flex items-start space-x-3">
                      {edit.outputAssets.length > 0 && (
                        <img 
                          src={edit.outputAssets[0].url} 
                          alt="编辑结果"
                          className="w-12 h-12 object-cover rounded"
                          onClick={() => openImagePreview(edit.outputAssets[0].url, true, 'generated')}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-green-600 mb-1">
                          编辑 - {new Date(edit.timestamp).toLocaleString()}
                        </p>
                        <p className="text-sm text-gray-800 line-clamp-2">{edit.instruction}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <div className="text-4xl mb-2">🎨</div>
                <p className="text-sm">还没有生成历史</p>
                <p className="text-xs">开始创作您的第一张图像吧！</p>
              </div>
            )}
          </div>

          {/* 快速操作 */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">快速操作</h3>
            <div className="space-y-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-blue-600 hover:bg-blue-50"
                onClick={() => {
                  setCurrentPrompt('一只可爱的卡通香蕉');
                }}
              >
                🍌 生成香蕉图像
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-green-600 hover:bg-green-50"
                onClick={() => {
                  setCurrentPrompt('美丽的风景画，油画风格');
                }}
              >
                🖼️ 风景油画
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-purple-600 hover:bg-purple-50"
                onClick={() => {
                  setCurrentPrompt('未来科技城市，赛博朋克风格');
                }}
              >
                🌆 科技城市
              </Button>
            </div>
          </div>

          {/* 清空当前对话 */}
          <Button
            onClick={clearCurrentSession}
            disabled={isGenerating}
            className="w-full bg-red-500 hover:bg-red-600 text-white"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            清空当前对话
          </Button>
          </div>
        </div>
      </div>

      {/* 图片预览弹窗 */}
      {previewVisible && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"
          onClick={closeImagePreview}
        >
          <div
            className="relative max-w-5xl max-h-[90vh] bg-gray-900 p-3 rounded-xl select-none overflow-hidden"
            onClick={e => e.stopPropagation()}
            onWheel={(e) => {
              e.preventDefault();
              const delta = e.deltaY > 0 ? -0.1 : 0.1;
              setPreviewZoom((z) => {
                const next = Math.min(5, Math.max(0.2, parseFloat((z + delta).toFixed(2))));
                return next;
              });
            }}
            onMouseDown={(e) => {
              setIsPanning(true);
              panStartRef.current = { x: e.clientX, y: e.clientY, originX: previewOffset.x, originY: previewOffset.y };
            }}
            onMouseMove={(e) => {
              if (!isPanning || !panStartRef.current) return;
              const dx = e.clientX - panStartRef.current.x;
              const dy = e.clientY - panStartRef.current.y;
              setPreviewOffset({ x: panStartRef.current.originX + dx, y: panStartRef.current.originY + dy });
            }}
            onMouseUp={() => {
              setIsPanning(false);
              panStartRef.current = null;
            }}
            onMouseLeave={() => {
              setIsPanning(false);
              panStartRef.current = null;
            }}
            onDoubleClick={() => {
              setPreviewZoom(1);
              setPreviewOffset({ x: 0, y: 0 });
            }}
          >
            <div className="relative w-[80vw] max-w-5xl h-[80vh] max-h-[80vh] flex items-center justify-center">
              <img
                src={previewUrl}
                alt="预览"
                className="rounded-lg"
                style={{
                  transform: `translate(${previewOffset.x}px, ${previewOffset.y}px) scale(${previewZoom})`,
                  transition: isPanning ? 'none' : 'transform 80ms ease-out',
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain'
                }}
                onLoad={(e) => {
                  const img = e.currentTarget as HTMLImageElement;
                  setPreviewNatural({ width: img.naturalWidth, height: img.naturalHeight });
                }}
              />
            
            {/* 图片信息 */}
            {(allGeneratedImages.length > 0 && currentImageIndex >= 0 && currentImageIndex < allGeneratedImages.length) && (
              <div className="absolute bottom-3 left-3 bg-black bg-opacity-70 text-white px-3 py-2 rounded-lg text-sm">
                <div className="font-medium">{allGeneratedImages[currentImageIndex].title}</div>
                <div className="text-gray-300 text-xs">
                  {currentImageIndex + 1} / {allGeneratedImages.length}
                  {previewNatural && (
                    <span className="ml-2">· {previewNatural.width} × {previewNatural.height}</span>
                  )}
                  <span className="ml-2">· 缩放 {Math.round(previewZoom * 100)}%</span>
                </div>
              </div>
            )}

            {/* 导航按钮 */}
            {allGeneratedImages.length > 1 && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    goToPreviousImage();
                  }}
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 w-12 h-12 bg-white bg-opacity-90 hover:bg-opacity-100 rounded-full flex items-center justify-center text-gray-900 transition-all"
                  title="上一张 (←)"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    goToNextImage();
                  }}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 w-12 h-12 bg-white bg-opacity-90 hover:bg-opacity-100 rounded-full flex items-center justify-center text-gray-900 transition-all"
                  title="下一张 (→)"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              </>
            )}
            
            {/* 控制按钮组 */}
            <div className="absolute top-3 right-3 flex space-x-2">
              <button
                onClick={(e) => { e.stopPropagation(); setPreviewZoom(1); setPreviewOffset({ x: 0, y: 0 }); }}
                className="w-10 h-10 bg-white bg-opacity-90 hover:bg-opacity-100 rounded-full flex items-center justify-center text-gray-900 transition-all"
                title="复位 (双击图片也可)"
              >
                <Square className="h-5 w-5" />
              </button>
              {showDownloadButton && (
                <button
                  onClick={downloadImage}
                  className="w-10 h-10 bg-white bg-opacity-90 hover:bg-opacity-100 rounded-full flex items-center justify-center text-gray-900 transition-all"
                  title="下载图片"
                >
                  <Download className="h-5 w-5" />
                </button>
              )}
              <button
                onClick={closeImagePreview}
                className="w-10 h-10 bg-white bg-opacity-90 hover:bg-opacity-100 rounded-full flex items-center justify-center text-gray-900 font-bold transition-all"
                title="关闭 (Esc)"
              >
                ×
              </button>
            </div>
            {/* 结束内层容器 */}
            </div>

          </div>
        </div>
      )}

      {/* 上传图片编辑器 */}
      {editorOpen && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center" onClick={closeUploadEditor}>
          <div className="bg-white rounded-xl shadow-xl p-4 w-[960px] max-w-[96vw]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <span className="font-medium">图片编辑</span>
                <div className="h-4 w-px bg-gray-300" />
                {/* 工具选择 */}
                <select value={tool} onChange={(e)=>setTool(e.target.value as 'pan'|'pen'|'erase'|'mark'|'crop'|'text'|'none')} className="border rounded px-2 py-1 text-sm">
                  <option value="none">选择工具</option>
                  <option value="pan">平移/缩放</option>
                  <option value="crop">裁剪框</option>
                  <option value="mark">标记框</option>
                  <option value="pen">涂鸦</option>
                  <option value="erase">橡皮擦</option>
                  <option value="text">文字</option>
                </select>
                {/* 裁剪比例 */}
                <label className="flex items-center gap-1">
                  比例
                  <select value={editorAspect} onChange={(e)=>{setEditorAspect(e.target.value as 'original'|'1:1'|'4:3'|'3:4'|'16:9'|'9:16'); renderEditorCanvas();}} className="border rounded px-2 py-1 text-sm">
                    <option value="original">原始</option>
                    <option value="1:1">1:1</option>
                    <option value="4:3">4:3</option>
                    <option value="3:4">3:4</option>
                    <option value="16:9">16:9</option>
                    <option value="9:16">9:16</option>
                  </select>
                </label>
                {/* 旋转 */}
                <button className="px-2 py-1 border rounded" onClick={()=>{setEditorRotation((r)=> (r+90)%360); renderEditorCanvas();}}>旋转90°</button>
                {/* 翻转 */}
                <button className="px-2 py-1 border rounded" onClick={()=>{setFlipH(v=>!v); renderEditorCanvas();}}>水平翻转</button>
                <button className="px-2 py-1 border rounded" onClick={()=>{setFlipV(v=>!v); renderEditorCanvas();}}>垂直翻转</button>
                {/* 画笔/标记颜色 */}
                <input type="color" value={penColor} onChange={(e)=>setPenColor(e.target.value)} className="w-6 h-6" />
                <input type="range" min={2} max={24} value={penSize} onChange={(e)=>setPenSize(parseInt(e.target.value))} />
                <label className="flex items-center gap-1">
                  <span className="text-gray-500">标记颜色</span>
                  <input type="color" value={markColor} onChange={(e)=>setMarkColor(e.target.value)} className="w-6 h-6" />
                </label>
                <button className="px-2 py-1 border rounded" onClick={()=>{ setPaths(p=>p.slice(0, Math.max(0,p.length-1))); redrawDrawCanvas(); }}>撤销</button>
              </div>
              <div className="flex items-center gap-2">
                <button className="px-3 py-1 bg-gray-100 border rounded" onClick={restoreEditorToOriginal}>还原视图</button>
                <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={applyUploadEdit}>完成并替换</button>
                <button className="px-3 py-1 bg-gray-200 rounded" onClick={closeUploadEditor}>取消</button>
              </div>
            </div>
            <div ref={editorContainerRef} className="relative flex items-center justify-center border rounded-lg bg-gray-50 overflow-hidden"
                 onPointerDown={onViewPointerDown}
                 onPointerMove={onViewPointerMove}
                 onPointerUp={onViewPointerUp}
                 onPointerLeave={onViewPointerUp}
                 onWheel={onWheelZoom}
            >
              <div style={{ position:'relative', transform: `translate(${viewPan.x}px, ${viewPan.y}px) scale(${viewScale})`, transformOrigin: 'center center' }}>
                <canvas ref={editorCanvasRef} />
                <canvas
                  ref={editorDrawCanvasRef}
                  style={{ position:'absolute', left:0, top:0, cursor:'crosshair' }}
                  onPointerDown={onDrawPointerDown}
                  onPointerMove={onDrawPointerMove}
                  onPointerUp={onDrawPointerUp}
                  onPointerLeave={onDrawPointerUp}
                />
              </div>
            </div>
            {/* 文本工具简单输入 */}
            {tool==='text' && (
              <div className="mt-2 flex items-center gap-2 text-sm">
                <input id="__text_input" className="border rounded px-2 py-1 flex-1" placeholder="输入文字后在画面点击一次放置" onKeyDown={(e)=>{
                  if(e.key==='Enter'){
                    const val=(e.target as HTMLInputElement).value.trim();
                    if(!val) return;
                    // 在中心点放置
                    const c=editorDrawCanvasRef.current; if(!c) return;
                    setTexts(t=>[...t,{x:c.width/2, y:c.height/2, text: val, color: penColor, size: 28}]);
                    (e.target as HTMLInputElement).value='';
                    redrawDrawCanvas();
                  }
                }} />
                <span className="text-gray-500">回车确认</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
