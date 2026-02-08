'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCart } from '@/hooks/useCart';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';

type PreviewItem = {
  menu_item_id: number;
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
  is_orderable: boolean;
};

type OrderPreview = {
  canCheckout: boolean;
  reason: string | null;
  total_amount: number;
  items: PreviewItem[];
};

export default function CartPage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const { items, updateQuantity, removeItem, clearCart, totalAmount, isLoaded } = useCart();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [previewStatus, setPreviewStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [preview, setPreview] = useState<OrderPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [fadeInReady, setFadeInReady] = useState(false);
  const requestSeqRef = useRef(0);

  const handleSubmitOrder = () => {
    if (!user) {
      router.push('/auth/line/start');
      return;
    }
    if (items.length === 0) return;
    setShowConfirmModal(true);
  };

  const fetchPreview = async () => {
    if (!user) return;
    if (items.length === 0) return;

    const seq = ++requestSeqRef.current;
    setPreviewStatus('loading');
    setPreviewError(null);
    setPreview(null);

    try {
      const res = await api.post<OrderPreview>('/api/orders/preview', {
        items: items.map((item) => ({
          menu_item_id: item.menuItem.id,
          quantity: item.quantity,
        })),
      });
      if (seq !== requestSeqRef.current) return;
      setPreview(res);
      setPreviewStatus('ready');
    } catch (err) {
      if (seq !== requestSeqRef.current) return;
      setPreviewStatus('error');
      setPreviewError(err instanceof Error ? err.message : '読み込みに失敗しました');
    }
  };

  // Preview gating for CTA (avoid flicker)
  useEffect(() => {
    if (!isLoaded) return;
    if (isAuthLoading) return;

    // Not logged in -> no preview call
    if (!user) {
      setPreviewStatus('idle');
      setPreview(null);
      setPreviewError(null);
      return;
    }

    if (items.length === 0) {
      setPreviewStatus('idle');
      setPreview(null);
      setPreviewError(null);
      return;
    }

    fetchPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isAuthLoading, user?.id, items]);

  // Fade-in when "注文確定" becomes available
  useEffect(() => {
    if (previewStatus === 'ready' && preview?.canCheckout) {
      setFadeInReady(false);
      const t = window.setTimeout(() => setFadeInReady(true), 10);
      return () => window.clearTimeout(t);
    }
    setFadeInReady(false);
  }, [previewStatus, preview?.canCheckout]);

  const handleConfirmOrder = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      await api.post('/api/orders', {
        items: items.map((item) => ({
          menu_item_id: item.menuItem.id,
          quantity: item.quantity,
        })),
      });
      clearCart();
      setShowConfirmModal(false);
      router.push('/orders');
    } catch (err) {
      setError(err instanceof Error ? err.message : '注文の送信に失敗しました');
      setShowConfirmModal(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-24">
      {/* Header */}
      <header className="bg-white sticky top-0 z-10 shadow-sm border-b border-slate-200">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/menu" className="text-slate-500 hover:text-slate-900 transition">
              &larr; メニューへ戻る
            </Link>
            <h1 className="text-xl font-bold">カート</h1>
            <div className="w-20"></div>
          </div>
        </div>
      </header>

      {/* Cart Items */}
      <main className="container mx-auto px-4 py-6">
        {items.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-500 mb-6">カートは空です</p>
            <Link
              href="/menu"
              className="bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 px-6 rounded-lg transition"
            >
              メニューを見る
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <div
                key={item.menuItem.id}
                className="bg-white rounded-lg p-4 flex items-center justify-between shadow-sm border border-slate-200"
              >
                <div className="flex-1">
                  <h3 className="font-semibold">{item.menuItem.name}</h3>
                  <p className="text-primary-600">
                    &yen;{item.menuItem.price.toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center bg-slate-100 rounded-lg">
                    <button
                      onClick={() => updateQuantity(item.menuItem.id, item.quantity - 1)}
                      className="px-3 py-1 text-lg hover:bg-slate-200 rounded-l-lg transition"
                    >
                      -
                    </button>
                    <span className="px-3 py-1 min-w-[40px] text-center">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.menuItem.id, item.quantity + 1)}
                      className="px-3 py-1 text-lg hover:bg-slate-200 rounded-r-lg transition"
                    >
                      +
                    </button>
                  </div>
                  <button
                    onClick={() => removeItem(item.menuItem.id)}
                    className="text-red-500 hover:text-red-600 transition p-2"
                  >
                    削除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}
      </main>

      {/* Order Footer */}
      {items.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
          <div className="container mx-auto">
            <div className="flex items-center justify-between mb-4">
              <span className="text-slate-500">合計</span>
              <span className="text-2xl font-bold">
                &yen;{(preview?.total_amount ?? totalAmount).toLocaleString()}
              </span>
            </div>

            {/* CTA: show only after API/auth result is determined */}
            {isAuthLoading ? (
              <button
                disabled
                className="w-full bg-slate-300 text-white font-semibold py-4 rounded-lg transition flex items-center justify-center gap-2"
              >
                <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                確認中...
              </button>
            ) : !user ? (
              <button
                onClick={handleSubmitOrder}
                className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-4 rounded-lg transition"
              >
                ログインして注文
              </button>
            ) : previewStatus === 'error' ? (
              <div className="space-y-2">
                <div className="text-sm text-red-600">読み込みに失敗しました</div>
                <button
                  onClick={fetchPreview}
                  disabled={isSubmitting}
                  className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-semibold py-4 rounded-lg transition"
                >
                  再読み込み
                </button>
                {previewError && <div className="text-xs text-slate-500">{previewError}</div>}
              </div>
            ) : previewStatus !== 'ready' ? (
              <button
                disabled
                className="w-full bg-slate-300 text-white font-semibold py-4 rounded-lg transition flex items-center justify-center gap-2"
              >
                <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                確認中...
              </button>
            ) : (
              <div className="space-y-2">
                <button
                  onClick={handleSubmitOrder}
                  disabled={isSubmitting || !preview?.canCheckout}
                  className={`w-full font-semibold py-4 rounded-lg transition ${
                    preview?.canCheckout
                      ? `bg-primary-600 hover:bg-primary-700 text-white transition-opacity duration-200 ${
                          fadeInReady ? 'opacity-100' : 'opacity-0'
                        }`
                      : 'bg-slate-300 text-white'
                  }`}
                >
                  {isSubmitting ? '送信中...' : '注文を確定する'}
                </button>
                {!preview?.canCheckout && (
                  <div className="text-xs text-slate-600">{preview?.reason || '現在は注文できません'}</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm mx-4 shadow-xl">
            <h2 className="text-lg font-bold text-slate-900 mb-4">注文内容の確認</h2>

            <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
              {items.map((item) => (
                <div key={item.menuItem.id} className="flex justify-between text-sm">
                  <span className="text-slate-700">
                    {item.menuItem.name} x{item.quantity}
                  </span>
                  <span className="text-slate-500">
                    &yen;{(item.menuItem.price * item.quantity).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-200 pt-3 mb-4">
              <div className="flex justify-between font-bold">
                <span>合計</span>
                <span>&yen;{(preview?.total_amount ?? totalAmount).toLocaleString()}</span>
              </div>
            </div>

            <p className="text-slate-500 text-xs mb-4">
              注文後のキャンセルはスタッフまでお申し付けください。
            </p>

            <button
              onClick={handleConfirmOrder}
              disabled={isSubmitting}
              className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-slate-300 text-white font-semibold py-3 rounded-lg transition mb-2"
            >
              {isSubmitting ? '送信中...' : '注文する'}
            </button>
            <button
              onClick={() => setShowConfirmModal(false)}
              disabled={isSubmitting}
              className="w-full text-slate-500 hover:text-slate-900 text-sm transition py-2"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
