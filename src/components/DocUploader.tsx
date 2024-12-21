// src/components/DocUploader.tsx
'use client';

import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { auth } from '@/lib/firebase';
import type { AnalysisResult } from '@/types';

interface DocUploaderProps {
  onAnalysis: (result: AnalysisResult) => void;
}

export default function DocUploader({ onAnalysis }: DocUploaderProps) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!auth.currentUser) {
      toast.error('Please sign in to analyze documentation');
      return;
    }

    setLoading(true);

    try {
      // Get the current user's ID token
      const token = await auth.currentUser.getIdToken();

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();

      if (data.success) {
        onAnalysis(data);
        toast.success('Documentation analyzed successfully!');
        setUrl(''); // Clear the input after success
      } else {
        throw new Error(data.error || 'Failed to analyze documentation');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to analyze documentation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label 
            htmlFor="url" 
            className="block text-sm font-medium text-gray-700 dark:text-gray-200"
          >
            Documentation URL
          </label>
          <div className="mt-1">
            <input
              type="url"
              id="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://docs.example.com"
              className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              required
              disabled={loading}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !url}
          className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed ${
            loading ? 'cursor-wait' : ''
          }`}
        >
          {loading ? (
            <div className="flex items-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Analyzing...
            </div>
          ) : (
            'Analyze Documentation'
          )}
        </button>
      </form>
    </div>
  );
}