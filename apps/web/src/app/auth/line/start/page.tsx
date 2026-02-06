'use client';

import { useEffect } from 'react';
import { startLineLogin } from '@/lib/line';

export default function LineLoginStart() {
  useEffect(() => {
    startLineLogin();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="text-center text-white">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
        <p>LINEログインへリダイレクト中...</p>
      </div>
    </div>
  );
}
