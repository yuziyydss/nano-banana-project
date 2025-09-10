import { useMutation } from '@tanstack/react-query';
import { geminiService, GenerationRequest, EditRequest } from '../services/geminiService';
import { useAppStore } from '../store/useAppStore';
import { generateId } from '../utils/imageUtils';
import { Generation, Edit, Asset } from '../types';

export const useImageGeneration = () => {
  const { addGeneration, setIsGenerating, setCanvasImage, setCurrentProject, currentProject } = useAppStore();

  const generateMutation = useMutation({
    mutationFn: async (request: GenerationRequest) => {
      // 自动重试：若无图片且无文本，最多重试5次
      const maxRetries = 5;
      let attempt = 0;
      let lastResult: { images: string[]; text?: string } | null = null;
      while (attempt < maxRetries) {
        attempt += 1;
        const result = await geminiService.generateImage(request);
        lastResult = result;
        const hasImage = Array.isArray(result.images) && result.images.length > 0;
        const hasText = !!(result.text && result.text.trim());
        if (hasImage || hasText) {
          return result; // { images, text }
        }
        // 渐进退避，避免打爆接口
        await new Promise((r) => setTimeout(r, 400 * attempt));
      }
      // 仍为空则抛错
      throw new Error('Empty result after 5 retries');
    },
    onMutate: () => {
      setIsGenerating(true);
    },
    onSuccess: (result, request) => {
      const { images, text } = result;
      const outputAssets: Asset[] = (images || []).map((base64) => ({
        id: generateId(),
        type: 'output',
        url: `data:image/png;base64,${base64}`,
        mime: 'image/png',
        width: 1024,
        height: 1024,
        checksum: base64.slice(0, 32)
      }));

      const generation: Generation = {
        id: generateId(),
        prompt: request.prompt,
        parameters: {
          seed: request.seed,
          temperature: request.temperature
        },
        sourceAssets: request.referenceImages && request.referenceImages.length > 0 ? request.referenceImages.map((img) => ({
          id: generateId(),
          type: 'original' as const,
          url: `data:image/png;base64,${img}`,
          mime: 'image/png',
          width: 1024,
          height: 1024,
          checksum: img.slice(0, 32)
        })) : [],
        outputAssets,
        modelVersion: 'gemini-2.5-flash-image-preview',
        timestamp: Date.now(),
        responseText: text
      };

      addGeneration(generation);
      if (outputAssets.length > 0) {
        setCanvasImage(outputAssets[0].url);
      }
      
      // Create project if none exists
      if (!currentProject) {
        const newProject = {
          id: generateId(),
          title: 'Untitled Project',
          generations: [generation],
          edits: [],
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        setCurrentProject(newProject);
      }
      setIsGenerating(false);
    },
    onError: (error) => {
      console.error('Generation failed:', error);
      setIsGenerating(false);
    }
  });

  return {
    generate: generateMutation.mutate,
    isGenerating: generateMutation.isPending,
    error: generateMutation.error
  };
};

export const useImageEditing = () => {
  const { 
    addEdit, 
    setIsGenerating, 
    setCanvasImage, 
    canvasImage, 
    editReferenceImages,
    brushStrokes,
    selectedGenerationId,
    currentProject,
    seed,
    temperature 
  } = useAppStore();

  const editMutation = useMutation({
    mutationFn: async (instruction: string) => {
      // Always use canvas image as primary target if available, otherwise use first uploaded image
      const { uploadedImages } = useAppStore.getState();
      const sourceImage = canvasImage || uploadedImages[0];
      if (!sourceImage) throw new Error('No image to edit');
      
      // Convert canvas image to base64
      const base64Image = sourceImage.includes('base64,') 
        ? sourceImage.split('base64,')[1] 
        : sourceImage;
      
      // Get reference images for style guidance
      let referenceImages = editReferenceImages
        .filter(img => img.includes('base64,'))
        .map(img => img.split('base64,')[1]);
      
      let maskImage: string | undefined;
      let maskedReferenceImage: string | undefined;
      
      // Create mask from brush strokes if any exist
      if (brushStrokes.length > 0) {
        // Create a temporary image to get actual dimensions
        const tempImg = new Image();
        tempImg.src = sourceImage;
        await new Promise<void>((resolve) => {
          tempImg.onload = () => resolve();
        });
        
        // Create mask canvas with exact image dimensions
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        canvas.width = tempImg.width;
        canvas.height = tempImg.height;
        
        // Fill with black (unmasked areas)
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw white strokes (masked areas)
        ctx.strokeStyle = 'white';
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        brushStrokes.forEach(stroke => {
          if (stroke.points.length >= 4) {
            ctx.lineWidth = stroke.brushSize;
            ctx.beginPath();
            ctx.moveTo(stroke.points[0], stroke.points[1]);
            
            for (let i = 2; i < stroke.points.length; i += 2) {
              ctx.lineTo(stroke.points[i], stroke.points[i + 1]);
            }
            ctx.stroke();
          }
        });
        
        // Convert mask to base64
        const maskDataUrl = canvas.toDataURL('image/png');
        maskImage = maskDataUrl.split('base64,')[1];
        
        // Create masked reference image (original image with mask overlay)
        const maskedCanvas = document.createElement('canvas');
        const maskedCtx = maskedCanvas.getContext('2d')!;
        maskedCanvas.width = tempImg.width;
        maskedCanvas.height = tempImg.height;
        
        // Draw original image
        maskedCtx.drawImage(tempImg, 0, 0);
        
        // Draw mask overlay with transparency
        maskedCtx.globalCompositeOperation = 'source-over';
        maskedCtx.globalAlpha = 0.4;
       maskedCtx.fillStyle = '#A855F7';
        
        brushStrokes.forEach(stroke => {
          if (stroke.points.length >= 4) {
            maskedCtx.lineWidth = stroke.brushSize;
           maskedCtx.strokeStyle = '#A855F7';
            maskedCtx.lineCap = 'round';
            maskedCtx.lineJoin = 'round';
            maskedCtx.beginPath();
            maskedCtx.moveTo(stroke.points[0], stroke.points[1]);
            
            for (let i = 2; i < stroke.points.length; i += 2) {
              maskedCtx.lineTo(stroke.points[i], stroke.points[i + 1]);
            }
            maskedCtx.stroke();
          }
        });
        
        maskedCtx.globalAlpha = 1;
        maskedCtx.globalCompositeOperation = 'source-over';
        
        const maskedDataUrl = maskedCanvas.toDataURL('image/png');
        maskedReferenceImage = maskedDataUrl.split('base64,')[1];
        
        // Add the masked image as a reference for the model
        referenceImages = [maskedReferenceImage, ...referenceImages];
      }
      
      const request: EditRequest = {
        instruction,
        originalImage: base64Image,
        referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
        maskImage,
        temperature,
        seed: seed || undefined
      };
      
      const { images, text } = await geminiService.editImage(request);
      return { images, maskedReferenceImage, text };
    },
    onMutate: () => {
      setIsGenerating(true);
    },
    onSuccess: ({ images, maskedReferenceImage, text }, instruction) => {
      if (images.length > 0) {
        const outputAssets: Asset[] = images.map((base64) => ({
          id: generateId(),
          type: 'output',
          url: `data:image/png;base64,${base64}`,
          mime: 'image/png',
          width: 1024,
          height: 1024,
          checksum: base64.slice(0, 32)
        }));

        // Create mask reference asset if we have one
        const maskReferenceAsset: Asset | undefined = maskedReferenceImage ? {
          id: generateId(),
          type: 'mask',
          url: `data:image/png;base64,${maskedReferenceImage}`,
          mime: 'image/png',
          width: 1024,
          height: 1024,
          checksum: maskedReferenceImage.slice(0, 32)
        } : undefined;

        const edit: Edit = {
          id: generateId(),
          parentGenerationId: selectedGenerationId || (currentProject?.generations[currentProject.generations.length - 1]?.id || ''),
          maskAssetId: brushStrokes.length > 0 ? generateId() : undefined,
          maskReferenceAsset,
          instruction,
          outputAssets,
          timestamp: Date.now(),
          responseText: text
        };

        addEdit(edit);
        
        // Automatically load the edited image in the canvas
        const { selectEdit, selectGeneration } = useAppStore.getState();
        setCanvasImage(outputAssets[0].url);
        selectEdit(edit.id);
        selectGeneration(null);
      }
      setIsGenerating(false);
    },
    onError: (error) => {
      console.error('Edit failed:', error);
      setIsGenerating(false);
    }
  });

  return {
    edit: editMutation.mutate,
    isEditing: editMutation.isPending,
    error: editMutation.error
  };
};