'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

type OrderStatus = 'preparing' | 'served' | 'paid' | 'cancelled';

interface AdminOrder {
  id: number;
  status: OrderStatus;
  total_amount: number;
  created_at: string;
  user: {
    id: number;
    display_name: string | null;
  };
  items: {
    id: number;
    menu_item_id: number;
    name: string;
    quantity: number;
    unit_price: number;
  }[];
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  preparing: '準備中',
  served: '提供済み',
  paid: '会計済み',
  cancelled: 'キャンセル',
};

const STATUS_COLORS: Record<OrderStatus, string> = {
  preparing: 'bg-yellow-500',
  served: 'bg-green-500',
  paid: 'bg-gray-500',
  cancelled: 'bg-red-500',
};

export default function AdminPage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');

  useEffect(() => {
    if (isAuthLoading) return;

    if (!user) {
      router.replace('/');
      return;
    }

    if (!user.is_admin) {
      router.replace('/admin/setup');
      return;
    }

    const fetchOrders = async () => {
      try {
        const params: Record<string, string> = {};
        if (statusFilter) {
          params.status = statusFilter;
        }
        const response = await api.get<{ orders: AdminOrder[] }>('/api/admin/orders', { params });
        setOrders(response.orders);
      } catch (err) {
        console.error('Failed to fetch orders:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrders();
    const interval = setInterval(fetchOrders, 10000);
    return () => clearInterval(interval);
  }, [user, isAuthLoading, router, statusFilter]);

  const handleUpdateStatus = async (orderId: number, newStatus: OrderStatus) => {
    try {
      await api.patch(`/api/admin/orders/${orderId}/status`, { status: newStatus });
      setOrders((prev) =>
        prev.map((order) =>
          order.id === orderId ? { ...order, status: newStatus } : order
        )
      );
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  if (isAuthLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!user?.is_admin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="bg-gray-800 sticky top-0 z-10 shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-xl font-bold">
              管理画面
            </Link>
          </div>
        </div>
      </header>

      {/* Filters */}
      <div className="container mx-auto px-4 py-4">
        <div className="flex gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => setStatusFilter('')}
            className={`px-4 py-2 rounded-lg whitespace-nowrap transition ${
              statusFilter === '' ? 'bg-primary-600' : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            すべて
          </button>
          {(['preparing', 'served', 'paid', 'cancelled'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-lg whitespace-nowrap transition ${
                statusFilter === status ? 'bg-primary-600' : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              {STATUS_LABELS[status]}
            </button>
          ))}
        </div>
      </div>

      {/* Orders */}
      <main className="container mx-auto px-4 py-2">
        {orders.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400">注文がありません</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {orders.map((order) => (
              <div key={order.id} className="bg-gray-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-lg font-bold">#{order.id}</span>
                  <span
                    className={`${STATUS_COLORS[order.status]} text-white text-sm px-3 py-1 rounded-full`}
                  >
                    {STATUS_LABELS[order.status]}
                  </span>
                </div>

                <p className="text-sm text-gray-400 mb-2">
                  {order.user.display_name || '不明'}
                </p>
                <p className="text-xs text-gray-500 mb-3">
                  {new Date(order.created_at).toLocaleString('ja-JP')}
                </p>

                <div className="border-t border-gray-700 pt-3">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex justify-between py-1 text-sm">
                      <span>{item.name} x {item.quantity}</span>
                      <span className="text-gray-400">
                        ¥{(item.unit_price * item.quantity).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-gray-700 pt-3 mt-3">
                  <div className="flex justify-between mb-3">
                    <span>合計</span>
                    <span className="font-bold">
                      ¥{order.total_amount.toLocaleString()}
                    </span>
                  </div>

                  {order.status === 'preparing' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleUpdateStatus(order.id, 'served')}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded-lg transition"
                      >
                        提供済みにする
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(order.id, 'cancelled')}
                        className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-3 rounded-lg transition"
                      >
                        取消
                      </button>
                    </div>
                  )}
                  {order.status === 'served' && (
                    <button
                      onClick={() => handleUpdateStatus(order.id, 'paid')}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg transition"
                    >
                      会計済みにする
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
