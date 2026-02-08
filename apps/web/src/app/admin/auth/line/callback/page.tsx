'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getStoredAuthParams, clearStoredAuthParams } from '@/lib/line';
import { api, setAuthToken } from '@/lib/api';

export default function AdminLineLoginCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const sentRef = useRef(false);

  useEffect(() => {
    // StrictMode の二重実行を防止
    if (sentRef.current) return;
    sentRef.current = true;

    const handleCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const errorParam = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      if (errorParam) {
        setError(errorDescription || errorParam);
        return;
      }

      if (!code || !state) {
        setError('認証情報が不足しています');
        return;
      }

      // 同じ code を処理済みならスキップ
      const processedKey = `line_cb_done:${code}`;
      if (sessionStorage.getItem(processedKey)) {
        router.replace('/admin');
        return;
      }

      const storedParams = getStoredAuthParams();
      if (!storedParams) {
        setError('認証セッションが見つかりません');
        return;
      }

      if (state !== storedParams.state) {
        setError('認証状態が一致しません');
        return;
      }

      const redirectTo = storedParams.postLoginRedirect || '/admin';

      try {
        const response = await api.post<{ user: unknown; token: string }>('/api/auth/line/callback', {
          code,
          code_verifier: storedParams.codeVerifier,
        });

        if (response.token) {
          setAuthToken(response.token);
        }

        sessionStorage.setItem(processedKey, '1');
        clearStoredAuthParams();
        router.replace(redirectTo);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'ログインに失敗しました');
      }
    };

    handleCallback();
  }, [searchParams, router]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center text-white max-w-md px-4">
          <div className="text-red-500 text-5xl mb-4">!</div>
          <h1 className="text-xl font-bold mb-2">ログインエラー</h1>
          <p className="text-gray-400 mb-6">{error}</p>
          <button
            onClick={() => router.push('/admin')}
            className="bg-primary-600 hover:bg-primary-700 text-white font-semibold py-2 px-6 rounded-lg transition"
          >
            管理画面へ戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="text-center text-white">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
        <p>ログイン処理中...</p>
      </div>
    </div>
  );
}

