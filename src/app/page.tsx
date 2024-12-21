// src/app/page.tsx
'use client';

import { useState } from 'react';
import { Toaster } from 'react-hot-toast';
import Header from '@/components/Header';
import DocUploader from '@/components/DocUploader';
import AnalysisDisplay from '@/components/AnalysisDisplay';
import ChatInterface from '@/components/ChatInterface';
import AuthGuard from '@/components/AuthGuard';
import type { AnalysisResult } from '@/types';

export default function Home() {
  const [analysis, setAnalysis] = useState<string>('');
  const [docContent, setDocContent] = useState<string>('');

  const handleAnalysis = (result: AnalysisResult) => {
    if (result.success && result.analysis) {
      setAnalysis(result.analysis);
      if (result.content) {
        setDocContent(result.content);
      }
    }
  };

  return (
    <AuthGuard>
      <div className="flex flex-col min-h-screen">
        <Toaster position="top-right" />
        <Header />
        
        <main className="flex-1 container mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-6">
              <DocUploader onAnalysis={handleAnalysis} />
              {docContent && (
                <div className="h-[calc(100vh-24rem)]">
                  <ChatInterface docContent={docContent} />
                </div>
              )}
            </div>
            {analysis && (
              <div className="h-[calc(100vh-24rem)]">
                <AnalysisDisplay analysis={analysis} />
              </div>
            )}
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}