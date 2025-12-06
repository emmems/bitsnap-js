interface CacheEntry<T> {
  value: T;
  expiresAt?: number;
}

export class SimpleInMemoryCache {
  private cache: Map<string, CacheEntry<any>> = new Map();

  /**
   * Set a value in the cache with an optional TTL (time-to-live) in milliseconds
   * @param key - The cache key
   * @param value - The value to cache
   * @param ttlMs - Optional time-to-live in milliseconds
   */
  set<T>(key: string, value: T, ttlMs?: number): void {
    const expiresAt = ttlMs ? Date.now() + ttlMs : undefined;
    this.cache.set(key, { value, expiresAt });
  }

  /**
   * Get a value from the cache
   * @param key - The cache key
   * @returns The cached value or undefined if not found or expired
   */
  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      return undefined;
    }

    // Check if entry has expired
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value as T;
  }

  /**
   * Check if a key exists in the cache and is not expired
   * @param key - The cache key
   * @returns true if the key exists and is valid, false otherwise
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    // Check if entry has expired
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete a value from the cache
   * @param key - The cache key
   * @returns true if the key was deleted, false if it didn't exist
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all entries from the cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get the number of entries in the cache (excluding expired entries)
   * @returns The number of valid entries
   */
  size(): number {
    // Clean up expired entries and return size
    this.cleanup();
    return this.cache.size;
  }

  /**
   * Remove all expired entries from the cache
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt && now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
}
