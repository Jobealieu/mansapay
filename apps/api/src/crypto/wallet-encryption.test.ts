import { describe, expect, it } from 'vitest';
import { encryptSecret, decryptSecret } from './wallet-encryption.js';

const STELLAR_SECRET = 'SBQWY3AKD3MVQNBQEPRSTMNGWXWBHT5N7HL7RQCUAM7DYUVW3EK5CDVA';

describe('encryptSecret / decryptSecret', () => {
  it('round-trips a secret through encrypt then decrypt', () => {
    const encrypted = encryptSecret(STELLAR_SECRET);
    expect(decryptSecret(encrypted)).toBe(STELLAR_SECRET);
  });

  it('never stores the plaintext secret in the encrypted output', () => {
    const encrypted = encryptSecret(STELLAR_SECRET);
    expect(encrypted).not.toContain(STELLAR_SECRET);
  });

  it('produces a different ciphertext each time (random iv)', () => {
    const first = encryptSecret(STELLAR_SECRET);
    const second = encryptSecret(STELLAR_SECRET);
    expect(first).not.toBe(second);
  });

  it('rejects a tampered ciphertext', () => {
    const encrypted = encryptSecret(STELLAR_SECRET);
    const [iv, authTag, ciphertext] = encrypted.split(':');
    const tamperedByte = ciphertext!.slice(0, -2) + (ciphertext!.slice(-2) === '00' ? '01' : '00');
    const tampered = [iv, authTag, tamperedByte].join(':');

    expect(() => decryptSecret(tampered)).toThrow();
  });
});
