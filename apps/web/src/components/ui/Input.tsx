import { forwardRef, useId, type InputHTMLAttributes } from 'react';
import { FieldShell, fieldDescribedBy } from './FieldShell.js';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string | undefined;
  helperText?: string | undefined;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, helperText, id, required, className = '', ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <FieldShell id={inputId} label={label} error={error} helperText={helperText} required={required}>
      <input
        ref={ref}
        id={inputId}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={fieldDescribedBy(inputId, error, helperText)}
        className={`w-full rounded-control border bg-surface px-3.5 py-2.5 text-sm text-fg placeholder:text-fg-muted transition-colors duration-150 focus:outline-none focus-visible:border-accent-gold ${
          error ? 'border-danger' : 'border-border-strong'
        } ${className}`}
        {...props}
      />
    </FieldShell>
  );
});
