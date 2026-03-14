/**
 * MCP Key Service client for credential resolution.
 *
 * When KEY_SERVICE_URL and KEY_SERVICE_TOKEN are configured, user API keys
 * (usr_XXXXXXXX) are resolved via the external key service which returns
 * the user's Nextcloud credentials.
 */

export interface ResolvedCredentials {
  host: string;
  username: string;
  password: string;
}

export type ResolveResult =
  | { ok: true; credentials: ResolvedCredentials }
  | { ok: false; reason: 'invalid_key' | 'service_unavailable' | 'malformed_response' };

const KEY_SERVICE_URL = process.env.KEY_SERVICE_URL || '';
const KEY_SERVICE_TOKEN = process.env.KEY_SERVICE_TOKEN || '';

const CACHE_TTL_MS = 60_000; // 60 seconds
const CLEANUP_INTERVAL_MS = 5 * 60_000; // 5 minutes
const REQUEST_TIMEOUT_MS = 5_000; // 5 seconds

// Cache: only successful resolutions are cached
interface CacheEntry {
  credentials: ResolvedCredentials;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

// In-flight promise deduplication
const pending = new Map<string, Promise<ResolveResult>>();

// Periodic cache cleanup to prevent unbounded growth
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (now >= entry.expiresAt) {
      cache.delete(key);
    }
  }
}, CLEANUP_INTERVAL_MS);

/**
 * Returns true if the key service is configured and should be used.
 */
export function isKeyServiceEnabled(): boolean {
  return Boolean(KEY_SERVICE_URL && KEY_SERVICE_TOKEN);
}

/**
 * Resolve a user API key via the MCP Key Service.
 *
 * Returns typed result so the caller can distinguish between
 * "invalid key" (403) and "service down" (503).
 */
export async function resolveKeyCredentials(apiKey: string): Promise<ResolveResult> {
  // Check cache first
  const cached = cache.get(apiKey);
  if (cached && Date.now() < cached.expiresAt) {
    return { ok: true, credentials: cached.credentials };
  }

  // Deduplicate concurrent requests for the same key
  const inflight = pending.get(apiKey);
  if (inflight) {
    return inflight;
  }

  const promise = doResolve(apiKey);
  pending.set(apiKey, promise);

  try {
    return await promise;
  } finally {
    pending.delete(apiKey);
  }
}

async function doResolve(apiKey: string): Promise<ResolveResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(KEY_SERVICE_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${KEY_SERVICE_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ key: apiKey }),
      signal: controller.signal,
    });

    if (res.status === 404 || res.status === 403) {
      return { ok: false, reason: 'invalid_key' };
    }

    if (!res.ok) {
      console.error(`Key service returned ${res.status} for key ${apiKey.substring(0, 12)}...`);
      return { ok: false, reason: 'service_unavailable' };
    }

    const data = await res.json() as {
      valid?: boolean;
      credentials?: Record<string, string>;
    };

    if (!data.valid) {
      return { ok: false, reason: 'invalid_key' };
    }

    const creds = data.credentials;
    if (!creds?.nextcloud_host || !creds?.nextcloud_username || !creds?.nextcloud_password) {
      console.error(`Key service returned incomplete credentials for key ${apiKey.substring(0, 12)}...`);
      return { ok: false, reason: 'malformed_response' };
    }

    const credentials: ResolvedCredentials = {
      host: creds.nextcloud_host,
      username: creds.nextcloud_username,
      password: creds.nextcloud_password,
    };

    // Cache successful resolution
    cache.set(apiKey, {
      credentials,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return { ok: true, credentials };
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error(`Key service request timed out for key ${apiKey.substring(0, 12)}...`);
    } else {
      console.error(`Key service request failed for key ${apiKey.substring(0, 12)}...:`, error);
    }
    return { ok: false, reason: 'service_unavailable' };
  } finally {
    clearTimeout(timeout);
  }
}
