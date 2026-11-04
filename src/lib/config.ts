/**
 * Runtime configuration. Every secret comes from the environment (R9).
 */

export type DataSource = 'fixtures' | 'db';

function readDataSource(): DataSource {
  const raw = process.env.DATA_SOURCE?.trim().toLowerCase();
  if (raw === 'db') return 'db';
  if (raw === 'fixtures' || raw === undefined || raw === '') return 'fixtures';
  throw new Error(`DATA_SOURCE must be "fixtures" or "db", got "${raw}"`);
}

export const config = {
  /** Where read queries are served from. Defaults to fixtures so the app runs with no DB. */
  dataSource: readDataSource(),

  /** Postgres connection string. Required only when dataSource === 'db'. */
  databaseUrl: process.env.DATABASE_URL ?? '',

  /** Shared secret guarding every job route. */
  cronSecret: process.env.CRON_SECRET ?? '',

  /** Contact URL sent in the fetcher User-Agent (R6). */
  fetchContactUrl: process.env.FETCH_CONTACT_URL ?? 'https://example.invalid/contact',

  /** Per-host concurrent requests when fetching a retailer (R6). */
  fetchConcurrency: Number(process.env.FETCH_CONCURRENCY ?? 2),

  /** Milliseconds of randomised delay between requests to one host (R6). */
  fetchDelayMs: Number(process.env.FETCH_DELAY_MS ?? 900),

  /** Minimum score (0-1) for a name-based cross-store match to be accepted (R5). */
  matchConfidenceFloor: Number(process.env.MATCH_CONFIDENCE_FLOOR ?? 0.86),

  /** A price older than this is rendered as stale (R2). */
  staleAfterHours: Number(process.env.STALE_AFTER_HOURS ?? 36),
} as const;

export function requireDatabaseUrl(): string {
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is not set but DATA_SOURCE=db');
  }
  return config.databaseUrl;
}
