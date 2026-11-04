import Link from 'next/link';

const NAV = [
  { href: '/', label: 'Deals' },
  { href: '/basket', label: 'Compare a basket' },
  { href: '/admin', label: 'Data' },
] as const;

export function SiteHeader() {
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-[1120px] flex-wrap items-center gap-5 px-5 py-4 sm:px-8">
        <Link
          href="/"
          className="display text-[22px] font-bold text-ink no-underline"
        >
          Trolleywise
        </Link>

        <nav aria-label="Main" className="flex flex-1 basis-[280px] gap-5 text-[15px]">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-ink-muted no-underline hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <Link
          href="/basket?preset=family-of-four"
          className="inline-flex min-h-11 items-center rounded-lg bg-brand px-4 py-3 text-sm font-semibold text-white no-underline hover:bg-brand-deep"
        >
          Build my basket
        </Link>
      </div>
    </header>
  );
}
