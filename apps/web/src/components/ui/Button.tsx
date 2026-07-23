import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Spinner } from './Spinner.js';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  isLoading?: boolean;
  fullWidth?: boolean;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-gradient-to-br from-accent-gold to-accent-copper text-bg font-semibold shadow-glow hover:brightness-110',
  secondary: 'border border-border-strong bg-surface-2 text-fg hover:bg-white/[0.06]',
  ghost: 'bg-transparent text-fg-muted hover:bg-white/[0.04] hover:text-fg',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', isLoading = false, fullWidth = false, disabled, className = '', children, type, ...props },
  ref,
) {
  const isDisabled = disabled || isLoading;

  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      disabled={isDisabled}
      aria-busy={isLoading}
      className={`relative inline-flex items-center justify-center gap-2 rounded-control px-4 py-2.5 text-sm transition-all duration-200 ease-out active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100 ${
        fullWidth ? 'w-full' : ''
      } ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    >
      <span className={isLoading ? 'invisible' : 'contents'}>{children}</span>
      {isLoading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Spinner className="h-4 w-4" />
        </span>
      )}
    </button>
  );
});
