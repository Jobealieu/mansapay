import { afterEach, describe, expect, it, vi } from 'vitest';
import { Horizon, Keypair } from '@stellar/stellar-sdk';

describe('buildSignedPaymentTransaction', () => {
  it('builds a well-formed payment operation and produces a validly signed transaction', async () => {
    const { buildSignedPaymentTransaction } = await import('./stellar.service.js');
    const senderKeypair = Keypair.random();
    const destinationKeypair = Keypair.random();

    const transaction = buildSignedPaymentTransaction({
      accountId: senderKeypair.publicKey(),
      sequence: '100',
      senderSecret: senderKeypair.secret(),
      destinationPublicKey: destinationKeypair.publicKey(),
      amount: '25.5',
    });

    expect(transaction.source).toBe(senderKeypair.publicKey());
    expect(transaction.sequence).toBe('101');
    expect(transaction.operations).toHaveLength(1);

    const [operation] = transaction.operations;
    expect(operation!.type).toBe('payment');
    if (operation!.type === 'payment') {
      expect(operation.destination).toBe(destinationKeypair.publicKey());
      expect(operation.amount).toBe('25.5000000');
      expect(operation.asset.isNative()).toBe(true);
    }

    expect(transaction.signatures).toHaveLength(1);
    const signature = transaction.signatures[0]!.signature();
    const signedByCorrectKey = Keypair.fromPublicKey(senderKeypair.publicKey()).verify(transaction.hash(), signature);
    expect(signedByCorrectKey).toBe(true);
  });

  it('never leaks the sender secret into the built transaction or its signature', async () => {
    const { buildSignedPaymentTransaction } = await import('./stellar.service.js');
    const senderKeypair = Keypair.random();
    const destinationKeypair = Keypair.random();
    const secret = senderKeypair.secret();

    const transaction = buildSignedPaymentTransaction({
      accountId: senderKeypair.publicKey(),
      sequence: '1',
      senderSecret: secret,
      destinationPublicKey: destinationKeypair.publicKey(),
      amount: '1',
    });

    expect(transaction.toEnvelope().toXDR('base64')).not.toContain(secret);

    const otherKeypair = Keypair.random();
    const signature = transaction.signatures[0]!.signature();
    expect(otherKeypair.verify(transaction.hash(), signature)).toBe(false);
  });
});

describe('fundTestnetAccount', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resolves when friendbot responds ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));
    const { fundTestnetAccount } = await import('./stellar.service.js');

    await expect(fundTestnetAccount(Keypair.random().publicKey())).resolves.toBeUndefined();
  });

  it('throws when friendbot responds with a non-2xx status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 400 }));
    const { fundTestnetAccount } = await import('./stellar.service.js');

    await expect(fundTestnetAccount(Keypair.random().publicKey())).rejects.toThrow();
  });
});

describe('loadAccount / availableNativeBalance', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('maps the Horizon account response into a snapshot and computes the reserve-aware available balance', async () => {
    const { loadAccount, availableNativeBalance } = await import('./stellar.service.js');
    const keypair = Keypair.random();

    vi.spyOn(Horizon.Server.prototype, 'loadAccount').mockResolvedValue({
      accountId: () => keypair.publicKey(),
      sequenceNumber: () => '42',
      subentry_count: 0,
      balances: [{ asset_type: 'native', balance: '100.0000000' }],
    } as unknown as Horizon.AccountResponse);

    const snapshot = await loadAccount(keypair.publicKey());

    expect(snapshot).toEqual({
      accountId: keypair.publicKey(),
      sequence: '42',
      nativeBalance: '100.0000000',
      subentryCount: 0,
    });
    // 100 XLM - (2 base reserves * 0.5 XLM) = 99 available
    expect(availableNativeBalance(snapshot)).toBe('99.0000000');
  });
});

describe('submitPayment', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('submits the built transaction to Horizon and returns the resulting hash', async () => {
    const { submitPayment, buildSignedPaymentTransaction } = await import('./stellar.service.js');
    const senderKeypair = Keypair.random();
    const destinationKeypair = Keypair.random();

    const transaction = buildSignedPaymentTransaction({
      accountId: senderKeypair.publicKey(),
      sequence: '1',
      senderSecret: senderKeypair.secret(),
      destinationPublicKey: destinationKeypair.publicKey(),
      amount: '5',
    });

    const submitTransactionMock = vi
      .spyOn(Horizon.Server.prototype, 'submitTransaction')
      .mockResolvedValue({ hash: 'deadbeefhash' } as unknown as Horizon.HorizonApi.SubmitTransactionResponse);

    const hash = await submitPayment(transaction);

    expect(hash).toBe('deadbeefhash');
    expect(submitTransactionMock).toHaveBeenCalledWith(transaction);
  });
});
