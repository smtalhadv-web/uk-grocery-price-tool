import { SearchView } from './search-view';

export const metadata = { title: 'Search' };

/** A shell: the query string is only readable in the browser on a static site. */
export default function SearchPage() {
  return <SearchView />;
}
