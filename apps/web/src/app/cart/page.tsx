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

  const handleSubmitOrder = async () => {
    if (!user) {
      router.push('/auth/line/start');
      return;
    }

    if (items.length === 0) {
      return;
    }

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
      router.push('/orders');
    } catch (err) {
      setError(err instanceof Error ? err.message : '注文の送信に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white pb-24">
      {/* Header */}
      <header className="bg-gray-800 sticky top-0 z-10 shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/menu" className="text-gray-400 hover:text-white transition">
              ← メニューへ戻る
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
            <p className="text-gray-400 mb-6">カートは空です</p>
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
                className="bg-gray-800 rounded-lg p-4 flex items-center justify-between"
              >
                <div className="flex-1">
                  <h3 className="font-semibold">{item.menuItem.name}</h3>
                  <p className="text-primary-400">
                    ¥{item.menuItem.price.toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center bg-gray-700 rounded-lg">
                    <button
                      onClick={() => updateQuantity(item.menuItem.id, item.quantity - 1)}
                      className="px-3 py-1 text-lg hover:bg-gray-600 rounded-l-lg transition"
                    >
                      -
                    </button>
                    <span className="px-3 py-1 min-w-[40px] text-center">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.menuItem.id, item.quantity + 1)}
                      className="px-3 py-1 text-lg hover:bg-gray-600 rounded-r-lg transition"
                    >
                      +
                    </button>
                  </div>
                  <button
                    onClick={() => removeItem(item.menuItem.id)}
                    className="text-red-400 hover:text-red-300 transition p-2"
                  >
                    削除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="mt-4 p-4 bg-red-900/50 border border-red-500 rounded-lg text-red-200">
            {error}
          </div>
        )}
      </main>

      {/* Order Footer */}
      {items.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 p-4">
          <div className="container mx-auto">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-400">合計</span>
              <span className="text-2xl font-bold">¥{totalAmount.toLocaleString()}</span>
            </div>
            <button
              onClick={handleSubmitOrder}
              disabled={isSubmitting}
              className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-gray-600 text-white font-semibold py-4 rounded-lg transition"
            >
              {isSubmitting ? '送信中...' : user ? '注文を確定する' : 'ログインして注文'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
