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
  const shortKey = apiKey.substring(0, 12);

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

    const contentType = res.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');

    if (!res.ok) {
      let bodySnippet = '';

      try {
        bodySnippet = (await res.text()).replace(/\s+/g, ' ').trim().slice(0, 200);
      } catch {
        bodySnippet = '';
      }

      if ((res.status === 403 || res.status === 404) && isJson) {
        try {
          const parsed = bodySnippet ? JSON.parse(bodySnippet) as { valid?: boolean } : undefined;
          if (parsed?.valid === false) {
            return { ok: false, reason: 'invalid_key' };
          }
        } catch {
          // Fall through to service_unavailable if the body is not valid JSON.
        }
      }

      console.error(
        `Key service returned unexpected ${res.status} (${contentType || 'unknown content-type'}) for key ${shortKey}...` +
        (bodySnippet ? ` Body: ${bodySnippet}` : '')
      );
      return { ok: false, reason: 'service_unavailable' };
    }

    if (!isJson) {
      const bodySnippet = (await res.text()).replace(/\s+/g, ' ').trim().slice(0, 200);
      console.error(
        `Key service returned non-JSON success response (${contentType || 'unknown content-type'}) for key ${shortKey}...` +
        (bodySnippet ? ` Body: ${bodySnippet}` : '')
      );
      return { ok: false, reason: 'malformed_response' };
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
      console.error(`Key service returned incomplete credentials for key ${shortKey}...`);
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
      console.error(`Key service request timed out for key ${shortKey}...`);
    } else {
      console.error(`Key service request failed for key ${shortKey}...:`, error);
    }
    return { ok: false, reason: 'service_unavailable' };
  } finally {
    clearTimeout(timeout);
  }
}
