import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { AuthLayout } from '../components/AuthLayout.js';
import { Button } from '../components/ui/Button.js';
import { OtpInput } from '../components/ui/OtpInput.js';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../context/ToastContext.js';
import { ApiError, confirmOtp, requestOtp } from '../lib/api.js';
import { toHumanMessage } from '../lib/error-messages.js';

type SendState = 'idle' | 'sending' | 'sent' | 'error';

function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function VerifyPhonePage() {
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [sendState, setSendState] = useState<SendState>('idle');
  const [retryAfterSeconds, setRetryAfterSeconds] = useState<number | null>(null);
  const hasSentInitialCode = useRef(false);
  const { logout } = useAuth();
  const { showToast } = useToast();
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (retryAfterSeconds === null || retryAfterSeconds <= 0) {
      return;
    }
    const timer = window.setInterval(() => {
      setRetryAfterSeconds((current) => (current === null ? null : Math.max(current - 1, 0)));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [retryAfterSeconds]);

  const sendCode = useCallback(async () => {
    setSendState('sending');
    try {
      await requestOtp();
      setSendState('sent');
    } catch (err) {
      setSendState('error');
      if (err instanceof ApiError && err.code === 'rate_limited') {
        setRetryAfterSeconds(err.retryAfterSeconds ?? 60);
      }
      showToast(toHumanMessage(err));
    }
  }, [showToast]);

  useEffect(() => {
    if (hasSentInitialCode.current) {
      return;
    }
    hasSentInitialCode.current = true;
    void sendCode();
  }, [sendCode]);

  async function handleConfirm(submittedCode: string) {
    if (submittedCode.length !== 6 || isConfirming) {
      return;
    }
    setIsConfirming(true);
    setCodeError(null);
    try {
      await confirmOtp(submittedCode);
      setIsVerified(true);
      showToast("You're verified!", 'success');
    } catch (err) {
      const message = toHumanMessage(err);
      setCode('');
      setCodeError(message);
      setShakeKey((key) => key + 1);
      showToast(message);
    } finally {
      setIsConfirming(false);
    }
  }

  if (isVerified) {
    return (
      <AuthLayout title="Phone verified" subtitle="Your account is ready.">
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-success-bg text-success">
            <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
              <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <p className="text-sm text-fg-muted">You&apos;re all set. The rest of MansaPay is on its way in a future update.</p>
        </div>
      </AuthLayout>
    );
  }

  const isResendDisabled = sendState === 'sending' || (retryAfterSeconds !== null && retryAfterSeconds > 0);

  return (
    <AuthLayout
      title="Verify your phone"
      subtitle={sendState === 'sending' ? 'Sending your code…' : 'Enter the 6-digit code we sent you.'}
      footer={
        <button
          type="button"
          onClick={() => void logout()}
          className="text-fg-muted underline-offset-4 transition-colors duration-150 hover:text-fg hover:underline"
        >
          Log out
        </button>
      }
    >
      <div className="flex flex-col gap-5">
        <motion.div
          key={shakeKey}
          animate={codeError && !shouldReduceMotion ? { x: [0, -6, 6, -4, 4, 0] } : {}}
          transition={{ duration: 0.35 }}
        >
          <OtpInput
            value={code}
            onChange={(value) => {
              setCode(value);
              setCodeError(null);
            }}
            onComplete={(value) => void handleConfirm(value)}
            error={Boolean(codeError)}
            disabled={isConfirming}
          />
        </motion.div>

        {codeError && (
          <p role="alert" className="text-center text-sm text-danger">
            {codeError}
          </p>
        )}

        <Button type="button" fullWidth isLoading={isConfirming} disabled={code.length !== 6} onClick={() => void handleConfirm(code)}>
          Verify
        </Button>

        <div className="text-center text-sm text-fg-muted">
          Didn&apos;t get a code?{' '}
          <button
            type="button"
            onClick={() => void sendCode()}
            disabled={isResendDisabled}
            className="font-medium text-accent-gold transition-colors duration-150 hover:text-accent-copper disabled:cursor-not-allowed disabled:text-fg-muted"
          >
            {retryAfterSeconds !== null && retryAfterSeconds > 0
              ? `Resend in ${formatCountdown(retryAfterSeconds)}`
              : sendState === 'sending'
                ? 'Sending…'
                : 'Resend code'}
          </button>
        </div>
      </div>
    </AuthLayout>
  );
}
