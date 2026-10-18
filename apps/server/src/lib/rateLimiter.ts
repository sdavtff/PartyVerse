/** Token bucket simples, em memória, por chave. */
export class RateLimiter {
  private buckets = new Map<string, { tokens: number; last: number }>();
  constructor(
    private capacity: number,
    private refillPerSec: number,
    private now = () => Date.now(),
  ) {}

  take(key: string): boolean {
    const t = this.now();
    const b = this.buckets.get(key) ?? { tokens: this.capacity, last: t };
    b.tokens = Math.min(this.capacity, b.tokens + ((t - b.last) / 1000) * this.refillPerSec);
    b.last = t;
    if (b.tokens < 1) {
      this.buckets.set(key, b);
      return false;
    }
    b.tokens -= 1;
    this.buckets.set(key, b);
    return true;
  }

  forget(prefix: string) {
    for (const k of this.buckets.keys()) if (k.startsWith(prefix)) this.buckets.delete(k);
  }
}
