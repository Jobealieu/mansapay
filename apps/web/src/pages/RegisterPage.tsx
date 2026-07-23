import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registerRequestSchema } from '@mansapay/shared';
import { AuthLayout } from '../components/AuthLayout.js';
import { Button } from '../components/ui/Button.js';
import { Input } from '../components/ui/Input.js';
import { Select } from '../components/ui/Select.js';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../context/ToastContext.js';
import { ApiError } from '../lib/api.js';
import { toHumanMessage } from '../lib/error-messages.js';

const COUNTRY_OPTIONS = [
  { value: 'SN', label: 'Senegal' },
  { value: 'GM', label: 'The Gambia' },
];

interface FormState {
  phoneNumber: string;
  email: string;
  password: string;
  country: string;
}

const INITIAL_STATE: FormState = { phoneNumber: '', email: '', password: '', country: '' };

export function RegisterPage() {
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormState, string | undefined>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { registerAccount } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const parsed = registerRequestSchema.safeParse({
      phoneNumber: form.phoneNumber.trim(),
      email: form.email.trim() ? form.email.trim() : undefined,
      password: form.password,
      country: form.country,
    });

    if (!parsed.success) {
      const flattened = parsed.error.flatten().fieldErrors;
      setFieldErrors({
        phoneNumber: flattened.phoneNumber?.[0],
        email: flattened.email?.[0],
        password: flattened.password?.[0],
        country: flattened.country?.[0],
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await registerAccount(parsed.data);
      showToast('Account created. Please log in to continue.', 'success');
      navigate('/login', { state: { phoneNumber: parsed.data.phoneNumber } });
    } catch (err) {
      showToast(toHumanMessage(err));
      if (err instanceof ApiError && err.code === 'phone_number_taken') {
        setFieldErrors((current) => ({ ...current, phoneNumber: toHumanMessage(err) }));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Send money between Senegal and The Gambia in seconds."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-accent-gold transition-colors duration-150 hover:text-accent-copper">
            Log in
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
        <Select
          label="Country"
          placeholder="Select your country"
          options={COUNTRY_OPTIONS}
          value={form.country}
          error={fieldErrors.country}
          onChange={(event) => updateField('country', event.target.value)}
          required
        />
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          helperText="Optional"
          value={form.email}
          error={fieldErrors.email}
          onChange={(event) => updateField('email', event.target.value)}
        />
        <Input
          label="Password"
          type="password"
          autoComplete="new-password"
          helperText="At least 8 characters"
          value={form.password}
          error={fieldErrors.password}
          onChange={(event) => updateField('password', event.target.value)}
          required
        />
        <Button type="submit" fullWidth isLoading={isSubmitting} className="mt-2">
          Create account
        </Button>
      </form>
    </AuthLayout>
  );
}
