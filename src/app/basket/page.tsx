import { BasketView } from './basket-view';

export const metadata = { title: 'Compare a basket' };

/**
 * A shell only. The basket lives in the query string so it can be shared
 * without an account, and a static export has no server to read one, so the
 * work happens in the client component.
 */
export default function BasketPage() {
  return <BasketView />;
}
