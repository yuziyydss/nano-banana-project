import { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';

export const useKeyboardShortcuts = () => {
  const {
    setSelectedTool,
    currentPrompt,
    isGenerating
  } = useAppStore();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (event.target instanceof HTMLInputElement || 
          event.target instanceof HTMLTextAreaElement) {
        // Only handle Cmd/Ctrl + Enter for generation
        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
          event.preventDefault();
          if (!isGenerating && currentPrompt.trim()) {
            console.log('Generate via keyboard shortcut');
          }
        }
        return;
      }

      switch (event.key.toLowerCase()) {
        case 'e':
          event.preventDefault();
          setSelectedTool('edit');
          break;
        case 'g':
          event.preventDefault();
          setSelectedTool('generate');
          break;
        case 'm':
          event.preventDefault();
          setSelectedTool('mask');
          break;
        // 移除了 h 和 p 快捷键，因为新界面不需要切换面板
        case 'r':
          if (event.shiftKey) {
            event.preventDefault();
            console.log('Re-roll variants');
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setSelectedTool, currentPrompt, isGenerating]);
};