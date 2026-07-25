// Amounts arrive from the API as pre-formatted decimal strings and must
// never be parsed to a float for display or comparison - only string
// manipulation here, never Number() math.
export function trimTrailingZeros(amount: string): string {
  if (!amount.includes('.')) {
    return amount;
  }
  return amount.replace(/0+$/, '').replace(/\.$/, '');
}

export function truncatePublicKey(publicKey: string): string {
  if (publicKey.length <= 10) {
    return publicKey;
  }
  return `${publicKey.slice(0, 4)}...${publicKey.slice(-4)}`;
}

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso));
}

export function stellarExplorerTxUrl(hash: string): string {
  return `https://stellar.expert/explorer/testnet/tx/${hash}`;
}
