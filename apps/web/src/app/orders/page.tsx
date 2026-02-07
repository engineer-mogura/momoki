'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Order } from '@/types';
import { useAuth } from '@/hooks/useAuth';

const STATUS_LABEL: Record<string, string> = {
  new: '受付',
  served: '提供済',
  cancelled: '取消',
};

const STATUS_STYLE: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700',
  served: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-500',
};

export default function OrdersPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const grandTotal = useMemo(
    () => orders.filter((o) => o.status !== 'cancelled').reduce((sum, o) => sum + o.total_amount, 0),
    [orders]
  );

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
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <p className="text-slate-500 mb-6">注文履歴を見るにはログインが必要です</p>
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
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      {/* Header */}
      <header className="bg-white sticky top-0 z-10 shadow-sm border-b border-slate-200">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-slate-500 hover:text-slate-900 transition">
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
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {orders.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-500 mb-6">注文履歴がありません</p>
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
              <div key={order.id} className="bg-white rounded-lg p-4 shadow-sm border border-slate-200">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="text-sm text-slate-500">
                      {new Date(order.created_at).toLocaleString('ja-JP')}
                    </span>
                    <p className="text-sm text-slate-400">#{order.id}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded ${STATUS_STYLE[order.status] || 'bg-slate-100 text-slate-600'}`}>
                    {STATUS_LABEL[order.status] || order.status}
                  </span>
                </div>
                <div className="border-t border-slate-200 pt-3">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex justify-between py-1 text-sm">
                      <span className="text-slate-700">
                        {item.name} × {item.quantity}
                      </span>
                      <span className="text-slate-500">
                        ¥{item.subtotal.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-slate-200 pt-3 mt-3 flex justify-between">
                  <span className="font-semibold">合計</span>
                  <span className="font-bold text-primary-600">
                    ¥{order.total_amount.toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Total Footer */}
      {orders.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 z-10 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
          <div className="container mx-auto flex items-center justify-between">
            <span className="text-slate-500">合計（取消除く）</span>
            <span className="text-2xl font-bold">&yen;{grandTotal.toLocaleString()}</span>
          </div>
        </div>
      )}
    </div>
  );
}
