/**
 * Runs a refresh from the command line, the same code path the cron route uses.
 *
 *   DATA_SOURCE=db DATABASE_URL=... npm run refresh
 *   DATA_SOURCE=db DATABASE_URL=... npm run refresh -- asda,tesco
 */

import { refreshAll } from '../src/ingest/run';
import type { StoreSlug } from '../src/lib/types';

const VALID: StoreSlug[] = ['asda', 'morrisons', 'sainsburys', 'tesco'];

async function main() {
  const arg = process.argv[2];
  const slugs = arg
    ? arg
        .split(',')
        .map((value) => value.trim())
        .filter((value): value is StoreSlug => VALID.includes(value as StoreSlug))
    : VALID;

  if (slugs.length === 0) {
    console.error(`No valid store given. Choose from: ${VALID.join(', ')}`);
    process.exit(1);
  }

  const reports = await refreshAll(slugs);

  for (const report of reports) {
    console.log(
      [
        report.storeSlug.padEnd(12),
        report.status.padEnd(8),
        `fetched ${report.fetched}`.padEnd(14),
        `parsed ${report.parsed}`.padEnd(13),
        `matched ${report.matched}`.padEnd(14),
        `unmatched ${report.unmatched}`.padEnd(16),
        report.note ?? '',
      ].join(' '),
    );
  }

  const failed = reports.filter((report) => report.status === 'failed');
  process.exit(failed.length === reports.length ? 1 : 0);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
