import type { AnchorHTMLAttributes } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { BUTTON_VARIANT_CLASSES, type ButtonVariant } from './Button.js';

interface LinkButtonProps extends LinkProps, Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  variant?: ButtonVariant;
  fullWidth?: boolean;
}

export function LinkButton({ variant = 'primary', fullWidth = false, className = '', ...props }: LinkButtonProps) {
  return (
    <Link
      className={`inline-flex items-center justify-center gap-2 rounded-control px-4 py-2.5 text-sm transition-all duration-200 ease-out active:scale-[0.98] ${
        fullWidth ? 'w-full' : ''
      } ${BUTTON_VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    />
  );
}
