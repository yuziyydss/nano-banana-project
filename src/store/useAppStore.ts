import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { Project, Generation, Edit, BrushStroke, ChatSession, Message } from '../types';

interface AppState {
  // Current project
  currentProject: Project | null;
  
  // Chat sessions
  chatSessions: ChatSession[];
  currentSessionId: string | null;
  
  // Canvas state
  canvasImage: string | null;
  canvasZoom: number;
  canvasPan: { x: number; y: number };
  
  // Upload state
  uploadedImages: string[];
  editReferenceImages: string[];
  
  // Brush strokes for painting masks
  brushStrokes: BrushStroke[];
  brushSize: number;
  showMasks: boolean;
  
  // Generation state
  isGenerating: boolean;
  currentPrompt: string;
  temperature: number;
  seed: number | null;
  
  // History and variants
  selectedGenerationId: string | null;
  selectedEditId: string | null;
  showHistory: boolean;
  
  // Panel visibility
  showPromptPanel: boolean;
  
  // UI state
  selectedTool: 'generate' | 'edit' | 'mask';
  
  // Actions
  setCurrentProject: (project: Project | null) => void;
  setCanvasImage: (url: string | null) => void;
  setCanvasZoom: (zoom: number) => void;
  setCanvasPan: (pan: { x: number; y: number }) => void;
  
  addUploadedImage: (url: string) => void;
  removeUploadedImage: (index: number) => void;
  updateUploadedImage: (index: number, url: string) => void;
  clearUploadedImages: () => void;
  
  addEditReferenceImage: (url: string) => void;
  removeEditReferenceImage: (index: number) => void;
  clearEditReferenceImages: () => void;
  
  addBrushStroke: (stroke: BrushStroke) => void;
  clearBrushStrokes: () => void;
  setBrushSize: (size: number) => void;
  setShowMasks: (show: boolean) => void;
  
  setIsGenerating: (generating: boolean) => void;
  setCurrentPrompt: (prompt: string) => void;
  setTemperature: (temp: number) => void;
  setSeed: (seed: number | null) => void;
  
  addGeneration: (generation: Generation) => void;
  addEdit: (edit: Edit) => void;
  selectGeneration: (id: string | null) => void;
  selectEdit: (id: string | null) => void;
  setShowHistory: (show: boolean) => void;
  
  setShowPromptPanel: (show: boolean) => void;
  
  setSelectedTool: (tool: 'generate' | 'edit' | 'mask') => void;
  
  // Chat session actions
  createNewSession: () => string;
  switchToSession: (sessionId: string) => void;
  deleteSession: (sessionId: string) => void;
  addMessageToCurrentSession: (message: Message) => void;
  updateSessionTitle: (sessionId: string, title: string) => void;
  getCurrentSession: () => ChatSession | null;
}

export const useAppStore = create<AppState>()(
  devtools(
    (set, get) => ({
      // Initial state
      currentProject: null,
      chatSessions: [],
      currentSessionId: null,
      canvasImage: null,
      canvasZoom: 1,
      canvasPan: { x: 0, y: 0 },
      
      uploadedImages: [],
      editReferenceImages: [],
      
      brushStrokes: [],
      brushSize: 20,
      showMasks: true,
      
      isGenerating: false,
      currentPrompt: '',
      temperature: 0.7,
      seed: null,
      
      selectedGenerationId: null,
      selectedEditId: null,
      showHistory: true,
      
      showPromptPanel: true,
      
      selectedTool: 'generate',
      
      // Actions
      setCurrentProject: (project) => set({ currentProject: project }),
      setCanvasImage: (url) => set({ canvasImage: url }),
      setCanvasZoom: (zoom) => set({ canvasZoom: zoom }),
      setCanvasPan: (pan) => set({ canvasPan: pan }),
      
      addUploadedImage: (url) => set((state) => ({ 
        uploadedImages: [...state.uploadedImages, url] 
      })),
      removeUploadedImage: (index) => set((state) => ({ 
        uploadedImages: state.uploadedImages.filter((_, i) => i !== index) 
      })),
      updateUploadedImage: (index, url) => set((state) => ({
        uploadedImages: state.uploadedImages.map((u, i) => (i === index ? url : u))
      })),
      clearUploadedImages: () => set({ uploadedImages: [] }),
      
      addEditReferenceImage: (url) => set((state) => ({ 
        editReferenceImages: [...state.editReferenceImages, url] 
      })),
      removeEditReferenceImage: (index) => set((state) => ({ 
        editReferenceImages: state.editReferenceImages.filter((_, i) => i !== index) 
      })),
      clearEditReferenceImages: () => set({ editReferenceImages: [] }),
      
      addBrushStroke: (stroke) => set((state) => ({ 
        brushStrokes: [...state.brushStrokes, stroke] 
      })),
      clearBrushStrokes: () => set({ brushStrokes: [] }),
      setBrushSize: (size) => set({ brushSize: size }),
      setShowMasks: (show) => set({ showMasks: show }),
      
      setIsGenerating: (generating) => set({ isGenerating: generating }),
      setCurrentPrompt: (prompt) => set({ currentPrompt: prompt }),
      setTemperature: (temp) => set({ temperature: temp }),
      setSeed: (seed) => set({ seed: seed }),
      
      addGeneration: (generation) => set((state) => ({
        currentProject: state.currentProject ? {
          ...state.currentProject,
          generations: [...state.currentProject.generations, generation],
          updatedAt: Date.now()
        } : null
      })),
      
      addEdit: (edit) => set((state) => ({
        currentProject: state.currentProject ? {
          ...state.currentProject,
          edits: [...state.currentProject.edits, edit],
          updatedAt: Date.now()
        } : null
      })),
      
      selectGeneration: (id) => set({ selectedGenerationId: id }),
      selectEdit: (id) => set({ selectedEditId: id }),
      setShowHistory: (show) => set({ showHistory: show }),
      
      setShowPromptPanel: (show) => set({ showPromptPanel: show }),
      
      setSelectedTool: (tool) => set({ selectedTool: tool }),
      
      // Chat session actions
      createNewSession: () => {
        const newSessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const newSession: ChatSession = {
          id: newSessionId,
          title: '新对话',
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        
        set((state) => ({
          chatSessions: [...state.chatSessions, newSession],
          currentSessionId: newSessionId
        }));
        
        return newSessionId;
      },
      
      switchToSession: (sessionId) => set({ 
        currentSessionId: sessionId,
        // 切换会话时清理与会话绑定的易混淆临时状态
        canvasImage: null,
        uploadedImages: [],
        editReferenceImages: [],
        brushStrokes: []
      }),
      
      deleteSession: (sessionId) => set((state) => {
        const updatedSessions = state.chatSessions.filter(s => s.id !== sessionId);
        const newCurrentId = state.currentSessionId === sessionId 
          ? (updatedSessions.length > 0 ? updatedSessions[0].id : null)
          : state.currentSessionId;
        
        return {
          chatSessions: updatedSessions,
          currentSessionId: newCurrentId
        };
      }),
      
      addMessageToCurrentSession: (message) => set((state) => {
        if (!state.currentSessionId) return state;
        
        const updatedSessions = state.chatSessions.map(session => {
          if (session.id === state.currentSessionId) {
            const updatedSession = {
              ...session,
              messages: [...session.messages, message],
              updatedAt: Date.now()
            };
            
            // 自动更新标题（如果是第一条用户消息）
            if (session.messages.length === 0 && message.role === 'user' && message.text) {
              updatedSession.title = message.text.slice(0, 20) + (message.text.length > 20 ? '...' : '');
            }
            
            return updatedSession;
          }
          return session;
        });
        
        return { chatSessions: updatedSessions };
      }),
      
      updateSessionTitle: (sessionId, title) => set((state) => ({
        chatSessions: state.chatSessions.map(session =>
          session.id === sessionId ? { ...session, title, updatedAt: Date.now() } : session
        )
      })),
      
      getCurrentSession: () => {
        const state = get();
        return state.chatSessions.find(s => s.id === state.currentSessionId) || null;
      }
    }),
    { name: 'nano-banana-store' }
  )
);