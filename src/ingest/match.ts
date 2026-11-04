import { config } from '@/lib/config';
import type { PackUnit } from '@/lib/types';
import { normaliseEan, normaliseTitle } from './normalise';

export interface MatchCandidate {
  productId: number;
  ean: string | null;
  name: string;
  brand: string | null;
  packQty: number | null;
  packUnit: PackUnit | null;
}

export interface MatchInput {
  ean: string | null;
  title: string;
  brand: string | null;
  packQty: number | null;
  packUnit: PackUnit | null;
}

export interface MatchResult {
  productId: number | null;
  method: 'ean' | 'name' | null;
  score: number;
}

/** Crude singularisation so "beans" and "bean" are the same token. */
function stem(token: string): string {
  if (token.length > 3 && token.endsWith('ies')) return `${token.slice(0, -3)}y`;
  if (token.length > 3 && token.endsWith('es')) return token.slice(0, -2);
  if (token.length > 2 && token.endsWith('s')) return token.slice(0, -1);
  return token;
}

function tokens(text: string): Set<string> {
  return new Set(text.split(' ').filter(Boolean).map(stem));
}

/**
 * How well a catalogue entry is covered by a retailer's title.
 *
 * Retailers pad titles with description ("in Tomato Sauce"), so a symmetric
 * measure punishes a correct match for the retailer being wordy. What matters
 * is whether every word of our catalogue entry appears in theirs; the extra
 * words only shade the score down a little.
 */
export function similarity(catalogue: string, retailer: string): number {
  const a = tokens(catalogue);
  const b = tokens(retailer);
  if (a.size === 0 || b.size === 0) return 0;

  let shared = 0;
  for (const token of a) if (b.has(token)) shared += 1;

  const coverage = shared / a.size;
  const precision = shared / b.size;
  return coverage * (0.8 + 0.2 * precision);
}

/** Two packs match only if the size agrees within 2% — 400g is not 500g. */
function packAgrees(a: MatchInput, b: MatchCandidate): boolean {
  if (a.packQty === null || b.packQty === null) return false;
  if (a.packUnit !== b.packUnit) return false;
  const ratio = a.packQty / b.packQty;
  return ratio > 0.98 && ratio < 1.02;
}

/**
 * EAN first; a name match must clear the confidence floor and agree on pack
 * size. Below the floor the caller parks the row for review rather than
 * guessing, because a wrong match shows the user a price for the wrong
 * product (R5).
 */
export function matchProduct(
  input: MatchInput,
  candidates: readonly MatchCandidate[],
): MatchResult {
  const inputEan = normaliseEan(input.ean);
  if (inputEan) {
    const exact = candidates.find((candidate) => normaliseEan(candidate.ean) === inputEan);
    if (exact) return { productId: exact.productId, method: 'ean', score: 1 };
  }

  const needle = normaliseTitle(
    input.brand ? `${input.brand} ${input.title}` : input.title,
  );
  if (!needle) return { productId: null, method: null, score: 0 };

  let bestId: number | null = null;
  let bestScore = 0;

  for (const candidate of candidates) {
    if (!packAgrees(input, candidate)) continue;
    const hay = normaliseTitle(
      candidate.brand ? `${candidate.brand} ${candidate.name}` : candidate.name,
    );
    // The catalogue entry is the thing being covered, so it goes first.
    const score = similarity(hay, needle);
    if (score > bestScore) {
      bestScore = score;
      bestId = candidate.productId;
    }
  }

  if (bestId !== null && bestScore >= config.matchConfidenceFloor) {
    return { productId: bestId, method: 'name', score: bestScore };
  }

  return { productId: null, method: null, score: bestScore };
}
