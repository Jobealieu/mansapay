import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Card } from './ui/Card.js';

interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 py-10">
      <motion.div
        initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: shouldReduceMotion ? 0.001 : 0.25, ease: 'easeOut' }}
        className="w-full max-w-sm"
      >
        <div className="mb-8 text-center">
          <span className="bg-gradient-to-br from-accent-gold to-accent-copper bg-clip-text text-2xl font-bold tracking-tight text-transparent">
            MansaPay
          </span>
        </div>

        <Card>
          <div className="mb-6">
            <h1 className="text-xl font-semibold text-fg">{title}</h1>
            {subtitle && <p className="mt-1.5 text-sm text-fg-muted">{subtitle}</p>}
          </div>
          {children}
        </Card>

        {footer && <div className="mt-6 text-center text-sm text-fg-muted">{footer}</div>}
      </motion.div>
    </div>
  );
}
