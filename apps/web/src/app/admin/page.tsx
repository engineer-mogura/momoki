'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

// --- Types ---

type VisitStatus = 'seated' | 'serving' | 'checkout' | 'done';

interface OrderItem {
  id: number;
  name: string;
  quantity: number;
  unit_price: number;
}

interface VisitOrder {
  id: number;
  status: string;
  total_amount: number;
  created_at: string;
  items: OrderItem[];
}

interface AdminVisit {
  id: number;
  table_number: string | null;
  checked_in_at: string | null;
  status: VisitStatus;
  user: {
    id: number;
    display_name: string | null;
    picture_url: string | null;
  };
  orders: VisitOrder[];
  summary: {
    order_count: number;
    total_amount: number;
    last_order_at: string | null;
    new_count: number;
    has_new: boolean;
  };
}

interface BusinessSession {
  id: number;
  business_date: string;
  started_at: string;
  ended_at: string | null;
}

interface VisitsResponse {
  visits: AdminVisit[];
  session: BusinessSession | null;
  date?: string;
}

interface CurrentSessionResponse {
  session: BusinessSession | null;
}

// --- Constants ---

const COLUMNS: { key: VisitStatus; label: string; color: string }[] = [
  { key: 'seated', label: '着席', color: 'border-blue-500' },
  { key: 'serving', label: '提供中', color: 'border-yellow-500' },
  { key: 'checkout', label: '会計', color: 'border-green-500' },
  { key: 'done', label: '会計済み', color: 'border-gray-400' },
];

const NEXT_STATUS: Partial<Record<VisitStatus, VisitStatus>> = {
  seated: 'serving',
  serving: 'checkout',
  checkout: 'done',
};

const PREV_STATUS: Partial<Record<VisitStatus, VisitStatus>> = {
  serving: 'seated',
  checkout: 'serving',
  done: 'checkout',
};

const NEXT_LABEL: Partial<Record<VisitStatus, string>> = {
  seated: '提供中へ',
  serving: '会計へ',
  checkout: '完了',
};

const PREV_LABEL: Partial<Record<VisitStatus, string>> = {
  serving: '着席に戻す',
  checkout: '提供中に戻す',
  done: '会計を取り消す',
};

// --- Helpers ---

function elapsedMinutes(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '1分未満';
  if (mins < 60) return `${mins}分`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}時間${mins % 60}分`;
}

function todayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatSessionStartedAt(startedAt: string): string {
  return new Date(startedAt).toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// --- Component ---

export default function AdminPage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [visits, setVisits] = useState<AdminVisit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [date, setDate] = useState(todayString());
  const [session, setSession] = useState<BusinessSession | null>(null);
  const [sessionAction, setSessionAction] = useState<'start' | 'end' | null>(null);
  const [isSessionUpdating, setIsSessionUpdating] = useState(false);
  const [activeColumn, setActiveColumn] = useState<VisitStatus>('seated');

  const intervalRef = useRef<number | null>(null);
  const inFlightRef = useRef(false);
  const dateRef = useRef(date);
  dateRef.current = date;

  // Column refs for scroll
  const boardContainerRef = useRef<HTMLDivElement>(null);
  const seatedRef = useRef<HTMLDivElement>(null);
  const servingRef = useRef<HTMLDivElement>(null);
  const checkoutRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef<HTMLDivElement>(null);

  const columnRefs: Record<VisitStatus, React.RefObject<HTMLDivElement>> = {
    seated: seatedRef,
    serving: servingRef,
    checkout: checkoutRef,
    done: doneRef,
  };

  // Auth guard
  useEffect(() => {
    if (isAuthLoading) return;
    if (!user) {
      router.replace('/');
    } else if (!user.is_admin) {
      router.replace('/admin/setup');
    }
  }, [isAuthLoading, user, router]);

  const fetchCurrentSession = useCallback(async () => {
    try {
      const response = await api.get<CurrentSessionResponse>('/api/admin/business-sessions/current');
      setSession(response.session);
    } catch (err) {
      console.error('Failed to fetch business session:', err);
    }
  }, []);

  const fetchVisits = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const response = await api.get<VisitsResponse>('/api/admin/visits', {
        params: { date: dateRef.current },
      });
      setVisits(response.visits);
      setSession(response.session ?? null);
    } catch (err) {
      console.error('Failed to fetch visits:', err);
    } finally {
      inFlightRef.current = false;
      setIsLoading(false);
    }
  }, []);

  // Polling: 2-second interval with visibility & inFlight guards
  useEffect(() => {
    if (isAuthLoading || !user?.is_admin) return;

    let cancelled = false;

    const start = async () => {
      if (cancelled) return;
      await Promise.all([fetchCurrentSession(), fetchVisits()]);

      if (cancelled || intervalRef.current) return;
      intervalRef.current = window.setInterval(() => {
        if (document.visibilityState !== 'visible') return;
        fetchVisits();
      }, 2000);
    };

    start();

    const onVisibility = () => {
      if (document.visibilityState === 'visible') fetchVisits();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isAuthLoading, user?.is_admin, fetchCurrentSession, fetchVisits]);

  // Re-fetch when date changes + reset scroll
  useEffect(() => {
    setIsLoading(true);
    fetchVisits();
    // Reset scroll to first column
    if (boardContainerRef.current) {
      boardContainerRef.current.scrollTo({ left: 0 });
    }
    setActiveColumn('seated');
  }, [date, fetchVisits]);

  // IntersectionObserver to track active column
  useEffect(() => {
    if (!boardContainerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        let maxRatio = 0;
        let mostVisible: VisitStatus | null = null;

        entries.forEach((entry) => {
          if (entry.intersectionRatio > maxRatio) {
            maxRatio = entry.intersectionRatio;
            const key = entry.target.getAttribute('data-column') as VisitStatus;
            if (key) mostVisible = key;
          }
        });

        if (mostVisible && maxRatio > 0.3) {
          setActiveColumn(mostVisible);
        }
      },
      {
        root: boardContainerRef.current,
        threshold: [0, 0.3, 0.5, 0.7, 1],
      }
    );

    Object.values(columnRefs).forEach((ref) => {
      if (ref.current) observer.observe(ref.current);
    });

    return () => observer.disconnect();
  }, []);

  const handleUpdateStatus = async (visitId: number, newStatus: VisitStatus) => {
    try {
      await api.patch(`/api/admin/visits/${visitId}/status`, { status: newStatus });
      // Optimistic update
      setVisits((prev: AdminVisit[]) =>
        prev.map((v: AdminVisit) => (v.id === visitId ? { ...v, status: newStatus } : v))
      );
      fetchVisits();
    } catch (err) {
      console.error('Failed to update visit status:', err);
    }
  };

  const recalcSummary = (orders: VisitOrder[]) => {
    const active = orders.filter((o: VisitOrder) => o.status !== 'cancelled');
    const newOrders = orders.filter((o: VisitOrder) => o.status === 'new');
    return {
      order_count: active.length,
      total_amount: active.reduce((sum: number, o: VisitOrder) => sum + o.total_amount, 0),
      new_count: newOrders.length,
      has_new: newOrders.length > 0,
    };
  };

  const handleServeOrder = async (orderId: number) => {
    try {
      await api.patch(`/api/admin/orders/${orderId}/serve`);
      setVisits((prev: AdminVisit[]) =>
        prev.map((v: AdminVisit) => {
          const updatedOrders: VisitOrder[] = v.orders.map((o: VisitOrder) =>
            o.id === orderId ? { ...o, status: 'served' } : o
          );
          return { ...v, orders: updatedOrders, summary: { ...v.summary, ...recalcSummary(updatedOrders) } };
        })
      );
    } catch (err) {
      console.error('Failed to serve order:', err);
    }
  };

  const handleCancelOrder = async (orderId: number) => {
    try {
      await api.patch(`/api/admin/orders/${orderId}/cancel`);
      setVisits((prev: AdminVisit[]) =>
        prev.map((v: AdminVisit) => {
          const updatedOrders: VisitOrder[] = v.orders.map((o: VisitOrder) =>
            o.id === orderId ? { ...o, status: 'cancelled' } : o
          );
          return { ...v, orders: updatedOrders, summary: { ...v.summary, ...recalcSummary(updatedOrders) } };
        })
      );
    } catch (err) {
      console.error('Failed to cancel order:', err);
    }
  };

  const handleSessionAction = async (action: 'start' | 'end') => {
    setIsSessionUpdating(true);
    try {
      await api.post(`/api/admin/business-sessions/${action}`);
      await Promise.all([fetchCurrentSession(), fetchVisits()]);
    } catch (err) {
      console.error(`Failed to ${action} business session:`, err);
    } finally {
      setIsSessionUpdating(false);
      setSessionAction(null);
    }
  };

  const scrollToColumn = (status: VisitStatus) => {
    const targetRef = columnRefs[status];
    if (targetRef.current) {
      targetRef.current.scrollIntoView({
        behavior: 'smooth',
        inline: 'start',
        block: 'nearest',
      });
      setActiveColumn(status);
    }
  };

  if (isAuthLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!user?.is_admin) return null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Header - simplified */}
      <header className="bg-white sticky top-0 z-20 shadow-sm border-b border-slate-200">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-xl font-bold text-slate-900">
              伝票ボード
            </Link>
            <div className="w-20"></div>
          </div>
        </div>
      </header>

      {/* Body - with date nav + column jump */}
      <main className="pb-4">
        <div className="bg-white border-b border-slate-200 px-4 py-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              {session ? (
                <>
                  <p className="text-sm font-semibold text-emerald-700">営業中</p>
                  <p className="text-xs text-slate-600">
                    営業日: {session.business_date} / 開始: {formatSessionStartedAt(session.started_at)}
                  </p>
                  <p className="text-xs text-slate-500">現在営業中の営業セッションを表示中</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-slate-700">営業未開始</p>
                  <p className="text-xs text-slate-500">営業開始後、注文は営業セッションに紐づきます。</p>
                </>
              )}
            </div>
            <button
              onClick={() => setSessionAction(session ? 'end' : 'start')}
              disabled={isSessionUpdating}
              className={`rounded-lg px-3 py-2 text-sm font-semibold text-white transition ${
                session
                  ? 'bg-red-600 hover:bg-red-700 disabled:opacity-50'
                  : 'bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50'
              }`}
            >
              {session ? '営業終了' : '営業開始'}
            </button>
          </div>
        </div>

        {/* Date Navigation */}
        <div className="bg-white border-b border-slate-200 px-4 py-3">
          <div className="flex items-center gap-1 justify-center">
            <button
              onClick={() => setDate(shiftDate(date, -1))}
              disabled={Boolean(session)}
              className="bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 text-xs px-2 py-1.5 rounded-l-lg transition"
            >
              前日
            </button>
            <button
              onClick={() => setDate(todayString())}
              disabled={Boolean(session) || date === todayString()}
              className="bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 text-xs px-2 py-1.5 transition"
            >
              本日
            </button>
            <button
              onClick={() => setDate(shiftDate(date, 1))}
              disabled={Boolean(session)}
              className="bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 text-xs px-2 py-1.5 rounded-r-lg transition"
            >
              翌日
            </button>
            <input
              type="date"
              value={date}
              disabled={Boolean(session)}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDate(e.target.value)}
              className="bg-white text-slate-900 border border-slate-300 rounded-lg px-3 py-1.5 text-sm ml-2 focus:outline-none focus:ring-2 focus:ring-primary-600 disabled:opacity-40 disabled:cursor-not-allowed"
            />
          </div>
        </div>

        {/* Column Jump Buttons */}
        <div className="bg-white border-b border-slate-200 px-2 py-2 sticky top-[57px] z-10">
          <div className="flex gap-1 overflow-x-auto">
            {COLUMNS.map((col) => {
              const count = visits.filter((v: AdminVisit) => v.status === col.key).length;
              const isActive = activeColumn === col.key;
              return (
                <button
                  key={col.key}
                  onClick={() => scrollToColumn(col.key)}
                  className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-lg transition ${
                    isActive
                      ? 'bg-primary-600 text-white font-semibold'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {col.label}
                  <span className={`ml-1 ${isActive ? 'text-white' : 'text-slate-400'}`}>
                    ({count})
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Board - horizontal scroll */}
        <div ref={boardContainerRef} className="px-2 py-4 overflow-x-auto">
          <div className="flex gap-3 min-w-[900px]">
            {COLUMNS.map((col) => {
              const colVisits = visits.filter((v: AdminVisit) => v.status === col.key);
              return (
                <div
                  key={col.key}
                  ref={columnRefs[col.key]}
                  data-column={col.key}
                  className="flex-1 min-w-[220px]"
                >
                  {/* Column header */}
                  <div className={`border-t-4 ${col.color} bg-white rounded-t-lg px-3 py-2 mb-2 shadow-sm`}>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-slate-900">{col.label}</span>
                      <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full">
                        {colVisits.length}
                      </span>
                    </div>
                  </div>

                  {/* Cards */}
                  <div className="space-y-2">
                    {colVisits.map((visit: AdminVisit) => (
                      <VisitCard
                        key={visit.id}
                        visit={visit}
                        onStatusChange={handleUpdateStatus}
                        onServeOrder={handleServeOrder}
                        onCancelOrder={handleCancelOrder}
                      />
                    ))}
                    {colVisits.length === 0 && (
                      <div className="text-center py-8 text-slate-400 text-sm">
                        なし
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {sessionAction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-lg p-5 w-full max-w-sm mx-4 shadow-xl">
              {sessionAction === 'start' ? (
                <>
                  <h3 className="text-sm font-bold text-slate-900 mb-3">営業を開始しますか？</h3>
                  <p className="text-xs text-slate-500 mb-4">
                    この時刻から営業日が開始され、以降の注文は今回の営業日に紐づきます。
                  </p>
                  <button
                    onClick={() => handleSessionAction('start')}
                    disabled={isSessionUpdating}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold py-2 rounded transition mb-2 disabled:opacity-50"
                  >
                    営業を開始する
                  </button>
                </>
              ) : (
                <>
                  <h3 className="text-sm font-bold text-slate-900 mb-3">営業を終了しますか？</h3>
                  <p className="text-xs text-slate-500 mb-4">
                    営業を終了すると、以降の注文は次回営業日に紐づきます。よろしいですか？
                  </p>
                  <button
                    onClick={() => handleSessionAction('end')}
                    disabled={isSessionUpdating}
                    className="w-full bg-red-600 hover:bg-red-700 text-white text-xs font-semibold py-2 rounded transition mb-2 disabled:opacity-50"
                  >
                    営業を終了する
                  </button>
                </>
              )}
              <button
                onClick={() => setSessionAction(null)}
                disabled={isSessionUpdating}
                className="w-full text-slate-500 hover:text-slate-900 text-xs py-1.5 transition disabled:opacity-50"
              >
                キャンセル
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// --- Visit Card ---

function VisitCard({
  visit,
  onStatusChange,
  onServeOrder,
  onCancelOrder,
}: {
  visit: AdminVisit;
  onStatusChange: (visitId: number, status: VisitStatus) => void;
  onServeOrder: (orderId: number) => void;
  onCancelOrder: (orderId: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ type: 'serve' | 'cancel' | 'reopen'; orderId?: number } | null>(null);
  const next = NEXT_STATUS[visit.status];
  const prev = PREV_STATUS[visit.status];
  const isDone = visit.status === 'done';
  const isCheckout = visit.status === 'checkout';
  const canCancelOrders = !isDone && !isCheckout;

  return (
    <div className="bg-white rounded-lg p-3 text-sm shadow-sm border border-slate-200">
      {/* Header: table + user + NEW badge */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded">
            {visit.table_number || '未設定'}
          </span>
          <span className="text-slate-700 truncate max-w-[100px]">
            {visit.user.display_name || '不明'}
          </span>
          {visit.summary.has_new && (
            <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded animate-pulse">
              NEW {visit.summary.new_count}
            </span>
          )}
        </div>
        <Link
          href={`/admin/users/${visit.user.id}`}
          className="text-slate-400 hover:text-primary-600 text-xs underline"
        >
          履歴
        </Link>
      </div>

      {/* Time */}
      {visit.checked_in_at && (
        <p className="text-xs text-slate-400 mb-2">
          入店 {elapsedMinutes(visit.checked_in_at)}
        </p>
      )}

      {/* Summary */}
      <div className="flex items-center justify-between text-xs mb-2">
        <span className="text-slate-500">
          {visit.summary.order_count}件
        </span>
        <span className="font-bold text-slate-900">
          &yen;{visit.summary.total_amount.toLocaleString()}
        </span>
      </div>

      {/* Orders (collapsible) */}
      {visit.orders.length > 0 && (
        <div className="border-t border-slate-200 pt-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-slate-500 hover:text-slate-900 mb-1"
          >
            {expanded ? '注文を閉じる' : `注文を見る (${visit.orders.length}件)`}
          </button>
          {expanded && (
            <div className="space-y-2 mt-1">
              {visit.orders.map((order) => {
                const isNew = order.status === 'new';
                const isServed = order.status === 'served';
                const isCancelled = order.status === 'cancelled';
                return (
                  <div
                    key={order.id}
                    className={`bg-slate-50 rounded p-2 ${isCancelled ? 'opacity-40' : ''} ${isServed ? 'opacity-60' : ''}`}
                  >
                    <div className="flex justify-between items-center text-xs text-slate-500 mb-1">
                      <span className="flex items-center gap-1">
                        #{order.id}
                        {isNew && (
                          <span className="bg-red-500 text-white text-[10px] font-bold px-1 py-0.5 rounded">NEW</span>
                        )}
                        {isServed && (
                          <span className="text-green-600 text-[10px]">提供済</span>
                        )}
                        {isCancelled && (
                          <span className="text-red-500 text-[10px]">取消済</span>
                        )}
                      </span>
                      <div className="flex items-center gap-1">
                        <span>{new Date(order.created_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}</span>
                        {isNew && (
                          <button
                            onClick={() => setConfirmAction({ type: 'serve', orderId: order.id })}
                            className="text-green-600 hover:text-green-700 text-[10px] px-1 py-0.5 border border-green-300 rounded hover:border-green-400 transition"
                          >
                            提供済
                          </button>
                        )}
                        {canCancelOrders && !isCancelled && (
                          <button
                            onClick={() => setConfirmAction({ type: 'cancel', orderId: order.id })}
                            className="text-red-500 hover:text-red-600 text-[10px] px-1 py-0.5 border border-red-300 rounded hover:border-red-400 transition"
                          >
                            削除
                          </button>
                        )}
                      </div>
                    </div>
                    {order.items.map((item) => (
                      <div key={item.id} className={`flex justify-between text-xs ${isCancelled ? 'line-through' : ''}`}>
                        <span className="text-slate-700">{item.name} x{item.quantity}</span>
                        <span className="text-slate-500">
                          &yen;{(item.unit_price * item.quantity).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })}
              {(isDone || isCheckout) && (
                <p className="text-[10px] text-slate-400 mt-1">
                  {isDone ? '会計済みのため取消不可（提供中に戻してください）' : '会計中のため取消不可'}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Status buttons */}
      <div className="flex gap-1 mt-2">
        {prev && (
          <button
            onClick={() => {
              if (isDone) {
                setConfirmAction({ type: 'reopen' });
              } else {
                onStatusChange(visit.id, prev);
              }
            }}
            className={`flex-none text-xs py-1.5 px-2 rounded transition ${
              isDone
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
            }`}
          >
            {PREV_LABEL[visit.status]}
          </button>
        )}
        {next && (
          <button
            onClick={() => onStatusChange(visit.id, next)}
            className="flex-1 bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold py-1.5 px-2 rounded transition"
          >
            {NEXT_LABEL[visit.status]}
          </button>
        )}
      </div>

      {/* Confirmation Modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg p-5 w-full max-w-xs mx-4 shadow-xl">
            {confirmAction.type === 'reopen' ? (
              <>
                <h3 className="text-sm font-bold text-slate-900 mb-3">会計を取り消しますか？</h3>
                <p className="text-xs text-slate-500 mb-4">
                  会計済み（完了）の伝票です。提供中に戻すと、会計前の状態に戻ります。よろしいですか？
                </p>
                <button
                  onClick={() => {
                    onStatusChange(visit.id, 'checkout');
                    setConfirmAction(null);
                  }}
                  className="w-full bg-red-600 hover:bg-red-700 text-white text-xs font-semibold py-2 rounded transition mb-2"
                >
                  会計を取り消す
                </button>
              </>
            ) : (
              <>
                <h3 className="text-sm font-bold text-slate-900 mb-3">
                  {confirmAction.type === 'serve' ? '提供済にする' : '注文の取り消し'}
                </h3>
                <p className="text-xs text-slate-500 mb-4">
                  {confirmAction.type === 'serve'
                    ? `注文 #${confirmAction.orderId} を提供済にしますか？`
                    : (<>注文 #{confirmAction.orderId} を取り消しますか？<br />取り消した注文は合計金額から除外されます。</>)
                  }
                </p>
                <button
                  onClick={() => {
                    if (confirmAction.type === 'serve') {
                      onServeOrder(confirmAction.orderId!);
                    } else {
                      onCancelOrder(confirmAction.orderId!);
                    }
                    setConfirmAction(null);
                  }}
                  className={`w-full text-white text-xs font-semibold py-2 rounded transition mb-2 ${
                    confirmAction.type === 'serve'
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {confirmAction.type === 'serve' ? '提供済にする' : '取り消す'}
                </button>
              </>
            )}
            <button
              onClick={() => setConfirmAction(null)}
              className="w-full text-slate-500 hover:text-slate-900 text-xs py-1.5 transition"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
