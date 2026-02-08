'use client';

import { useEffect, useState, useRef, useCallback, type RefObject } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { ModalPortal } from '@/components/ModalPortal';

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
  is_open?: boolean;
}

interface VisitsResponse {
  visits: AdminVisit[];
  session: BusinessSession | null;
  date?: string;
}

// --- Constants ---

const AUTO_REFRESH_STORAGE_KEY = 'momoki_admin_auto_refresh';
const SELECTED_DATE_STORAGE_KEY = 'admin_selected_business_date';
const BUSINESS_DAY_START_HOUR = 21;

const COLUMNS: { key: VisitStatus; label: string; color: string }[] = [
  { key: 'seated', label: '着席', color: 'border-blue-500' },
  { key: 'serving', label: '提供中', color: 'border-yellow-500' },
  { key: 'checkout', label: '会計', color: 'border-green-500' },
  { key: 'done', label: '会計済み', color: 'border-gray-400' },
];

// 「着席」はステータスとしては残しつつ、ボード列としては非表示（提供中へ統合）
const BOARD_COLUMNS = COLUMNS.filter((c) => c.key !== 'seated');

const NEXT_STATUS: Partial<Record<VisitStatus, VisitStatus>> = {
  seated: 'serving',
  serving: 'checkout',
  checkout: 'done',
};

const PREV_STATUS: Partial<Record<VisitStatus, VisitStatus>> = {
  checkout: 'serving',
  done: 'checkout',
};

const NEXT_LABEL: Partial<Record<VisitStatus, string>> = {
  seated: '提供中へ',
  serving: '会計へ',
  checkout: '完了',
};

const PREV_LABEL: Partial<Record<VisitStatus, string>> = {
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

function isValidDateString(v: string | null): v is string {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function businessDateFromNowLocal(startHour: number): string {
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (now.getHours() < startHour) {
    base.setDate(base.getDate() - 1);
  }
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`;
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
  const { user, isLoading: isAuthLoading, logout } = useAuth();
  const searchParams = useSearchParams();
  const [visits, setVisits] = useState<AdminVisit[]>([]);
  const [date, setDate] = useState('');
  const [isDateReady, setIsDateReady] = useState(false);
  const [todayBusinessDate, setTodayBusinessDate] = useState<string | null>(null);
  const [session, setSession] = useState<BusinessSession | null>(null);
  // 営業中 = ended_at が null のセッションが存在する場合のみ
  const isSessionActive = session !== null && session.ended_at === null;
  const [sessionAction, setSessionAction] = useState<'start' | 'end' | null>(null);
  const [isSessionUpdating, setIsSessionUpdating] = useState(false);
  const [activeColumn, setActiveColumn] = useState<VisitStatus>('serving');
  const activeColumnRef = useRef<VisitStatus>('serving');
  activeColumnRef.current = activeColumn;
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'live' | 'history'>('live');
  const isHistoryMode = viewMode === 'history';

  const intervalRef = useRef<number | null>(null);
  const inFlightRef = useRef(false);
  const dateRef = useRef(date);
  dateRef.current = date;
  const initialFetchDoneRef = useRef(false);
  const scrollRafRef = useRef<number | null>(null);

  const isUnauthenticatedError = useCallback((err: unknown): boolean => {
    const anyErr = err as any;
    if (anyErr?.status === 401) return true;
    if (anyErr?.response?.status === 401) return true;
    const msg = anyErr?.message;
    if (typeof msg === 'string' && (msg.includes('Unauthenticated') || msg.includes('401'))) return true;
    return false;
  }, []);

  const handleUnauthenticated = useCallback(() => {
    setSessionExpired(true);
    setAutoRefreshEnabled(false);
    try {
      localStorage.setItem(AUTO_REFRESH_STORAGE_KEY, '0');
    } catch {
      // ignore
    }
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Load persisted auto-refresh setting (default OFF)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(AUTO_REFRESH_STORAGE_KEY);
      if (raw === '1' || raw === 'true') setAutoRefreshEnabled(true);
    } catch {
      // ignore
    }
  }, []);

  // Persist auto-refresh setting
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(AUTO_REFRESH_STORAGE_KEY, autoRefreshEnabled ? '1' : '0');
    } catch {
      // ignore
    }
  }, [autoRefreshEnabled]);

  // Decide initial selected business date (avoid flicker)
  useEffect(() => {
    if (isAuthLoading || !user?.is_admin) return;
    if (isDateReady) return;

    let cancelled = false;

    const decide = async () => {
      // (3) open session override (most priority)
      try {
        const cur = await api.get<{ session: BusinessSession | null }>('/api/admin/business-sessions/current');
        if (cancelled) return;
        if (cur.session?.business_date) {
          setSession(cur.session);
          setDate(cur.session.business_date);
          setTodayBusinessDate(cur.session.business_date);
          setIsDateReady(true);
          return;
        }
      } catch (err) {
        if (isUnauthenticatedError(err)) {
          handleUnauthenticated();
          return;
        }
        // ignore and fallback
      }

      // (1) A: URL query ?date=YYYY-MM-DD
      const queryDateRaw = searchParams.get('date');
      const urlDate = isValidDateString(queryDateRaw) ? queryDateRaw : null;

      // (1) B: localStorage last selected
      let storedDate: string | null = null;
      try {
        const raw = localStorage.getItem(SELECTED_DATE_STORAGE_KEY);
        storedDate = isValidDateString(raw) ? raw : null;
      } catch {
        // ignore
      }

      // (2) C: server business day (preferred) -> fallback to local calc
      let businessDay: string | null = null;
      try {
        const res = await api.get<{ business_date: string }>('/api/admin/business-day');
        if (cancelled) return;
        businessDay = isValidDateString(res.business_date) ? res.business_date : null;
      } catch {
        // ignore
      }
      const fallbackBusinessDay = businessDay ?? businessDateFromNowLocal(BUSINESS_DAY_START_HOUR);

      if (cancelled) return;
      setTodayBusinessDate(fallbackBusinessDay);
      setDate(urlDate ?? storedDate ?? fallbackBusinessDay);
      setIsDateReady(true);
    };

    decide();
    return () => {
      cancelled = true;
    };
  }, [
    isAuthLoading,
    user?.is_admin,
    isDateReady,
    searchParams,
    isUnauthenticatedError,
    handleUnauthenticated,
  ]);

  // Persist selected date
  useEffect(() => {
    if (!isDateReady) return;
    if (!isValidDateString(date)) return;
    try {
      localStorage.setItem(SELECTED_DATE_STORAGE_KEY, date);
    } catch {
      // ignore
    }
  }, [date, isDateReady]);

  // Logout confirm: ESC to close
  useEffect(() => {
    if (!logoutConfirmOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLogoutConfirmOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [logoutConfirmOpen]);

  // Entering history mode forces auto-refresh off (cost safe)
  useEffect(() => {
    if (!isHistoryMode) return;
    if (autoRefreshEnabled) setAutoRefreshEnabled(false);
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [isHistoryMode, autoRefreshEnabled]);

  // Column refs for scroll
  const boardContainerRef = useRef<HTMLDivElement>(null);
  const seatedRef = useRef<HTMLDivElement>(null);
  const servingRef = useRef<HTMLDivElement>(null);
  const checkoutRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef<HTMLDivElement>(null);

  const columnRefs: Record<VisitStatus, RefObject<HTMLDivElement>> = {
    seated: seatedRef,
    serving: servingRef,
    checkout: checkoutRef,
    done: doneRef,
  };

  const refreshVisits = useCallback(
    async (opts?: { showSpinner?: boolean }) => {
      if (!user?.is_admin) return;
      if (!isDateReady) return;
      if (sessionExpired) return;
      if (inFlightRef.current) return;
      if (document.visibilityState !== 'visible' && !opts?.showSpinner) return;

      inFlightRef.current = true;
      if (opts?.showSpinner) setIsRefreshing(true);

      try {
        const response = await api.get<VisitsResponse>('/api/admin/visits', {
          params: { date: dateRef.current },
        });
        setVisits(response.visits);
        setSession(response.session ?? null);
        setLastUpdatedAt(new Date());
      } catch (err) {
        if (isUnauthenticatedError(err)) {
          handleUnauthenticated();
          return;
        }
        console.error('Failed to fetch visits:', err);
      } finally {
        inFlightRef.current = false;
        if (opts?.showSpinner) setIsRefreshing(false);
      }
    },
    [user?.is_admin, sessionExpired, handleUnauthenticated, isDateReady, isUnauthenticatedError]
  );

  // Initial fetch once (auto-refresh OFF is kept)
  useEffect(() => {
    if (isAuthLoading || !user?.is_admin) return;
    if (!isDateReady) return;
    if (sessionExpired) return;
    if (initialFetchDoneRef.current) return;
    initialFetchDoneRef.current = true;
    refreshVisits({ showSpinner: true });
  }, [isAuthLoading, user?.is_admin, isDateReady, sessionExpired, refreshVisits]);

  // Swipe-follow: update activeColumn based on scroll position (most reliable)
  const handleBoardScroll = useCallback(() => {
    const container = boardContainerRef.current;
    if (!container) return;

    if (scrollRafRef.current) {
      window.cancelAnimationFrame(scrollRafRef.current);
    }

    scrollRafRef.current = window.requestAnimationFrame(() => {
      scrollRafRef.current = null;

      // Only meaningful when horizontally scrollable (mobile)
      if (container.scrollWidth <= container.clientWidth + 1) return;

      const center = container.scrollLeft + container.clientWidth / 2;
      const keys: VisitStatus[] = ['serving', 'checkout', 'done'];
      let best: VisitStatus | null = null;
      let bestDist = Number.POSITIVE_INFINITY;

      keys.forEach((k) => {
        const el = columnRefs[k]?.current;
        if (!el) return;
        const laneCenter = el.offsetLeft + el.clientWidth / 2;
        const dist = Math.abs(laneCenter - center);
        if (dist < bestDist) {
          bestDist = dist;
          best = k;
        }
      });

      if (best && best !== activeColumnRef.current) {
        setActiveColumn(best);
      }
    });
  }, []);

  useEffect(() => {
    return () => {
      if (scrollRafRef.current) {
        window.cancelAnimationFrame(scrollRafRef.current);
        scrollRafRef.current = null;
      }
    };
  }, []);

  // Auto refresh (optional): 15s interval, only when visible
  useEffect(() => {
    if (isAuthLoading || !user?.is_admin) return;
    if (sessionExpired) return;
    if (isHistoryMode) return;
    if (!isDateReady) return;

    if (!autoRefreshEnabled) {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    if (!intervalRef.current) {
      intervalRef.current = window.setInterval(() => {
        if (document.visibilityState !== 'visible') return;
        refreshVisits();
      }, 15000);
    }

    const onVisibility = () => {
      if (!autoRefreshEnabled) return;
      if (document.visibilityState === 'visible') refreshVisits();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [autoRefreshEnabled, isAuthLoading, refreshVisits, sessionExpired, user?.is_admin, isHistoryMode, isDateReady]);

  // Date changes: reset scroll only (no automatic fetch by default)
  useEffect(() => {
    if (!user?.is_admin) return;
    if (!isDateReady) return;
    if (boardContainerRef.current) {
      boardContainerRef.current.scrollTo({ left: 0 });
    }
    setActiveColumn('serving');
    if (isHistoryMode) {
      refreshVisits({ showSpinner: true });
      return;
    }
    if (autoRefreshEnabled && document.visibilityState === 'visible') refreshVisits();
  }, [date, user?.is_admin, autoRefreshEnabled, refreshVisits, isHistoryMode, isDateReady]);

  const handleUpdateStatus = async (visitId: number, newStatus: VisitStatus) => {
    try {
      await api.patch(`/api/admin/visits/${visitId}/status`, { status: newStatus });
      // Optimistic update
      setVisits((prev: AdminVisit[]) =>
        prev.map((v: AdminVisit) => (v.id === visitId ? { ...v, status: newStatus } : v))
      );
      refreshVisits();
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
      await refreshVisits({ showSpinner: false });
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

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // --- Unauthenticated ---
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-900 px-4">
        <div className="bg-white w-full max-w-md rounded-xl border border-slate-200 shadow-sm p-6 text-center">
          <h1 className="text-lg font-bold mb-2">管理画面</h1>
          <p className="text-sm text-slate-600 mb-6">
            管理画面を利用するには、LINEでログインしてください。
          </p>
          <Link
            href="/admin/auth/line/start"
            className="inline-flex items-center justify-center w-full bg-[#00B900] hover:bg-[#00a000] text-white font-semibold py-3 px-4 rounded-lg transition"
          >
            LINEでログイン
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center w-full mt-3 text-sm text-slate-500 hover:text-slate-900 transition"
          >
            トップへ戻る
          </Link>
        </div>
      </div>
    );
  }

  // --- Authenticated but not admin ---
  if (!user.is_admin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-900 px-4">
        <div className="bg-white w-full max-w-md rounded-xl border border-slate-200 shadow-sm p-6 text-center">
          <h1 className="text-lg font-bold mb-2">管理画面</h1>
          <p className="text-sm text-slate-600 mb-6">
            管理画面の利用には管理者権限が必要です。招待コードを入力してください。
          </p>
          <Link
            href="/admin/setup"
            className="inline-flex items-center justify-center w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 px-4 rounded-lg transition"
          >
            管理者セットアップへ
          </Link>
          <button
            onClick={() => setLogoutConfirmOpen(true)}
            className="w-full mt-3 text-sm text-slate-500 hover:text-slate-900 transition"
          >
            ログアウト
          </button>
        </div>

        {logoutConfirmOpen && (
          <ModalPortal onOverlayClick={() => setLogoutConfirmOpen(false)}>
            <div className="bg-white rounded-lg p-5 w-full max-w-sm mx-4 shadow-xl">
              <h3 className="text-sm font-bold text-slate-900 mb-2">ログアウトしますか？</h3>
              <p className="text-xs text-slate-500 mb-4">再度ログインが必要になります。</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setLogoutConfirmOpen(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold py-2 rounded transition"
                >
                  キャンセル
                </button>
                <button
                  onClick={() => logout()}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold py-2 rounded transition"
                >
                  ログアウト
                </button>
              </div>
            </div>
          </ModalPortal>
        )}
      </div>
    );
  }

  // --- Date loading (business date resolve) ---
  if (!isDateReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-3"></div>
          <p className="text-sm text-slate-600">営業日を準備中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Header - simplified */}
      <header className="bg-white sticky top-0 z-20 shadow-sm border-b border-slate-200">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-xl font-bold text-slate-900">
              伝票ボード
            </Link>
            <button
              onClick={() => setLogoutConfirmOpen(true)}
              className="text-xs text-slate-500 hover:text-slate-900 transition"
            >
              ログアウト
            </button>
          </div>
        </div>
      </header>

      {logoutConfirmOpen && (
        <ModalPortal onOverlayClick={() => setLogoutConfirmOpen(false)}>
          <div className="bg-white rounded-lg p-5 w-full max-w-sm mx-4 shadow-xl">
            <h3 className="text-sm font-bold text-slate-900 mb-2">ログアウトしますか？</h3>
            <p className="text-xs text-slate-500 mb-4">再度ログインが必要になります。</p>
            <div className="flex gap-2">
              <button
                onClick={() => setLogoutConfirmOpen(false)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold py-2 rounded transition"
              >
                キャンセル
              </button>
              <button
                onClick={() => logout()}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold py-2 rounded transition"
              >
                ログアウト
              </button>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Body - with date nav + column jump */}
      <main className="pb-4">
        {sessionExpired && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-3">
            <div className="container mx-auto flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-amber-900">セッション切れ</p>
                <p className="text-xs text-amber-800">
                  ログインが期限切れになりました。再ログイン後に更新できます。
                </p>
              </div>
              <Link
                href="/admin/auth/line/start"
                className="inline-flex items-center justify-center rounded-lg bg-[#00B900] hover:bg-[#00a000] text-white text-sm font-semibold px-4 py-2 transition"
              >
                再ログイン
              </Link>
            </div>
          </div>
        )}

        <div className="bg-white border-b border-slate-200 px-4 py-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              {isHistoryMode ? (
                <>
                  <p className="text-lg md:text-sm leading-relaxed md:leading-normal font-semibold text-slate-700">履歴表示</p>
                  <p className="text-base md:text-xs leading-relaxed md:leading-normal text-slate-600">
                    営業日: {date}
                    {session?.started_at ? ` / 開始: ${formatSessionStartedAt(session.started_at)}` : ''}
                  </p>
                  <p className="text-base md:text-xs leading-relaxed md:leading-normal text-slate-500">履歴閲覧中（操作はできません）</p>
                </>
              ) : isSessionActive ? (
                <>
                  <p className="text-lg md:text-sm leading-relaxed md:leading-normal font-semibold text-emerald-700">営業中</p>
                  <p className="text-base md:text-xs leading-relaxed md:leading-normal text-slate-600">
                    営業日: {session.business_date} / 開始: {formatSessionStartedAt(session.started_at)}
                  </p>
                  <p className="text-base md:text-xs leading-relaxed md:leading-normal text-slate-500">現在営業中の営業セッションを表示中</p>
                </>
              ) : (
                <>
                  <p className="text-lg md:text-sm leading-relaxed md:leading-normal font-semibold text-slate-700">営業未開始</p>
                  <p className="text-base md:text-xs leading-relaxed md:leading-normal text-slate-500">営業開始後、注文は営業セッションに紐づきます。</p>
                </>
              )}
            </div>
            <div className="flex items-center gap-2 justify-end">
              {isHistoryMode ? (
                <button
                  onClick={() => {
                    setViewMode('live');
                    setDate(todayBusinessDate ?? businessDateFromNowLocal(BUSINESS_DAY_START_HOUR));
                  }}
                  className="rounded-lg px-3 py-2 text-sm font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                >
                  本日に戻る
                </button>
              ) : (
                <button
                  onClick={() => {
                    setViewMode('history');
                    refreshVisits({ showSpinner: true });
                  }}
                  className="rounded-lg px-3 py-2 text-sm font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                >
                  履歴を見る
                </button>
              )}

              {!isHistoryMode && (
                <button
                  onClick={() => setSessionAction(isSessionActive ? 'end' : 'start')}
                  disabled={isSessionUpdating}
                  className={`rounded-lg px-3 py-2 text-sm font-semibold text-white transition ${
                    isSessionActive
                      ? 'bg-red-600 hover:bg-red-700 disabled:opacity-50'
                      : 'bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50'
                  }`}
                >
                  {isSessionActive ? '営業終了' : '営業開始'}
                </button>
              )}
            </div>
          </div>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => refreshVisits({ showSpinner: true })}
                disabled={isRefreshing || sessionExpired}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-semibold px-3 py-2 transition"
              >
                {isRefreshing ? (
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                ) : (
                  <span aria-hidden>⟳</span>
                )}
                {isHistoryMode ? '再取得' : '更新'}
              </button>

              <label className="inline-flex items-center gap-2 text-sm text-slate-700 select-none">
                <input
                  type="checkbox"
                  checked={autoRefreshEnabled && !isHistoryMode}
                  onChange={() => {
                    const next = !autoRefreshEnabled;
                    setAutoRefreshEnabled(next);
                    if (next) refreshVisits();
                  }}
                  disabled={sessionExpired || isHistoryMode}
                  className="h-4 w-4"
                />
                自動更新（15秒）
              </label>
            </div>

            <div className="text-xs text-slate-500">
              最終更新{' '}
              {lastUpdatedAt
                ? lastUpdatedAt.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
                : '—'}
            </div>
          </div>
        </div>

        {/* Date Navigation */}
        <div className="bg-white border-b border-slate-200 px-4 py-3">
          <div className="flex items-center gap-1 justify-center">
            <button
              onClick={() => setDate(shiftDate(date, -1))}
              disabled={isSessionActive && !isHistoryMode}
              className="bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 text-xs px-2 py-1.5 rounded-l-lg transition"
            >
              前日
            </button>
            <button
              onClick={() => setDate(todayBusinessDate ?? businessDateFromNowLocal(BUSINESS_DAY_START_HOUR))}
              disabled={
                (isSessionActive && !isHistoryMode) ||
                date === (todayBusinessDate ?? businessDateFromNowLocal(BUSINESS_DAY_START_HOUR))
              }
              className="bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 text-xs px-2 py-1.5 transition"
            >
              本日
            </button>
            <button
              onClick={() => setDate(shiftDate(date, 1))}
              disabled={isSessionActive && !isHistoryMode}
              className="bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 text-xs px-2 py-1.5 rounded-r-lg transition"
            >
              翌日
            </button>
            <input
              type="date"
              value={date}
              disabled={isSessionActive && !isHistoryMode}
              onChange={(e: { target: { value: string } }) => setDate(e.target.value)}
              className="bg-white text-slate-900 border border-slate-300 rounded-lg px-3 py-1.5 text-sm ml-2 focus:outline-none focus:ring-2 focus:ring-primary-600 disabled:opacity-40 disabled:cursor-not-allowed"
            />
          </div>
        </div>

        {/* Column Jump Buttons */}
        <div className="bg-white border-b border-slate-200 px-2 py-2 sticky top-[57px] z-10">
          <div className="flex gap-1 overflow-x-auto">
            {BOARD_COLUMNS.map((col) => {
              const count = visits.filter((v: AdminVisit) =>
                col.key === 'serving' ? v.status === 'serving' || v.status === 'seated' : v.status === col.key
              ).length;
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
        <div
          ref={boardContainerRef}
          onScroll={handleBoardScroll}
          className="px-3 py-4 overflow-x-auto md:overflow-visible flex md:grid md:grid-cols-3 gap-4 md:gap-3 snap-x snap-mandatory md:snap-none [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {BOARD_COLUMNS.map((col) => {
            const colVisits = visits.filter((v: AdminVisit) =>
              col.key === 'serving' ? v.status === 'serving' || v.status === 'seated' : v.status === col.key
            );
            return (
              <div
                key={col.key}
                ref={columnRefs[col.key]}
                data-column={col.key}
                className="flex-none w-[min(92vw,420px)] md:w-auto md:flex-1 md:min-w-0 snap-start"
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
                      readOnly={isHistoryMode}
                      onStatusChange={handleUpdateStatus}
                      onServeOrder={handleServeOrder}
                      onCancelOrder={handleCancelOrder}
                    />
                  ))}
                  {colVisits.length === 0 && (
                    <div className="text-center py-8 text-slate-400 text-sm">なし</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {sessionAction && (
          <ModalPortal>
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
          </ModalPortal>
        )}
      </main>
    </div>
  );
}

// --- Visit Card ---

function VisitCard({
  visit,
  readOnly,
  onStatusChange,
  onServeOrder,
  onCancelOrder,
}: {
  visit: AdminVisit;
  readOnly: boolean;
  onStatusChange: (visitId: number, status: VisitStatus) => void | Promise<void>;
  onServeOrder: (orderId: number) => void | Promise<void>;
  onCancelOrder: (orderId: number) => void | Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ type: 'serve' | 'cancel' | 'reopen'; orderId?: number } | null>(null);
  // UI policy: hide "seated" from admin UI completely.
  // If a visit is seated, treat it as "serving" for display & actions.
  const uiStatus: VisitStatus = visit.status === 'seated' ? 'serving' : visit.status;
  const next = NEXT_STATUS[uiStatus];
  const prev = PREV_STATUS[uiStatus];
  const isDone = uiStatus === 'done';
  const isCheckout = uiStatus === 'checkout';
  const canCancelOrders = !isDone && !isCheckout;

  return (
    <div className="bg-white rounded-lg p-3 text-base md:text-sm shadow-sm border border-slate-200">
      {/* Header: table + user + NEW badge + 注文を見る + 履歴 */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="bg-blue-600 text-white text-sm md:text-xs font-bold px-2 py-0.5 rounded">
            {visit.table_number || '未設定'}
          </span>
          {visit.status === 'seated' && (
            <span className="bg-slate-100 text-slate-700 text-xs md:text-[10px] font-bold px-1.5 py-0.5 rounded">
              準備中
            </span>
          )}
          <span className="text-slate-700 truncate max-w-[120px] md:max-w-[100px]">
            {visit.user.display_name || '不明'}
          </span>
          {visit.summary.has_new && (
            <span className="bg-red-500 text-white text-xs md:text-[10px] font-bold px-1.5 py-0.5 rounded animate-pulse">
              NEW {visit.summary.new_count}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {visit.orders.length > 0 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-sm md:text-xs text-primary-600 hover:text-primary-700 font-medium"
            >
              {expanded ? '閉じる' : `注文 (${visit.orders.length}件)`}
            </button>
          )}
          <Link
            href={`/admin/users/${visit.user.id}`}
            className="text-slate-400 hover:text-primary-600 text-sm md:text-xs underline"
          >
            履歴
          </Link>
        </div>
      </div>

      {/* Time */}
      {visit.checked_in_at && (
        <p className="text-sm md:text-xs text-slate-400 mb-2">
          入店 {elapsedMinutes(visit.checked_in_at)}
        </p>
      )}

      {/* Summary */}
      <div className="flex items-center justify-between text-sm md:text-xs mb-2">
        <span className="text-slate-500">
          {visit.summary.order_count}件
        </span>
        <span className="font-bold text-slate-900">
          &yen;{visit.summary.total_amount.toLocaleString()}
        </span>
      </div>

      {/* Orders (collapsible) */}
      {visit.orders.length > 0 && expanded && (
        <div className="border-t border-slate-200 pt-2">
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
                  <div className="flex justify-between items-center text-sm md:text-xs text-slate-500 mb-1">
                    <span className="flex items-center gap-1">
                      #{order.id}
                      {isNew && (
                        <span className="bg-red-500 text-white text-xs md:text-[10px] font-bold px-1 py-0.5 rounded">NEW</span>
                      )}
                      {isServed && (
                        <span className="text-green-600 text-xs md:text-[10px]">提供済</span>
                      )}
                      {isCancelled && (
                        <span className="text-red-500 text-xs md:text-[10px]">取消済</span>
                      )}
                    </span>
                    <div className="flex items-center gap-1">
                      <span>{new Date(order.created_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}</span>
                      {isNew && (
                        <button
                          onClick={() => setConfirmAction({ type: 'serve', orderId: order.id })}
                          disabled={readOnly}
                          className="text-green-600 hover:text-green-700 text-xs md:text-[10px] px-1 py-0.5 border border-green-300 rounded hover:border-green-400 transition"
                        >
                          提供済
                        </button>
                      )}
                      {canCancelOrders && !isCancelled && (
                        <button
                          onClick={() => setConfirmAction({ type: 'cancel', orderId: order.id })}
                          disabled={readOnly}
                          className="text-red-500 hover:text-red-600 text-xs md:text-[10px] px-1 py-0.5 border border-red-300 rounded hover:border-red-400 transition"
                        >
                          削除
                        </button>
                      )}
                    </div>
                  </div>
                  {order.items.map((item) => (
                    <div key={item.id} className={`flex justify-between text-sm md:text-xs ${isCancelled ? 'line-through' : ''}`}>
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
              <p className="text-xs md:text-[10px] text-slate-400 mt-1">
                {isDone ? '会計済みのため取消不可（提供中に戻してください）' : '会計中のため取消不可'}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Status buttons */}
      {!readOnly && (
        <div className="flex flex-col gap-2 mt-3">
          {prev && (
            <button
              onClick={() => {
                if (isDone) {
                  setConfirmAction({ type: 'reopen' });
                } else {
                  onStatusChange(visit.id, prev);
                }
              }}
              className={`w-full text-sm md:text-xs min-h-[44px] md:min-h-0 py-2 md:py-1.5 px-2 rounded-lg md:rounded transition ${
                isDone
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              {PREV_LABEL[uiStatus]}
            </button>
          )}
          {next && (
            <button
              onClick={() => onStatusChange(visit.id, next)}
              className="w-full bg-primary-600 hover:bg-primary-700 text-white text-sm md:text-xs font-semibold min-h-[48px] md:min-h-0 py-3 md:py-1.5 px-2 rounded-lg md:rounded transition"
            >
              {NEXT_LABEL[uiStatus]}
            </button>
          )}
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmAction && !readOnly && (
        <ModalPortal>
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
        </ModalPortal>
      )}
    </div>
  );
}
