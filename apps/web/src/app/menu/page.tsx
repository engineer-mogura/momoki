'use client';

import { useEffect, useRef, useState, type MouseEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { MenuCategory, MenuItem } from '@/types';
import { useCart } from '@/hooks/useCart';

type TabType = 'drink' | 'bottle';

export default function MenuPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('drink');
  const { addItem, totalItems, totalAmount } = useCart();
  const cartCtaRef = useRef<HTMLAnchorElement | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const [toastVisible, setToastVisible] = useState(false);

  const getPrefersReducedMotion = () => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
  };

  const bounceCartCta = (el: HTMLElement) => {
    try {
      el.animate(
        [
          { transform: 'scale(1)' },
          { transform: 'scale(1.06)' },
          { transform: 'scale(1)' },
        ],
        { duration: 420, easing: 'ease-out' }
      );
    } catch {
      // ignore (WAAPI not supported)
    }
  };

  const flyDotToCart = (
    startX: number,
    startY: number,
    targetEl: HTMLElement | null,
    onFinish?: () => void
  ) => {
    const end = (() => {
      if (targetEl) {
        const r = targetEl.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      }
      // Fallback: bottom center-ish
      return { x: window.innerWidth / 2, y: window.innerHeight - 56 };
    })();

    const dot = document.createElement('div');
    const size = 16;
    dot.style.position = 'fixed';
    dot.style.left = `${startX - size / 2}px`;
    dot.style.top = `${startY - size / 2}px`;
    dot.style.width = `${size}px`;
    dot.style.height = `${size}px`;
    dot.style.borderRadius = '9999px';
    dot.style.background = '#ea580c'; // tailwind orange-600
    dot.style.border = '2px solid rgba(255,255,255,0.9)';
    dot.style.boxShadow = '0 8px 18px rgba(0,0,0,0.18)';
    dot.style.zIndex = '9999';
    dot.style.pointerEvents = 'none';

    document.body.appendChild(dot);

    const dx = end.x - startX;
    const dy = end.y - startY;

    try {
      const anim = dot.animate(
        [
          { transform: 'translate(0px, 0px) scale(1)', opacity: 1 },
          { transform: `translate(${dx}px, ${dy}px) scale(0.2)`, opacity: 0 },
        ],
        { duration: 980, easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)', fill: 'forwards' }
      );
      anim.addEventListener(
        'finish',
        () => {
          dot.remove();
          onFinish?.();
        },
        { once: true }
      );
      anim.addEventListener('cancel', () => dot.remove(), { once: true });
    } catch {
      // Fallback: remove immediately if animation not supported
      dot.remove();
    }
  };

  const showToast = () => {
    setToastVisible(true);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToastVisible(false), 1600);
  };

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  // Initialize tab from URL query params
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'drink' || tabParam === 'bottle') {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  useEffect(() => {
    const fetchMenu = async () => {
      try {
        const response = await api.get<{ categories: MenuCategory[] }>('/api/menu-categories');
        setCategories(response.categories);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'メニューの取得に失敗しました');
      } finally {
        setIsLoading(false);
      }
    };

    fetchMenu();
  }, []);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    // Update URL query param
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  const handleAddToCart = (item: MenuItem, fromEl: HTMLElement) => {
    addItem(item);

    if (typeof window === 'undefined') return;
    const fromRect = fromEl.getBoundingClientRect();
    const startX = fromRect.left + fromRect.width / 2;
    const startY = fromRect.top + fromRect.height / 2;
    const reduceMotion = getPrefersReducedMotion();

    // Run after React commit so CTA has a chance to mount (first add)
    window.setTimeout(() => {
      const target = cartCtaRef.current;
      const startBounce = () => {
        if (target) bounceCartCta(target);
      };

      if (!reduceMotion) {
        flyDotToCart(startX, startY, target, () => window.setTimeout(startBounce, 120));
      } else {
        window.setTimeout(startBounce, 120);
      }
      showToast();
    }, 0);
  };

  // Filter categories by theme
  const lightCategories = categories.filter((c: MenuCategory) => c.theme === 'light');
  const darkCategories = categories.filter((c: MenuCategory) => c.theme === 'dark');
  const displayCategories = activeTab === 'drink' ? lightCategories : darkCategories;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-primary-600 hover:bg-primary-700 text-white py-2 px-4 rounded"
          >
            再読み込み
          </button>
        </div>
      </div>
    );
  }

  const isDarkTab = activeTab === 'bottle';

  return (
    <div className="min-h-screen pb-24 bg-slate-50">
      {/* Header - Always Light */}
      <header className="sticky top-0 z-20 shadow-sm border-b bg-white border-slate-200">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-xl font-bold text-slate-900">
              Momoki Bar
            </Link>
            <Link
              href="/cart"
              className="relative bg-primary-600 hover:bg-primary-700 text-white py-2 px-4 rounded-lg transition"
            >
              カート
              {totalItems > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                  {totalItems}
                </span>
              )}
            </Link>
          </div>
        </div>

        {/* Tab Navigation - Always Light */}
        <div className="border-t border-slate-200">
          <div className="container mx-auto px-4">
            <div className="flex gap-1">
              <button
                onClick={() => handleTabChange('drink')}
                className={`flex-1 py-3 px-4 font-semibold text-sm transition-colors ${
                  activeTab === 'drink'
                    ? 'bg-slate-100 text-primary-600 border-b-2 border-primary-600'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}
              >
                ドリンク
              </button>
              <button
                onClick={() => handleTabChange('bottle')}
                className={`flex-1 py-3 px-4 font-semibold text-sm transition-colors ${
                  activeTab === 'bottle'
                    ? 'bg-slate-100 text-primary-600 border-b-2 border-primary-600'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}
              >
                ボトル
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Menu Content - Dark theme only for bottle tab content */}
      <main className="container mx-auto px-4 py-6">
        {displayCategories.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-500">
              {activeTab === 'drink' ? 'ドリンクメニューがありません' : 'ボトルメニューがありません'}
            </p>
          </div>
        ) : (
          displayCategories.map((category: MenuCategory) => (
            <section
              key={category.id}
              className={`mb-8 rounded-xl p-6 ${
                isDarkTab
                  ? 'bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700'
                  : 'bg-transparent'
              }`}
            >
              <h2
                className={`text-2xl font-bold mb-2 ${
                  isDarkTab ? 'text-amber-300' : 'text-slate-900'
                }`}
              >
                {category.name}
              </h2>
              {category.description && (
                <p className={`mb-4 ${isDarkTab ? 'text-slate-300' : 'text-slate-500'}`}>
                  {category.description}
                </p>
              )}
              <div className="grid gap-4">
                {category.items.map((item: MenuItem) => (
                  <div
                    key={item.id}
                    className={`rounded-lg p-4 flex items-center justify-between shadow-sm transition ${
                      isDarkTab
                        ? 'bg-slate-800 border border-slate-700 hover:bg-slate-750'
                        : 'bg-white border border-slate-200'
                    }`}
                  >
                    <div className="flex-1">
                      <h3 className={`font-semibold ${isDarkTab ? 'text-white' : 'text-slate-900'}`}>
                        {item.name}
                      </h3>
                      {item.description && (
                        <p className={`text-sm ${isDarkTab ? 'text-slate-400' : 'text-slate-500'}`}>
                          {item.description}
                        </p>
                      )}
                      <p
                        className={`font-bold mt-1 ${
                          isDarkTab ? 'text-amber-300' : 'text-primary-600'
                        }`}
                      >
                        ¥{item.price.toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={(e: MouseEvent<HTMLButtonElement>) => handleAddToCart(item, e.currentTarget)}
                      className={`py-2 px-4 rounded-lg transition ml-4 font-semibold ${
                        isDarkTab
                          ? 'bg-amber-500 hover:bg-amber-600 text-slate-900'
                          : 'bg-primary-600 hover:bg-primary-700 text-white'
                      }`}
                    >
                      追加
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ))
        )}
      </main>

      {/* Cart Footer - Always Light */}
      {totalItems > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 shadow-[0_-2px_10px_rgba(0,0,0,0.2)] border-t bg-white border-slate-200">
          <div className="container mx-auto flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">{totalItems}点</p>
              <p className="text-lg font-bold text-slate-900">
                ¥{totalAmount.toLocaleString()}
              </p>
            </div>
            <Link
              href="/cart"
              ref={cartCtaRef}
              className="font-semibold py-3 px-8 rounded-lg transition bg-primary-600 hover:bg-primary-700 text-white"
            >
              カートを見る
            </Link>
          </div>
        </div>
      )}

      {toastVisible && (
        <div className="fixed left-0 right-0 bottom-24 flex justify-center pointer-events-none">
          <div className="bg-slate-900/90 text-white text-xs px-3 py-2 rounded-full shadow">
            カートに追加しました
          </div>
        </div>
      )}
    </div>
  );
}
