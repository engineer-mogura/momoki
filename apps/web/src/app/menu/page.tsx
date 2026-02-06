'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { MenuCategory, MenuItem } from '@/types';
import { useCart } from '@/hooks/useCart';

export default function MenuPage() {
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { addItem, totalItems, totalAmount } = useCart();

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

  const handleAddToCart = (item: MenuItem) => {
    addItem(item);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center text-white">
          <p className="text-red-500 mb-4">{error}</p>
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

  return (
    <div className="min-h-screen bg-gray-900 text-white pb-24">
      {/* Header */}
      <header className="bg-gray-800 sticky top-0 z-10 shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-xl font-bold">
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
      </header>

      {/* Menu */}
      <main className="container mx-auto px-4 py-6">
        {categories.map((category) => (
          <section key={category.id} className="mb-8">
            <h2 className="text-2xl font-bold mb-2">{category.name}</h2>
            {category.description && (
              <p className="text-gray-400 mb-4">{category.description}</p>
            )}
            <div className="grid gap-4">
              {category.items.map((item) => (
                <div
                  key={item.id}
                  className="bg-gray-800 rounded-lg p-4 flex items-center justify-between"
                >
                  <div className="flex-1">
                    <h3 className="font-semibold">{item.name}</h3>
                    {item.description && (
                      <p className="text-sm text-gray-400">{item.description}</p>
                    )}
                    <p className="text-primary-400 font-bold mt-1">
                      ¥{item.price.toLocaleString()}
                    </p>
                  </div>
                  <button
                    onClick={() => handleAddToCart(item)}
                    className="bg-primary-600 hover:bg-primary-700 text-white py-2 px-4 rounded-lg transition ml-4"
                  >
                    追加
                  </button>
                </div>
              ))}
            </div>
          </section>
        ))}
      </main>

      {/* Cart Footer */}
      {totalItems > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 p-4">
          <div className="container mx-auto flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">{totalItems}点</p>
              <p className="text-lg font-bold">¥{totalAmount.toLocaleString()}</p>
            </div>
            <Link
              href="/cart"
              className="bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 px-8 rounded-lg transition"
            >
              カートを見る
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
