import type { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Card({ children, className = '', ...props }: CardProps) {
  return (
    <div
      className={`rounded-card border border-border bg-surface/60 p-6 shadow-glass backdrop-blur-xl sm:p-8 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
