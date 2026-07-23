import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { ToastItem } from '../../context/ToastContext.js';

interface ToastViewportProps {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}

const VARIANT_CLASSES: Record<ToastItem['variant'], string> = {
  error: 'border-danger/40 bg-danger-bg',
  success: 'border-success/40 bg-success-bg',
  info: 'border-border-strong bg-surface-2',
};

export function ToastViewport({ toasts, onDismiss }: ToastViewportProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-2 px-4 sm:left-auto sm:right-4 sm:items-end">
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            role="status"
            aria-live="polite"
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: shouldReduceMotion ? 0.001 : 0.2, ease: 'easeOut' }}
            className={`pointer-events-auto w-full max-w-sm rounded-control border px-4 py-3 text-sm text-fg shadow-glass backdrop-blur-xl ${VARIANT_CLASSES[toast.variant]}`}
          >
            <div className="flex items-start justify-between gap-3">
              <p>{toast.message}</p>
              <button
                type="button"
                onClick={() => onDismiss(toast.id)}
                className="shrink-0 text-fg-muted transition-colors duration-150 hover:text-fg"
                aria-label="Dismiss notification"
              >
                &times;
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
