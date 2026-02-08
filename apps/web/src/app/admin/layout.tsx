import type { ReactNode } from 'react';

// Vercel/Next build: avoid prerender errors on /admin (uses useSearchParams in client page)
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

