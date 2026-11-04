import { formatPence } from '@/lib/money';
import type { DailyPrice, PriceBasis } from '@/lib/types';

const WIDTH = 640;
const HEIGHT = 200;
const PAD_LEFT = 46;
const PAD_BOTTOM = 22;

function valueFor(row: DailyPrice, basis: PriceBasis): number | null {
  return basis === 'shelf' ? row.shelfPence : (row.loyaltyPence ?? row.shelfPence);
}

/**
 * Inline SVG bars from the daily rollup. No chart library and no client JS:
 * the data is readable with scripting off.
 */
export function PriceChart({
  history,
  basis,
  days = 90,
}: {
  history: readonly DailyPrice[];
  basis: PriceBasis;
  days?: number;
}) {
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const rows = history
    .filter((row) => row.day >= cutoff)
    .map((row) => ({ day: row.day, value: valueFor(row, basis) }))
    .filter((row): row is { day: string; value: number } => row.value !== null);

  if (rows.length < 2) {
    return (
      <p className="m-0 rounded-xl border border-line bg-sunk p-4 text-sm text-ink-muted">
        Not enough history yet to draw a chart for this store.
      </p>
    );
  }

  const values = rows.map((row) => row.value);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const top = Math.ceil((max * 1.08) / 50) * 50;
  const bottom = Math.max(0, Math.floor((min * 0.9) / 50) * 50);
  const span = Math.max(1, top - bottom);

  const plotWidth = WIDTH - PAD_LEFT;
  const plotHeight = HEIGHT - PAD_BOTTOM;
  const barWidth = plotWidth / rows.length;

  const ticks = [top, Math.round((top + bottom) / 2), bottom];

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width="100%"
        role="img"
        aria-label={`Price over the last ${days} days: lowest ${formatPence(min)}, highest ${formatPence(max)}`}
        className="block"
      >
        {ticks.map((tick) => {
          const y = plotHeight - ((tick - bottom) / span) * plotHeight;
          return (
            <g key={tick}>
              <line
                x1={PAD_LEFT}
                x2={WIDTH}
                y1={y}
                y2={y}
                stroke="var(--color-line-soft)"
                strokeWidth="1"
              />
              <text
                x={PAD_LEFT - 8}
                y={y + 4}
                textAnchor="end"
                fontSize="11"
                fill="var(--color-ink-faint)"
              >
                {formatPence(tick)}
              </text>
            </g>
          );
        })}

        {rows.map((row, index) => {
          const height = Math.max(2, ((row.value - bottom) / span) * plotHeight);
          const x = PAD_LEFT + index * barWidth;
          const isLowest = row.value === min;
          return (
            <rect
              key={row.day}
              x={x + barWidth * 0.12}
              y={plotHeight - height}
              width={Math.max(1, barWidth * 0.76)}
              height={height}
              rx="1.5"
              fill={isLowest ? 'var(--color-brand)' : '#c3d2cb'}
            >
              <title>{`${row.day}: ${formatPence(row.value)}`}</title>
            </rect>
          );
        })}

        <line
          x1={PAD_LEFT}
          x2={WIDTH}
          y1={plotHeight}
          y2={plotHeight}
          stroke="var(--color-line)"
          strokeWidth="1"
        />
        <text x={PAD_LEFT} y={HEIGHT - 4} fontSize="11" fill="var(--color-ink-faint)">
          {rows[0]?.day}
        </text>
        <text
          x={WIDTH}
          y={HEIGHT - 4}
          fontSize="11"
          textAnchor="end"
          fill="var(--color-ink-faint)"
        >
          {rows[rows.length - 1]?.day}
        </text>
      </svg>
      <figcaption className="sr-only">
        Daily lowest price. The lowest bar in the window is highlighted.
      </figcaption>
    </figure>
  );
}
