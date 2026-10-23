import { hashToken } from "./store.js";
export class DatabaseRateLimitStore {
  constructor(store, namespace) {
    this.store = store;
    this.namespace = namespace;
    this.prefix = namespace + ":";
    this.localKeys = false;
  }
  init(options) {
    this.windowMs = options.windowMs;
  }
  key(key) {
    return `${this.namespace}:${hashToken(key)}`;
  }
  async increment(key) {
    const time = Date.now(),
      end = time + this.windowMs;
    // Atomic across separate Vercel instances. No process-local counter is relied on.
    const row = await this.store.get(
      `INSERT INTO rate_limits(key,hits,window_end) VALUES(?,1,?)
      ON CONFLICT(key) DO UPDATE SET
      hits=CASE WHEN rate_limits.window_end<=? THEN 1 ELSE rate_limits.hits+1 END,
      window_end=CASE WHEN rate_limits.window_end<=? THEN ? ELSE rate_limits.window_end END
      RETURNING hits,window_end`,
      this.key(key),
      end,
      time,
      time,
      end,
    );
    return { totalHits: row.hits, resetTime: new Date(Number(row.window_end)) };
  }
  async decrement(key) {
    await this.store.run(
      "UPDATE rate_limits SET hits=CASE WHEN hits>0 THEN hits-1 ELSE 0 END WHERE key=?",
      this.key(key),
    );
  }
  async resetKey(key) {
    await this.store.run("DELETE FROM rate_limits WHERE key=?", this.key(key));
  }
}
