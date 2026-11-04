'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function SearchBox() {
  const router = useRouter();
  const [value, setValue] = useState('');

  return (
    <form
      className="flex max-w-[560px] flex-wrap gap-2.5"
      onSubmit={(event) => {
        event.preventDefault();
        const query = value.trim();
        if (query) router.push(`/search?q=${encodeURIComponent(query)}`);
      }}
    >
      <label htmlFor="product-search" className="sr-only">
        Search for a product
      </label>
      <input
        id="product-search"
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search a product — e.g. semi-skimmed milk"
        className="min-h-12 min-w-0 flex-[999_1_300px] rounded-xl border border-line bg-surface px-4 py-3.5 text-base text-ink placeholder:text-ink-faint"
      />
      <button
        type="submit"
        className="min-h-12 rounded-xl bg-ink px-6 py-3.5 text-base font-semibold text-paper hover:bg-brand-deep"
      >
        Compare
      </button>
    </form>
  );
}
