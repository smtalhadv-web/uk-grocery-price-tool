/**
 * Seeds the stores and the starter catalogue. Safe to run repeatedly:
 * it inserts what is missing and leaves existing rows alone.
 *
 *   DATA_SOURCE=db DATABASE_URL=... npm run db:seed
 */

import { eq } from 'drizzle-orm';
import { db, schema } from '../src/db/client';
import { SEED_PRODUCTS, STORES } from '../src/data/catalogue';

async function main() {
  const database = db();

  for (const store of STORES) {
    const [existing] = await database
      .select({ id: schema.stores.id })
      .from(schema.stores)
      .where(eq(schema.stores.slug, store.slug))
      .limit(1);

    if (existing) continue;

    await database.insert(schema.stores).values({
      slug: store.slug,
      name: store.name,
      loyaltyScheme: store.loyaltyScheme,
      active: true,
    });
    console.log(`store: ${store.name}`);
  }

  let added = 0;
  for (const product of SEED_PRODUCTS) {
    const [existing] = await database
      .select({ id: schema.products.id })
      .from(schema.products)
      .where(eq(schema.products.id, product.id))
      .limit(1);

    if (existing) continue;

    await database.insert(schema.products).values({
      id: product.id,
      ean: product.ean,
      canonicalName: product.name,
      brand: product.brand,
      packLabel: product.packLabel,
      packQty: product.packQty,
      packUnit: product.packUnit,
      category: product.category,
    });
    added += 1;
  }

  // Keep the sequence ahead of the explicit ids we just inserted.
  await database.execute(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (await import('drizzle-orm')).sql`
      SELECT setval(
        pg_get_serial_sequence('products', 'id'),
        GREATEST((SELECT MAX(id) FROM products), 1)
      )
    `,
  );

  console.log(`products added: ${added} (catalogue size ${SEED_PRODUCTS.length})`);
  console.log('Seed complete. Run a refresh to fetch prices.');
  process.exit(0);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
