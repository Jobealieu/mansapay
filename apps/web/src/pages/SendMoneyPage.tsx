import { useState, type FormEvent } from 'react';
import { z } from 'zod';
import { phoneNumberSchema } from '@mansapay/shared';
import { Card } from '../components/ui/Card.js';
import { Button } from '../components/ui/Button.js';
import { Input } from '../components/ui/Input.js';
import { LinkButton } from '../components/ui/LinkButton.js';
import { useToast } from '../context/ToastContext.js';
import { transferMoney } from '../lib/api.js';
import { toHumanMessage } from '../lib/error-messages.js';
import { stellarExplorerTxUrl } from '../lib/format.js';

const transferFormSchema = z.object({
  toPhoneNumber: phoneNumberSchema,
  amount: z
    .string()
    .regex(/^\d+(\.\d{1,7})?$/, 'Enter a valid amount, up to 7 decimal places')
    .refine((value) => Number(value) > 0, 'Amount must be greater than 0'),
});

interface FormState {
  toPhoneNumber: string;
  amount: string;
}

const INITIAL_STATE: FormState = { toPhoneNumber: '', amount: '' };

interface SentResult {
  amount: string;
  hash: string;
}

export function SendMoneyPage() {
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormState, string | undefined>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sentResult, setSentResult] = useState<SentResult | null>(null);
  const { showToast } = useToast();

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const parsed = transferFormSchema.safeParse(form);
    if (!parsed.success) {
      const flattened = parsed.error.flatten().fieldErrors;
      setFieldErrors({ toPhoneNumber: flattened.toPhoneNumber?.[0], amount: flattened.amount?.[0] });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await transferMoney(parsed.data);
      setSentResult({ amount: parsed.data.amount, hash: result.hash });
    } catch (err) {
      showToast(toHumanMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleSendAnother() {
    setSentResult(null);
    setForm(INITIAL_STATE);
  }

  if (sentResult) {
    return (
      <Card>
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-success-bg text-success">
            <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
              <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <div>
            <h1 className="text-xl font-semibold text-fg">Money sent</h1>
            <p className="mt-1.5 text-sm text-fg-muted">
              You sent <span className="font-semibold text-fg">{sentResult.amount} XLM</span>.
            </p>
          </div>
          <a
            href={stellarExplorerTxUrl(sentResult.hash)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-accent-gold underline-offset-4 hover:text-accent-copper hover:underline"
          >
            View on Stellar Explorer
          </a>
          <div className="mt-2 flex w-full flex-col gap-3 sm:flex-row">
            <Button variant="secondary" fullWidth onClick={handleSendAnother}>
              Send another
            </Button>
            <LinkButton to="/dashboard" fullWidth>
              Back to dashboard
            </LinkButton>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-fg">Send money</h1>
        <p className="mt-1.5 text-sm text-fg-muted">Send XLM to another MansaPay user by phone number.</p>
      </div>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <Input
          label="Recipient phone number"
          type="tel"
          placeholder="+2217700000"
          autoComplete="off"
          value={form.toPhoneNumber}
          error={fieldErrors.toPhoneNumber}
          onChange={(event) => updateField('toPhoneNumber', event.target.value)}
          required
        />
        <Input
          label="Amount"
          type="text"
          inputMode="decimal"
          placeholder="0.00"
          helperText="XLM"
          value={form.amount}
          error={fieldErrors.amount}
          onChange={(event) => updateField('amount', event.target.value)}
          required
        />
        <Button type="submit" fullWidth isLoading={isSubmitting} className="mt-2">
          Send
        </Button>
      </form>
    </Card>
  );
}
