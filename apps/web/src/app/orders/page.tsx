'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Order } from '@/types';
import { useAuth } from '@/hooks/useAuth';

const STATUS_LABELS: Record<Order['status'], string> = {
  preparing: '準備中',
  served: '提供済み',
  paid: '会計済み',
  cancelled: 'キャンセル',
};

const STATUS_COLORS: Record<Order['status'], string> = {
  preparing: 'bg-yellow-500',
  served: 'bg-green-500',
  paid: 'bg-gray-500',
  cancelled: 'bg-red-500',
};

export default function OrdersPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOrders = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await api.get<{ orders: Order[] }>('/api/orders');
        setOrders(response.orders);
      } catch (err) {
        setError(err instanceof Error ? err.message : '注文履歴の取得に失敗しました');
      } finally {
        setIsLoading(false);
      }
    };

    if (!isAuthLoading) {
      fetchOrders();
    }
  }, [user, isAuthLoading]);

  if (isAuthLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center text-white">
          <p className="text-gray-400 mb-6">注文履歴を見るにはログインが必要です</p>
          <Link
            href="/auth/line/start"
            className="bg-[#00B900] hover:bg-[#00a000] text-white font-semibold py-3 px-6 rounded-lg transition"
          >
            LINEでログイン
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 sticky top-0 z-10 shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-gray-400 hover:text-white transition">
              ← ホームへ戻る
            </Link>
            <h1 className="text-xl font-bold">注文履歴</h1>
            <div className="w-20"></div>
          </div>
        </div>
      </header>

      {/* Orders */}
      <main className="container mx-auto px-4 py-6">
        {error && (
          <div className="mb-4 p-4 bg-red-900/50 border border-red-500 rounded-lg text-red-200">
            {error}
          </div>
        )}

        {orders.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400 mb-6">注文履歴がありません</p>
            <Link
              href="/menu"
              className="bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 px-6 rounded-lg transition"
            >
              メニューを見る
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div key={order.id} className="bg-gray-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="text-sm text-gray-400">
                      {new Date(order.created_at).toLocaleString('ja-JP')}
                    </span>
                    <p className="text-sm text-gray-500">#{order.id}</p>
                  </div>
                  <span
                    className={`${STATUS_COLORS[order.status]} text-white text-sm px-3 py-1 rounded-full`}
                  >
                    {STATUS_LABELS[order.status]}
                  </span>
                </div>
                <div className="border-t border-gray-700 pt-3">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex justify-between py-1 text-sm">
                      <span>
                        {item.name} × {item.quantity}
                      </span>
                      <span className="text-gray-400">
                        ¥{item.subtotal.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-gray-700 pt-3 mt-3 flex justify-between">
                  <span className="font-semibold">合計</span>
                  <span className="font-bold text-primary-400">
                    ¥{order.total_amount.toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
