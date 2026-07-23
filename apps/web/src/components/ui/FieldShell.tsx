import type { ReactNode } from 'react';

interface FieldShellProps {
  id: string;
  label: string;
  error?: string | undefined;
  helperText?: string | undefined;
  required?: boolean | undefined;
  children: ReactNode;
}

export function FieldShell({ id, label, error, helperText, required, children }: FieldShellProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-fg">
        {label}
        {required && <span className="text-accent-gold"> *</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : helperText ? (
        <p id={`${id}-helper`} className="text-sm text-fg-muted">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}

export function fieldDescribedBy(id: string, error?: string | undefined, helperText?: string | undefined): string | undefined {
  if (error) return `${id}-error`;
  if (helperText) return `${id}-helper`;
  return undefined;
}
