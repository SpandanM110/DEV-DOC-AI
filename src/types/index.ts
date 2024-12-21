// src/types/index.ts
export interface DocAnalysis {
    url: string;
    content: string;
    analysis: string;
    timestamp: Date;
  }
  
  export interface AnalysisResult {
    success: boolean;
    analysis?: string;
    error?: string;
  }
  
  export interface UploadState {
    loading: boolean;
    error: string | null;
    data: AnalysisResult | null;
  }

  

  export interface AnalysisResult {
    success: boolean;
    analysis?: string;
    content?: string;
    error?: string;
    metadata?: {
      url: string;
      timestamp: string;
      contentLength: number;
    };
  }
  
  export interface ChatMessage {
    type: 'question' | 'answer';
    content: string;
  }