/** Token bucket simples, em memória, por chave. */
export class RateLimiter {
    capacity;
    refillPerSec;
    now;
    buckets = new Map();
    constructor(capacity, refillPerSec, now = () => Date.now()) {
        this.capacity = capacity;
        this.refillPerSec = refillPerSec;
        this.now = now;
    }
    take(key) {
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
    forget(prefix) {
        for (const k of this.buckets.keys())
            if (k.startsWith(prefix))
                this.buckets.delete(k);
    }
}
