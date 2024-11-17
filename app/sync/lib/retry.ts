interface RetryOptions {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffFactor: number;
}

const defaultOptions: RetryOptions = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffFactor: 2,
};

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts = { ...defaultOptions, ...options };
  let attempt = 1;
  let delay = opts.initialDelay;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= opts.maxAttempts) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
      delay = Math.min(delay * opts.backoffFactor, opts.maxDelay);
      attempt++;
    }
  }
}
