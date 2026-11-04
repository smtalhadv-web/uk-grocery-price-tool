import { NextResponse } from 'next/server';
import { config } from '@/lib/config';
import type { StoreSlug } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 300;

const VALID_SLUGS: StoreSlug[] = ['asda', 'morrisons', 'sainsburys', 'tesco'];

function authorised(request: Request): boolean {
  if (!config.cronSecret) return false;
  const header = request.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  // Length-independent comparison is overkill here, but the check must come
  // before any work so an unauthenticated call costs nothing (R9).
  return token.length > 0 && token === config.cronSecret;
}

export async function POST(request: Request) {
  if (!authorised(request)) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }

  if (config.dataSource !== 'db') {
    return NextResponse.json(
      { error: 'DATA_SOURCE is not "db" — there is nowhere to write prices' },
      { status: 409 },
    );
  }

  const url = new URL(request.url);
  const requested = url.searchParams.get('stores');
  const slugs = requested
    ? requested
        .split(',')
        .map((value) => value.trim())
        .filter((value): value is StoreSlug => VALID_SLUGS.includes(value as StoreSlug))
    : VALID_SLUGS;

  if (slugs.length === 0) {
    return NextResponse.json({ error: 'no valid stores requested' }, { status: 400 });
  }

  // Imported here so the route stays loadable without a database configured.
  const { refreshAll } = await import('@/ingest/run');
  const reports = await refreshAll(slugs);

  const anyFailed = reports.some((report) => report.status === 'failed');
  return NextResponse.json(
    { startedAt: new Date().toISOString(), reports },
    { status: anyFailed ? 207 : 200 },
  );
}

export async function GET() {
  return NextResponse.json({ error: 'use POST' }, { status: 405 });
}
