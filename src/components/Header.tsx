// src/components/Header.tsx
'use client';

import ThemeToggle from './ThemeToggle';
import AuthButton from './AuthButton';

export default function Header() {
  return (
    <header className="bg-white dark:bg-gray-800 shadow">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
              DEV DOC AI
            </h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              Analyze developer documentation and get structured summaries
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <ThemeToggle />
            <AuthButton />
          </div>
        </div>
      </div>
    </header>
  );
}