import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ChatInterface } from './components/ChatInterface';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
// Removed unused: import { useAppStore } from './store/useAppStore';
import { Header } from './components/Header';

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
    <div className="h-screen flex flex-col min-h-0" style={{ background: '#f7f7f8' }}>
      <Header />
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