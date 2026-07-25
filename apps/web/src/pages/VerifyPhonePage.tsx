import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
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
  const [sendState, setSendState] = useState<SendState>('idle');
  const [retryAfterSeconds, setRetryAfterSeconds] = useState<number | null>(null);
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const hasSentInitialCode = useRef(false);
  const { logout } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
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
      const result = await requestOtp();
      if (result?.demoMode) {
        setDemoCode(result.devCode);
        setCode(result.devCode);
      } else {
        setDemoCode(null);
      }
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
      showToast("You're verified!", 'success');
      navigate('/dashboard', { replace: true });
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
        {demoCode && (
          <div
            role="status"
            className="flex flex-col items-center gap-1.5 rounded-control border border-accent-gold/40 bg-accent-gold/10 px-3.5 py-3 text-center"
          >
            <span className="text-xs font-semibold uppercase tracking-wide text-accent-gold">
              Demo mode - code shown for testing
            </span>
            <span className="font-mono text-lg font-semibold tracking-[0.3em] text-fg">{demoCode}</span>
            <button
              type="button"
              onClick={() => setCode(demoCode)}
              className="text-xs font-medium text-accent-gold underline-offset-4 hover:text-accent-copper hover:underline"
            >
              Fill code
            </button>
          </div>
        )}

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
