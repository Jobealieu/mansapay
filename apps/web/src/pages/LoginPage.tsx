import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { loginRequestSchema } from '@mansapay/shared';
import { AuthLayout } from '../components/AuthLayout.js';
import { Button } from '../components/ui/Button.js';
import { Input } from '../components/ui/Input.js';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../context/ToastContext.js';
import { toHumanMessage } from '../lib/error-messages.js';

interface FormState {
  phoneNumber: string;
  password: string;
}

export function LoginPage() {
  const location = useLocation();
  const prefillPhoneNumber = (location.state as { phoneNumber?: string } | null)?.phoneNumber ?? '';

  const [form, setForm] = useState<FormState>({ phoneNumber: prefillPhoneNumber, password: '' });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormState, string | undefined>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
    setFormError(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const parsed = loginRequestSchema.safeParse(form);
    if (!parsed.success) {
      const flattened = parsed.error.flatten().fieldErrors;
      setFieldErrors({ phoneNumber: flattened.phoneNumber?.[0], password: flattened.password?.[0] });
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    try {
      await login(parsed.data);
      navigate('/verify-phone', { replace: true });
    } catch (err) {
      const message = toHumanMessage(err);
      showToast(message);
      setFormError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to send and receive money."
      footer={
        <>
          New to MansaPay?{' '}
          <Link to="/register" className="font-medium text-accent-gold transition-colors duration-150 hover:text-accent-copper">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <Input
          label="Phone number"
          type="tel"
          placeholder="+2217700000"
          autoComplete="tel"
          value={form.phoneNumber}
          error={fieldErrors.phoneNumber}
          onChange={(event) => updateField('phoneNumber', event.target.value)}
          required
        />
        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          value={form.password}
          error={fieldErrors.password}
          onChange={(event) => updateField('password', event.target.value)}
          required
        />
        {formError && (
          <p role="alert" className="rounded-control border border-danger/40 bg-danger-bg px-3.5 py-2.5 text-sm text-danger">
            {formError}
          </p>
        )}
        <Button type="submit" fullWidth isLoading={isSubmitting} className="mt-2">
          Log in
        </Button>
      </form>
    </AuthLayout>
  );
}
