'use client';

import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Portal-based modal overlay.
 * Renders to document.body to escape stacking context issues.
 * Locks body scroll while open.
 */
export function ModalPortal({
  children,
  onOverlayClick,
}: {
  children: ReactNode;
  onOverlayClick?: () => void;
}) {
  // Body scroll lock
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40"
      onClick={
        onOverlayClick
          ? (e) => {
              if (e.target === e.currentTarget) onOverlayClick();
            }
          : undefined
      }
    >
      {children}
    </div>,
    document.body
  );
}
