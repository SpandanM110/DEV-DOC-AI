// src/components/AnalysisDisplay.tsx
'use client';

import { useState, useEffect } from 'react';

export default function AnalysisDisplay({ analysis }: { analysis: string }) {
  const [sections, setSections] = useState<string[]>([]);

  useEffect(() => {
    if (analysis) {
      setSections(analysis.split('\n\n').filter(Boolean));
    }
  }, [analysis]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg h-full flex flex-col transition-colors">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
          Analysis Results
        </h2>
      </div>
      
      <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
        <div className="prose dark:prose-invert prose-pre:bg-gray-100 dark:prose-pre:bg-gray-700 prose-pre:text-gray-800 dark:prose-pre:text-gray-200 max-w-none">
          {sections.map((section, index) => (
            <div 
              key={index} 
              className="mb-6 last:mb-0"
            >
              <div className="whitespace-pre-wrap text-gray-800 dark:text-gray-200 leading-relaxed">
                {section.split('\n').map((line, lineIndex) => {
                  // Check if line is a header
                  if (line.startsWith('#') || /^\d+\./.test(line)) {
                    return (
                      <h3 key={lineIndex} className="text-lg font-semibold text-gray-900 dark:text-white mb-2 mt-4">
                        {line.replace(/^#+ /, '')}
                      </h3>
                    );
                  }
                  // Check if line is a code block
                  if (line.trim().startsWith('```') || line.trim().startsWith('`')) {
                    return (
                      <pre key={lineIndex} className="bg-gray-100 dark:bg-gray-700 p-3 rounded-md my-2 overflow-x-auto">
                        <code className="text-gray-800 dark:text-gray-200">
                          {line.replace(/```\w*/, '').replace(/`/g, '')}
                        </code>
                      </pre>
                    );
                  }
                  // Regular text
                  return (
                    <p key={lineIndex} className="text-gray-800 dark:text-gray-200 mb-2">
                      {line}
                    </p>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}