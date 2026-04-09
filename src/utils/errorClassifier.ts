const NETWORK_ERROR_PATTERNS = [
  'network request failed',
  'failed to fetch',
  'network error',
  'timeout',
];

export function isNetworkError(error: unknown): boolean {
  let msg: string | null = null;

  if (error instanceof Error) {
    msg = error.message.toLowerCase();
  } else if (typeof error === 'string') {
    msg = error.toLowerCase();
  }

  if (msg === null) return false;

  return NETWORK_ERROR_PATTERNS.some(pattern => msg!.includes(pattern));
}
