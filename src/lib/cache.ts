/**
 * Client-side caching system for experiment data.
 * This helps prevent timeouts by storing data locally.
 */

// Basic type for cache entries
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  lastUpdated: string;
}

// Type for the cache storage
interface CacheStorage {
  [key: string]: CacheEntry<unknown>;
}

// Constants
const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes default TTL
const EXPERIMENT_DATA_TTL_MS = 30 * 60 * 1000; // 30 minutes for experiment data
const STORAGE_KEY = 'lablab_experiment_cache';

// Initialize cache from localStorage if available
const initializeCache = (): CacheStorage => {
  if (typeof window === 'undefined') return {}; // SSR check
  
  try {
    const storedCache = localStorage.getItem(STORAGE_KEY);
    if (storedCache) {
      return JSON.parse(storedCache);
    }
  } catch (error) {
    console.warn('Failed to load cache from localStorage:', error);
  }
  
  return {};
};

// Cache singleton instance
let _cache: CacheStorage = {};
let _isInitialized = false;

// Initialize once on first use
const ensureInitialized = () => {
  if (!_isInitialized) {
    _cache = initializeCache();
    _isInitialized = true;
  }
};

// Persist cache to localStorage
const persistCache = () => {
  if (typeof window === 'undefined') return; // SSR check
  
  try {
    // Clean expired items before persisting
    cleanExpiredItems();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(_cache));
  } catch (error) {
    console.warn('Failed to persist cache to localStorage:', error);
  }
};

// Clean expired items from cache
const cleanExpiredItems = () => {
  const now = Date.now();
  let hasExpired = false;
  
  Object.keys(_cache).forEach(key => {
    if (_cache[key].expiresAt < now) {
      delete _cache[key];
      hasExpired = true;
    }
  });
  
  return hasExpired;
};

/**
 * Set an item in the cache
 */
export function set<T>(key: string, data: T, ttlMs: number = DEFAULT_TTL_MS): void {
  ensureInitialized();
  
  _cache[key] = {
    data,
    expiresAt: Date.now() + ttlMs,
    lastUpdated: new Date().toISOString()
  };
  
  // Debounced persistence
  setTimeout(() => persistCache(), 100);
}

/**
 * Get an item from cache. Returns null if expired or not found.
 */
export function get<T>(key: string): T | null {
  ensureInitialized();
  
  const entry = _cache[key] as CacheEntry<T> | undefined;
  if (!entry) return null;
  
  // Check if expired
  if (entry.expiresAt < Date.now()) {
    delete _cache[key];
    persistCache();
    return null;
  }
  
  return entry.data;
}

/**
 * Check if a key exists and is not expired
 */
export function has(key: string): boolean {
  ensureInitialized();
  
  const entry = _cache[key];
  if (!entry) return false;
  
  if (entry.expiresAt < Date.now()) {
    delete _cache[key];
    persistCache();
    return false;
  }
  
  return true;
}

/**
 * Remove an item from the cache
 */
export function remove(key: string): void {
  ensureInitialized();
  
  delete _cache[key];
  persistCache();
}

/**
 * Clear the entire cache
 */
export function clear(): void {
  _cache = {};
  persistCache();
}

/**
 * Get all valid cache keys (non-expired)
 */
export function keys(): string[] {
  ensureInitialized();
  cleanExpiredItems();
  
  return Object.keys(_cache);
}

/**
 * Get cache stats - useful for debugging
 */
export function stats(): { size: number; keys: string[] } {
  ensureInitialized();
  cleanExpiredItems();
  
  return {
    size: Object.keys(_cache).length,
    keys: Object.keys(_cache)
  };
}

/**
 * Fetch with caching - combines fetch with the cache
 * @param url The URL to fetch
 * @param options Fetch options
 * @param cacheKey Optional custom cache key (defaults to URL)
 * @param ttlMs Cache TTL in milliseconds
 */
export async function cachedFetch<T>(
  url: string,
  options: RequestInit = {},
  cacheKey?: string,
  ttlMs: number = DEFAULT_TTL_MS,
  bypassCache = false
): Promise<T> {
  const key = cacheKey || `fetch:${url}`;
  
  // Try to get from cache first, unless bypassCache is true
  if (!bypassCache) {
    const cachedData = get<T>(key);
    if (cachedData) {
      return cachedData;
    }
  }
  
  // If not in cache or bypass requested, fetch it
  try {
    const response = await fetch(url, options);
    
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Cache the successful result
    set<T>(key, data, ttlMs);
    
    return data;
  } catch (error) {
    // Check one more time for cached data (in case of network error)
    const cachedData = get<T>(key);
    if (cachedData) {
      return cachedData;
    }
    
    throw error;
  }
}

/**
 * Special method for caching experiment data with prefetching of related data
 */
export async function cacheExperimentData(
  experimentId: string,
  forceFresh = false
): Promise<{
  experiment: Record<string, unknown>;
  success: boolean;
  message?: string;
}> {
  const cacheKey = `experiment:${experimentId}`;
  
  // Check cache first unless forcing fresh data
  if (!forceFresh) {
    const cachedData = get<Record<string, unknown>>(cacheKey);
    if (cachedData) {
      return { experiment: cachedData, success: true };
    }
  }
  
  try {
    // Add cache busting parameter
    const cacheBuster = Date.now();
    const url = `/api/experiments/${experimentId}?preview=true&t=${cacheBuster}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
    }
    
    const experimentData = await response.json();
    
    // Store in cache with long TTL
    set(cacheKey, experimentData, EXPERIMENT_DATA_TTL_MS);
    
    // Background prefetch for scenarios if they exist
    if (experimentData.stages && Array.isArray(experimentData.stages)) {
      for (const stage of experimentData.stages) {
        if (stage.type === 'scenario' && stage.scenarioId) {
          // Prefetch scenario data in the background
          setTimeout(() => {
            prefetchScenarioData(stage.scenarioId);
          }, 200); // Small delay to prioritize main experiment data
        }
      }
    }
    
    return { experiment: experimentData, success: true };
  } catch (error) {
    console.error('Failed to fetch experiment data:', error);
    
    // Try one more time from cache
    const cachedData = get<Record<string, unknown>>(cacheKey);
    if (cachedData) {
      return { 
        experiment: cachedData, 
        success: true,
        message: 'Using cached data due to fetch error'
      };
    }
    
    return { 
      experiment: {}, 
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Prefetch scenario data for faster loading during the experiment
 */
async function prefetchScenarioData(scenarioId: string): Promise<void> {
  const cacheKey = `scenario:${scenarioId}`;
  
  // Skip if already cached
  if (has(cacheKey)) return;
  
  try {
    const cacheBuster = Date.now();
    const url = `/api/scenarios/${scenarioId}?preview=true&t=${cacheBuster}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }
    
    const data = await response.json();
    
    // Cache the scenario data
    set(cacheKey, data, EXPERIMENT_DATA_TTL_MS);
    
    // If the scenario has a wallet, prefetch that too
    if (data.walletId) {
      prefetchWalletData(data.walletId);
    }
    
    console.log(`Prefetched scenario data for: ${scenarioId}`);
  } catch (error) {
    console.warn(`Failed to prefetch scenario data for ${scenarioId}:`, error);
  }
}

/**
 * Prefetch wallet data for scenarios
 */
async function prefetchWalletData(walletId: string): Promise<void> {
  const cacheKey = `wallet:${walletId}`;
  
  // Skip if already cached
  if (has(cacheKey)) return;
  
  try {
    const cacheBuster = Date.now();
    const url = `/api/wallets/${walletId}/assets?preview=true&t=${cacheBuster}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }
    
    const data = await response.json();
    
    // Cache the wallet data
    set(cacheKey, data, EXPERIMENT_DATA_TTL_MS);
    
    console.log(`Prefetched wallet data for: ${walletId}`);
  } catch (error) {
    console.warn(`Failed to prefetch wallet data for ${walletId}:`, error);
  }
}

/**
 * Get scenario data with caching
 */
export async function getCachedScenarioData(
  scenarioId: string,
  forceFresh = false
): Promise<{
  scenario: Record<string, unknown>;
  success: boolean;
  message?: string;
}> {
  const cacheKey = `scenario:${scenarioId}`;
  
  // Try cache first unless forcing fresh data
  if (!forceFresh) {
    const cachedData = get<Record<string, unknown>>(cacheKey);
    if (cachedData) {
      return { scenario: cachedData, success: true };
    }
  }
  
  try {
    const cacheBuster = Date.now();
    const url = `/api/scenarios/${scenarioId}?preview=true&t=${cacheBuster}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }
    
    const data = await response.json();
    
    // Cache the scenario data
    set(cacheKey, data, EXPERIMENT_DATA_TTL_MS);
    
    return { scenario: data, success: true };
  } catch (error) {
    console.error(`Failed to fetch scenario data for ${scenarioId}:`, error);
    
    // Try from cache again
    const cachedData = get<Record<string, unknown>>(cacheKey);
    if (cachedData) {
      return { 
        scenario: cachedData, 
        success: true,
        message: 'Using cached data due to fetch error'
      };
    }
    
    return { 
      scenario: {}, 
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get wallet assets data with caching
 */
export async function getCachedWalletAssets(
  walletId: string,
  forceFresh = false
): Promise<{
  assets: Array<Record<string, unknown>>;
  success: boolean;
  message?: string;
}> {
  const cacheKey = `wallet:${walletId}`;
  
  // Try cache first unless forcing fresh data
  if (!forceFresh) {
    const cachedData = get<Array<Record<string, unknown>>>(cacheKey);
    if (cachedData) {
      return { assets: cachedData, success: true };
    }
  }
  
  try {
    const cacheBuster = Date.now();
    const url = `/api/wallets/${walletId}/assets?preview=true&t=${cacheBuster}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }
    
    let data = await response.json();
    
    // Normalize data format (handle both array and {assets: array} formats)
    if (!Array.isArray(data) && data.assets && Array.isArray(data.assets)) {
      data = data.assets;
    }
    
    // Ensure data is an array
    const assetsArray = Array.isArray(data) ? data : [];
    
    // Cache the wallet data
    set(cacheKey, assetsArray, EXPERIMENT_DATA_TTL_MS);
    
    return { assets: assetsArray, success: true };
  } catch (error) {
    console.error(`Failed to fetch wallet assets for ${walletId}:`, error);
    
    // Try from cache again
    const cachedData = get<Array<Record<string, unknown>>>(cacheKey);
    if (cachedData) {
      return { 
        assets: cachedData, 
        success: true,
        message: 'Using cached data due to fetch error'
      };
    }
    
    // Create fallback data
    const fallbackAssets = [
      {
        id: `${walletId}-fallback-asset1`,
        symbol: 'BTC',
        name: 'Bitcoin',
        amount: 0.5,
        initialAmount: 0.5
      },
      {
        id: `${walletId}-fallback-asset2`,
        symbol: 'AAPL',
        name: 'Apple Inc.',
        amount: 10,
        initialAmount: 10
      },
      {
        id: `${walletId}-fallback-asset3`,
        symbol: 'ETH',
        name: 'Ethereum',
        amount: 5,
        initialAmount: 5
      }
    ];
    
    // Cache the fallback data too
    set(cacheKey, fallbackAssets, EXPERIMENT_DATA_TTL_MS);
    
    return { 
      assets: fallbackAssets, 
      success: false,
      message: 'Using fallback data due to fetch error'
    };
  }
}