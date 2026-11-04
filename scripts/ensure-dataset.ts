/**
 * Runs before every build.
 *
 * If no refresh has published a dataset yet, this writes one from the
 * fixtures so the site is fully usable — including the basket and search
 * pages, which fetch the JSON in the browser and would otherwise come up
 * empty.
 *
 * The dataset it writes is flagged `sample: true`, which makes the Data page
 * say so in plain words. Sample prices must never be able to pass for
 * observed ones (R2).
 *
 * A real dataset is never overwritten.
 */

import { datasetExists, writeMeta, writePrices, writeProducts } from '../src/data/json-store';
import { fixtures } from '../src/data/fixtures';
import type { PricesFile } from '../src/data/dataset';

async function main() {
  if (datasetExists()) {
    console.log('public/data already has a dataset — leaving it alone.');
    return;
  }

  const data = fixtures();

  await writeProducts(data.products);

  const prices: PricesFile = {};
  for (const [productId, rows] of data.pricesByProduct) {
    prices[String(productId)] = rows;
  }
  await writePrices(prices);

  for (const product of data.products) {
    const history = data.historyByProduct.get(product.id) ?? [];
    if (history.length === 0) continue;
    // Write the generated series straight out rather than appending today's.
    const { writeFile, mkdir } = await import('node:fs/promises');
    const path = await import('node:path');
    const target = path.join(process.cwd(), 'public/data/history', `${product.id}.json`);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, `${JSON.stringify(history, null, 1)}\n`, 'utf8');
  }

  await writeMeta({
    generatedAt: new Date().toISOString(),
    runs: [],
    productCount: data.products.length,
    sample: true,
  });

  console.log(
    `Wrote a SAMPLE dataset for ${data.products.length} products. ` +
      'Run `npm run refresh:static` to replace it with observed prices.',
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
