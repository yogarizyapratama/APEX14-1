export class TimeoutError extends Error {
  constructor(message: string = "Operation timed out") {
    super(message);
    this.name = "TimeoutError";
  }
}

export class CircuitBreakerOpenError extends Error {
  constructor(message: string = "Circuit breaker is OPEN — downstream service unavailable") {
    super(message);
    this.name = "CircuitBreakerOpenError";
  }
}

export type BackoffStrategy = "linear" | "exponential";

export interface CircuitBreakerOptions {
  failureThreshold?: number; // e.g. 0.5 (50% failures)
  resetTimeoutMs?: number;   // e.g. 30000 (30s)
  minimumRequests?: number;  // min requests before evaluating threshold
}

export interface ResilienceOptions {
  retries?: number;
  backoff?: BackoffStrategy;
  retryDelayMs?: number;
  timeoutMs?: number;
  circuitBreaker?: CircuitBreakerOptions;
}

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export class CircuitBreaker {
  public state: CircuitState = "CLOSED";
  private failureCount = 0;
  private successCount = 0;
  private lastStateChange = Date.now();
  private options: Required<CircuitBreakerOptions>;

  constructor(options: CircuitBreakerOptions = {}) {
    this.options = {
      failureThreshold: 0.5,
      resetTimeoutMs: 30000,
      minimumRequests: 4,
      ...options
    };
  }

  public canExecute(): boolean {
    if (this.state === "OPEN") {
      if (Date.now() - this.lastStateChange > this.options.resetTimeoutMs) {
        this.state = "HALF_OPEN";
        this.lastStateChange = Date.now();
        return true;
      }
      return false;
    }
    return true;
  }

  public recordSuccess(): void {
    if (this.state === "HALF_OPEN") {
      this.state = "CLOSED";
      this.resetCounts();
    } else {
      this.successCount++;
    }
  }

  public recordFailure(): void {
    if (this.state === "HALF_OPEN") {
      this.state = "OPEN";
      this.lastStateChange = Date.now();
    } else {
      this.failureCount++;
      const total = this.failureCount + this.successCount;
      if (total >= this.options.minimumRequests) {
        const failureRate = this.failureCount / total;
        if (failureRate >= this.options.failureThreshold) {
          this.state = "OPEN";
          this.lastStateChange = Date.now();
        }
      }
    }
  }

  private resetCounts(): void {
    this.failureCount = 0;
    this.successCount = 0;
    this.lastStateChange = Date.now();
  }
}

export function resilient<TArgs extends any[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>,
  options: ResilienceOptions = {}
): (...args: TArgs) => Promise<TReturn> {
  const retries = options.retries ?? 3;
  const backoff = options.backoff ?? "exponential";
  const retryDelayMs = options.retryDelayMs ?? 300;
  const timeoutMs = options.timeoutMs ?? 10000;

  const cb = options.circuitBreaker ? new CircuitBreaker(options.circuitBreaker) : null;

  return async (...args: TArgs): Promise<TReturn> => {
    let attempt = 0;

    while (true) {
      if (cb && !cb.canExecute()) {
        throw new CircuitBreakerOpenError();
      }

      try {
        let timer: any;
        const timeoutPromise = new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new TimeoutError(`Operation timed out after ${timeoutMs}ms`)), timeoutMs);
        });

        const executionPromise = fn(...args);
        const result = await Promise.race([executionPromise, timeoutPromise]);
        clearTimeout(timer);

        if (cb) cb.recordSuccess();
        return result as TReturn;
      } catch (err) {
        if (cb) cb.recordFailure();

        attempt++;
        if (attempt > retries) {
          throw err;
        }

        const delay = backoff === "exponential"
          ? retryDelayMs * Math.pow(2, attempt - 1)
          : retryDelayMs * attempt;

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  };
}
