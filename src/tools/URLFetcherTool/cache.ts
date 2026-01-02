interface CacheEntry {
  content: string
  timestamp: number
}

class URLCache {
  private cache = new Map<string, CacheEntry>()
  private readonly CACHE_DURATION = 15 * 60 * 1000 // 15 minutes in milliseconds

  set(url: string, content: string): void {
    this.cache.set(url, {
      content,
      timestamp: Date.now()
    })
  }

  get(url: string): string | null {
    const entry = this.cache.get(url)
    if (!entry) {
      return null
    }

    // Check if entry has expired
    if (Date.now() - entry.timestamp > this.CACHE_DURATION) {
      this.cache.delete(url)
      return null
    }

    return entry.content
  }

  clear(): void {
    this.cache.clear()
  }

  // Clean expired entries
  private cleanExpired(): void {
    const now = Date.now()
    for (const [url, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.CACHE_DURATION) {
        this.cache.delete(url)
      }
    }
  }

  // Auto-clean expired entries every 5 minutes
  constructor() {
    setInterval(() => {
      this.cleanExpired()
    }, 5 * 60 * 1000) // 5 minutes
  }
}

// Export singleton instance
export const urlCache = new URLCache()