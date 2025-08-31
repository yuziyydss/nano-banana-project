import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, ExternalLink, Lightbulb, Download } from 'lucide-react';
import { Button } from './ui/Button';

interface InfoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const InfoModal: React.FC<InfoModalProps> = ({ open, onOpenChange }) => {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-gray-900 border border-gray-700 rounded-lg p-6 w-full max-w-4xl z-50">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-lg font-semibold text-gray-100">
              About Nano Banana AI Image Editor
            </Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <X className="h-4 w-4" />
              </Button>
            </Dialog.Close>
          </div>
          
          <div className="space-y-4">
            <div className="space-y-3 text-sm text-gray-300">
              <p>
                Developed by{' '}
                <a
                  href="https://markfulton.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-yellow-400 hover:text-yellow-300 transition-colors font-semibold"
                >
                  Mark Fulton
                  <ExternalLink className="h-3 w-3 inline ml-1" />
                </a>
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-4 bg-gradient-to-br from-purple-900/30 to-indigo-900/30 rounded-lg border border-purple-500/30">
                  <div className="flex items-center mb-3">
                    <Lightbulb className="h-5 w-5 text-purple-400 mr-2" />
                    <h4 className="text-sm font-semibold text-purple-300">
                      Learn to Build AI Apps & More Solutions
                    </h4>
                  </div>
                  <p className="text-sm text-gray-300 mb-4">
                    Learn to vibe code apps like this one and master AI automation, build intelligent agents, and create cutting-edge solutions that drive real business results.
                  </p>
                  <a
                    href="https://www.reinventing.ai/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-lg transition-all duration-200 font-medium"
                  >
                    Join the AI Accelerator Program
                    <ExternalLink className="h-4 w-4 ml-1" />
                  </a>
                </div>
                
                <div className="p-4 bg-gradient-to-br from-yellow-900/30 to-orange-900/30 rounded-lg border border-yellow-500/30">
                  <div className="flex items-center mb-3">
                    <Download className="h-5 w-5 text-yellow-400 mr-2" />
                    <h4 className="text-sm font-semibold text-yellow-300">
                      Get a Copy of This App
                    </h4>
                  </div>
                  <p className="text-sm text-gray-300 mb-4">
                    Get a copy of this app by joining the Vibe Coding is Life Skool community. Live build sessions, app projects, resources and more in the best vibe coding community on the web.
                  </p>
                  <a
                    href="https://www.skool.com/vibe-coding-is-life/about?ref=456537abaf37491cbcc6976f3c26af41"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 text-white rounded-lg transition-all duration-200 font-medium"
                  >
                    Join Vibe Coding is Life Community
                    <ExternalLink className="h-4 w-4 ml-1" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};