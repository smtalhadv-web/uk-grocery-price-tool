import { config } from '@/lib/config';
import type { StoreSlug } from '@/lib/types';
import { AdapterBlockedError } from './types';

/**
 * A polite HTTP client (R6): one small concurrency budget per host, a
 * randomised pause between requests, exponential backoff on 429 and 5xx,
 * and an honest User-Agent with a contact URL.
 *
 * It never tries to defeat a bot challenge. A 403 is taken at face value:
 * the adapter raises AdapterBlockedError, the runner marks that retailer
 * stale for the day and carries on with the others (R7).
 */

const queues = new Map<string, Promise<unknown>>();

function userAgent(): string {
  return `TrolleywiseBot/0.1 (+${config.fetchContactUrl})`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** Jittered delay so requests do not arrive on a metronome. */
function politeDelay(): Promise<void> {
  const base = config.fetchDelayMs;
  return sleep(base + Math.floor(Math.random() * base));
}

/** Serialises per host so one retailer never sees a burst from us. */
async function withHostQueue<T>(host: string, task: () => Promise<T>): Promise<T> {
  const previous = queues.get(host) ?? Promise.resolve();
  const next = previous.then(task, task);
  queues.set(
    host,
    next.then(
      () => undefined,
      () => undefined,
    ),
  );
  return next;
}

export interface FetchJsonOptions {
  slug: StoreSlug;
  url: string;
  method?: 'GET' | 'POST';
  body?: string;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  maxAttempts?: number;
}

export async function fetchJson<T = unknown>(options: FetchJsonOptions): Promise<T> {
  const { slug, url, method = 'GET', body, headers = {}, signal, maxAttempts = 3 } = options;
  const host = new URL(url).host;

  return withHostQueue(host, async () => {
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      await politeDelay();

      try {
        const response = await fetch(url, {
          signal,
          method,
          body,
          headers: {
            accept: 'application/json',
            'accept-language': 'en-GB,en;q=0.9',
            'user-agent': userAgent(),
            ...headers,
          },
        });

        if (response.status === 403 || response.status === 401) {
          // Taken at face value — we do not try to work around it (R6).
          throw new AdapterBlockedError(slug, response.status);
        }

        if (response.status === 429 || response.status >= 500) {
          const retryAfter = Number(response.headers.get('retry-after'));
          const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
            ? retryAfter * 1000
            : 2 ** attempt * 1000;
          lastError = new Error(`${slug}: HTTP ${response.status}`);
          if (attempt < maxAttempts) {
            await sleep(waitMs);
            continue;
          }
          throw lastError;
        }

        if (!response.ok) {
          throw new Error(`${slug}: HTTP ${response.status} for ${url}`);
        }

        return (await response.json()) as T;
      } catch (error) {
        if (error instanceof AdapterBlockedError) throw error;
        lastError = error;
        if (attempt >= maxAttempts) break;
        await sleep(2 ** attempt * 1000);
      }
    }

    throw lastError instanceof Error ? lastError : new Error(`${slug}: request failed`);
  });
}
