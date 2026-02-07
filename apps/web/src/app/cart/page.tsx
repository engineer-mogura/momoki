'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCart } from '@/hooks/useCart';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';

export default function CartPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { items, updateQuantity, removeItem, clearCart, totalAmount, isLoaded } = useCart();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const handleSubmitOrder = () => {
    if (!user) {
      router.push('/auth/line/start');
      return;
    }
    if (items.length === 0) return;
    setShowConfirmModal(true);
  };

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
              <span className="text-2xl font-bold">&yen;{totalAmount.toLocaleString()}</span>
            </div>
            <button
              onClick={handleSubmitOrder}
              disabled={isSubmitting}
              className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-slate-300 text-white font-semibold py-4 rounded-lg transition"
            >
              {isSubmitting ? '送信中...' : user ? '注文を確定する' : 'ログインして注文'}
            </button>
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
                <span>&yen;{totalAmount.toLocaleString()}</span>
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
