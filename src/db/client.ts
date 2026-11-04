import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { requireDatabaseUrl } from '@/lib/config';
import * as schema from './schema';

let client: ReturnType<typeof postgres> | null = null;
let database: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function db() {
  if (!database) {
    client = postgres(requireDatabaseUrl(), { max: 5, prepare: false });
    database = drizzle(client, { schema });
  }
  return database;
}

export { schema };
