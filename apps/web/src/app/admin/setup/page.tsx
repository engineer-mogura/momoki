'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';

const isSetupEnabled = process.env.NEXT_PUBLIC_ADMIN_SETUP_ENABLED !== 'false';

export default function AdminSetupPage() {
  const router = useRouter();
  const { user, isLoading, refetch } = useAuth();
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 未ログインならトップへ
  if (!isLoading && !user) {
    router.replace('/');
    return null;
  }

  // 既に管理者なら /admin へ
  if (!isLoading && user?.is_admin) {
    router.replace('/admin');
    return null;
  }

  // セットアップ無効時
  if (!isSetupEnabled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="bg-gray-800 rounded-lg p-8 w-full max-w-md mx-4 text-center">
          <h1 className="text-xl font-bold text-white mb-4">現在無効です</h1>
          <p className="text-gray-400 text-sm mb-6">管理者登録は現在受け付けていません。</p>
          <button
            onClick={() => router.push('/')}
            className="bg-primary-600 hover:bg-primary-700 text-white font-semibold py-2 px-6 rounded-lg transition"
          >
            トップへ戻る
          </button>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await api.post('/api/admin/setup', { invite_code: inviteCode });
      await refetch();
      router.replace('/admin');
    } catch (err) {
      setError(err instanceof Error ? err.message : '招待コードが正しくありません');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="bg-gray-800 rounded-lg p-8 w-full max-w-md mx-4">
        <h1 className="text-2xl font-bold text-white mb-2 text-center">
          管理者登録
        </h1>
        <p className="text-gray-400 text-sm text-center mb-6">
          招待コードを入力してください
        </p>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            placeholder="招待コード"
            className="w-full bg-gray-700 text-white rounded-lg px-4 py-3 mb-4 focus:outline-none focus:ring-2 focus:ring-primary-600"
            disabled={isSubmitting}
            autoFocus
          />

          {error && (
            <p className="text-red-400 text-sm mb-4">{error}</p>
          )}

          <button
            type="submit"
            disabled={isSubmitting || !inviteCode.trim()}
            className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition"
          >
            {isSubmitting ? '確認中...' : '登録'}
          </button>
        </form>

        <button
          onClick={() => router.push('/')}
          className="w-full mt-4 text-gray-400 hover:text-white text-sm transition"
        >
          トップへ戻る
        </button>
      </div>
    </div>
  );
}
