import { createApp } from './app.js';
import { env } from './config/env.js';

if (env.SMS_DEV_MODE) {
  if (env.DEMO_MODE) {
    console.warn(
      [
        '',
        '================ DEMO MODE: SMS DELIVERY BYPASSED ================',
        'SMS_DEV_MODE=true and DEMO_MODE=true. OTP codes are logged to this',
        'server console instead of being sent via SMS. This is intended ONLY',
        'for the public academic grading deployment and must never be left',
        'on for a deployment serving real users.',
        '====================================================================',
        '',
      ].join('\n'),
    );
  } else {
    console.warn(
      '⚠️  SMS_DEV_MODE is ON - OTP codes are logged to this console instead of being sent via SMS. Never enable in production.',
    );
  }
}

const app = createApp();

// Explicit 0.0.0.0, not the Node default or 127.0.0.1: Render's load
// balancer connects from outside this container, and a loopback-bound
// server is unreachable from it. PORT is injected by Render at runtime -
// never set it manually in the service's env vars.
app.listen(env.PORT, '0.0.0.0', () => {
  console.log(`MansaPay API listening on 0.0.0.0:${env.PORT}`);
});
