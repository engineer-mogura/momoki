'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Order } from '@/types';
import { useAuth } from '@/hooks/useAuth';

type BillItem = {
  menu_item_id: number;
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
};

type Bill = {
  visit_id: number;
  business_session_id: number | null;
  created_at: string;
  last_ordered_at: string;
  is_paid: boolean;
  checked_in_at: string | null;
  checked_out_at: string | null;
  total_amount: number;
  items: BillItem[];
  orders: Order[];
};

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
  const [bill, setBill] = useState<Bill | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    setError(null);
    setIsLoading(true);
    try {
      const response = await api.get<{ bill: Bill | null }>('/api/orders');
      setBill(response.bill);
    } catch (err) {
      setError(err instanceof Error ? err.message : '注文履歴の取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!isAuthLoading) {
      fetchOrders();
    }
  }, [fetchOrders, isAuthLoading]);

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
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="bg-white sticky top-0 z-10 shadow-sm border-b border-slate-200">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-slate-500 hover:text-slate-900 transition">
              ← ホームへ戻る
            </Link>
            <h1 className="text-xl font-bold">注文状況</h1>
            <button
              onClick={fetchOrders}
              disabled={isLoading}
              className="inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-50 transition w-20"
            >
              {isLoading ? '読込中' : '再読み込み'}
            </button>
          </div>
        </div>
      </header>

      {/* Order */}
      <main className="container mx-auto px-4 py-6">
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {!bill ? (
          <div className="text-center py-12">
            <p className="text-slate-500 mb-2">現在の注文はありません</p>
            <p className="text-sm text-slate-400 mb-6">営業中に注文すると、ここに表示されます</p>
            <Link
              href="/menu"
              className="bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 px-6 rounded-lg transition"
            >
              メニューを見る
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Bill summary */}
            <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-200">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-slate-500">
                    {bill.checked_in_at ? `入店 ${new Date(bill.checked_in_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}` : '入店時刻'}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    最終注文 {new Date(bill.last_ordered_at).toLocaleString('ja-JP')}
                  </p>
                </div>
                {bill.is_paid && (
                  <span className="text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-700">
                    会計済
                  </span>
                )}
              </div>

              <div className="border-t border-slate-200 pt-3 mt-3">
                {bill.items.map((item) => (
                  <div key={item.menu_item_id} className="flex justify-between py-1 text-sm">
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
                  ¥{bill.total_amount.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Per-order status list */}
            <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-200">
              <h2 className="text-sm font-semibold text-slate-800 mb-3">追加注文ごとの状況</h2>
              <div className="space-y-3">
                {bill.orders.map((o, idx) => (
                  <div key={o.id} className="border border-slate-200 rounded-lg p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm text-slate-700">
                          追加注文 {idx + 1}
                        </p>
                        <p className="text-xs text-slate-400">
                          {new Date(o.created_at).toLocaleString('ja-JP')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">
                          ¥{o.total_amount.toLocaleString()}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded ${STATUS_STYLE[o.status] || 'bg-slate-100 text-slate-600'}`}>
                          {STATUS_LABEL[o.status] || o.status}
                        </span>
                      </div>
                    </div>

                    <div className="mt-2 border-t border-slate-200 pt-2">
                      {o.items.map((it) => (
                        <div key={it.id} className="flex justify-between py-0.5 text-sm">
                          <span className="text-slate-700">
                            {it.name} × {it.quantity}
                          </span>
                          <span className="text-slate-500">
                            ¥{it.subtotal.toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
