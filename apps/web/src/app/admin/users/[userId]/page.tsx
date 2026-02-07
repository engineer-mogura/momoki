'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

interface HistoryOrderItem {
  id: number;
  name: string;
  quantity: number;
  unit_price: number;
}

interface HistoryOrder {
  id: number;
  status: string;
  total_amount: number;
  created_at: string;
  items: HistoryOrderItem[];
}

interface HistoryVisit {
  id: number;
  table_number: string | null;
  status: string;
  checked_in_at: string | null;
  summary: {
    order_count: number;
    total_amount: number;
    last_order_at: string | null;
  };
  orders: HistoryOrder[];
}

interface UserHistory {
  user: {
    id: number;
    display_name: string | null;
    picture_url: string | null;
  };
  visits: HistoryVisit[];
}

const VISIT_STATUS_LABELS: Record<string, string> = {
  seated: '着席',
  serving: '提供中',
  checkout: '会計',
  done: '完了',
};

export default function UserHistoryPage() {
  const params = useParams();
  const router = useRouter();
  const { user: authUser, isLoading: isAuthLoading } = useAuth();
  const [data, setData] = useState<UserHistory | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isAuthLoading) return;
    if (!authUser) {
      router.replace('/');
      return;
    }
    if (!authUser.is_admin) {
      router.replace('/admin/setup');
      return;
    }

    const fetchHistory = async () => {
      try {
        const res = await api.get<UserHistory>(`/api/admin/users/${params.userId}/history`);
        setData(res);
      } catch (err) {
        console.error('Failed to fetch user history:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, [isAuthLoading, authUser, params.userId, router]);

  if (isAuthLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <p className="text-gray-400">データが見つかりません</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="bg-gray-800 sticky top-0 z-10 shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-gray-400 hover:text-white transition">
              &larr; ボードへ戻る
            </Link>
            <h1 className="text-lg font-bold">
              {data.user.display_name || '不明'} の履歴
            </h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-4">
        {data.visits.length === 0 ? (
          <p className="text-gray-400 text-center py-12">来店履歴がありません</p>
        ) : (
          data.visits.map((visit) => (
            <div key={visit.id} className="bg-gray-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded">
                    {visit.table_number || '未設定'}
                  </span>
                  <span className="text-gray-400 text-xs">
                    {VISIT_STATUS_LABELS[visit.status] || visit.status}
                  </span>
                </div>
                <span className="text-xs text-gray-500">
                  {visit.checked_in_at
                    ? new Date(visit.checked_in_at).toLocaleString('ja-JP')
                    : ''}
                </span>
              </div>

              <div className="flex items-center justify-between text-sm mb-3">
                <span className="text-gray-400">
                  {visit.summary.order_count}件の注文
                </span>
                <span className="font-bold">
                  &yen;{visit.summary.total_amount.toLocaleString()}
                </span>
              </div>

              {visit.orders.length > 0 && (
                <div className="border-t border-gray-700 pt-3 space-y-2">
                  {visit.orders.map((order) => (
                    <div key={order.id} className="bg-gray-900/50 rounded p-2">
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>#{order.id}</span>
                        <span>
                          {new Date(order.created_at).toLocaleTimeString('ja-JP', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      {order.items.map((item) => (
                        <div key={item.id} className="flex justify-between text-xs">
                          <span className="text-gray-300">
                            {item.name} x{item.quantity}
                          </span>
                          <span className="text-gray-400">
                            &yen;{(item.unit_price * item.quantity).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </main>
    </div>
  );
}
