import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ChatInterface } from './components/ChatInterface';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useAppStore } from './store/useAppStore';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 2,
    },
  },
});

function AppContent() {
  useKeyboardShortcuts();
  
  return (
    <div className="min-h-screen" style={{ background: '#f7f7f8' }}>
      <ChatInterface />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}

export default App;