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

app.listen(env.PORT, () => {
  console.log(`MansaPay API listening on port ${env.PORT}`);
});
