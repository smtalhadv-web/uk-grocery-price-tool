import type { PackUnit, Store } from '@/lib/types';

export const STORES: Store[] = [
  { id: 1, slug: 'asda', name: 'Asda', loyaltyScheme: null },
  { id: 2, slug: 'morrisons', name: 'Morrisons', loyaltyScheme: 'More Card price' },
  { id: 3, slug: 'sainsburys', name: "Sainsbury's", loyaltyScheme: 'Nectar price' },
  { id: 4, slug: 'tesco', name: 'Tesco', loyaltyScheme: 'Clubcard price' },
];

export const STORE_SLUGS = STORES.map((store) => store.slug);

export function storeName(slug: string): string {
  return STORES.find((store) => store.slug === slug)?.name ?? slug;
}

export interface SeedProduct {
  id: number;
  ean: string | null;
  name: string;
  brand: string | null;
  packLabel: string;
  packQty: number | null;
  packUnit: PackUnit | null;
  category: string;
  /** Rough national price in pence, used as the baseline for seeded history. */
  basePence: number;
}

/**
 * The Phase 1 starter catalogue. Real products, plausible baselines.
 * Live prices replace these entirely once a retailer adapter runs.
 */
export const SEED_PRODUCTS: SeedProduct[] = [
  { id: 1, ean: '5000436589127', name: 'Semi-skimmed milk', brand: null, packLabel: '2 litres', packQty: 2000, packUnit: 'ml', category: 'Dairy', basePence: 155 },
  { id: 2, ean: '5000436589134', name: 'Whole milk', brand: null, packLabel: '2 litres', packQty: 2000, packUnit: 'ml', category: 'Dairy', basePence: 158 },
  { id: 3, ean: '5000157024671', name: 'Baked beans', brand: 'Heinz', packLabel: '4 x 415g', packQty: 1660, packUnit: 'g', category: 'Store cupboard', basePence: 435 },
  { id: 4, ean: '5000157063908', name: 'Tomato ketchup', brand: 'Heinz', packLabel: '700g', packQty: 700, packUnit: 'g', category: 'Store cupboard', basePence: 380 },
  { id: 5, ean: '5740900403994', name: 'Slightly salted butter', brand: 'Lurpak', packLabel: '500g', packQty: 500, packUnit: 'g', category: 'Dairy', basePence: 590 },
  { id: 6, ean: '5010029000016', name: 'Toastie white loaf', brand: 'Warburtons', packLabel: '800g', packQty: 800, packUnit: 'g', category: 'Bakery', basePence: 155 },
  { id: 7, ean: '5000108000012', name: 'Free range eggs', brand: null, packLabel: '12 pack', packQty: 12, packUnit: 'item', category: 'Dairy', basePence: 290 },
  { id: 8, ean: '5000354922305', name: 'Mature cheddar', brand: 'Cathedral City', packLabel: '350g', packQty: 350, packUnit: 'g', category: 'Dairy', basePence: 420 },
  { id: 9, ean: '5011013100248', name: 'British chicken breast fillets', brand: null, packLabel: '650g', packQty: 650, packUnit: 'g', category: 'Meat & fish', basePence: 525 },
  { id: 10, ean: '5000232889720', name: 'Beef mince 5% fat', brand: null, packLabel: '500g', packQty: 500, packUnit: 'g', category: 'Meat & fish', basePence: 425 },
  { id: 11, ean: '5000171011046', name: 'Salmon fillets', brand: null, packLabel: '2 x 120g', packQty: 240, packUnit: 'g', category: 'Meat & fish', basePence: 500 },
  { id: 12, ean: '5000354905209', name: 'Basmati rice', brand: 'Tilda', packLabel: '2kg', packQty: 2000, packUnit: 'g', category: 'Store cupboard', basePence: 850 },
  { id: 13, ean: '8076809513722', name: 'Penne pasta', brand: 'Barilla', packLabel: '500g', packQty: 500, packUnit: 'g', category: 'Store cupboard', basePence: 190 },
  { id: 14, ean: '5000127101001', name: 'Corn flakes', brand: "Kellogg's", packLabel: '720g', packQty: 720, packUnit: 'g', category: 'Breakfast', basePence: 400 },
  { id: 15, ean: '5010029217063', name: 'Weetabix', brand: 'Weetabix', packLabel: '48 pack', packQty: 48, packUnit: 'item', category: 'Breakfast', basePence: 475 },
  { id: 16, ean: '5000147030279', name: 'Non-bio washing pods', brand: 'Fairy', packLabel: '38 washes', packQty: 38, packUnit: 'item', category: 'Household', basePence: 1000 },
  { id: 17, ean: '5410076700011', name: 'Washing-up liquid', brand: 'Fairy', packLabel: '870ml', packQty: 870, packUnit: 'ml', category: 'Household', basePence: 310 },
  { id: 18, ean: '5000204546798', name: 'Toilet tissue', brand: 'Andrex', packLabel: '9 rolls', packQty: 9, packUnit: 'item', category: 'Household', basePence: 650 },
  { id: 19, ean: '5000112637922', name: 'Classic shampoo', brand: 'Head & Shoulders', packLabel: '400ml', packQty: 400, packUnit: 'ml', category: 'Health & beauty', basePence: 420 },
  { id: 20, ean: '5000174645446', name: 'Toothpaste', brand: 'Colgate', packLabel: '125ml', packQty: 125, packUnit: 'ml', category: 'Health & beauty', basePence: 280 },
  { id: 21, ean: '5000295142053', name: 'Bananas', brand: null, packLabel: '5 pack', packQty: 5, packUnit: 'item', category: 'Fruit & veg', basePence: 105 },
  { id: 22, ean: '5000295142060', name: 'Salad tomatoes', brand: null, packLabel: '6 pack', packQty: 6, packUnit: 'item', category: 'Fruit & veg', basePence: 95 },
  { id: 23, ean: '5000295142077', name: 'White potatoes', brand: null, packLabel: '2.5kg', packQty: 2500, packUnit: 'g', category: 'Fruit & veg', basePence: 220 },
  { id: 24, ean: '5000295142084', name: 'Brown onions', brand: null, packLabel: '1kg', packQty: 1000, packUnit: 'g', category: 'Fruit & veg', basePence: 115 },
  { id: 25, ean: '5000295142091', name: 'Carrots', brand: null, packLabel: '1kg', packQty: 1000, packUnit: 'g', category: 'Fruit & veg', basePence: 80 },
  { id: 26, ean: '5000168203706', name: 'Digestive biscuits', brand: "McVitie's", packLabel: '400g', packQty: 400, packUnit: 'g', category: 'Biscuits & snacks', basePence: 195 },
  { id: 27, ean: '5000159461122', name: 'Dairy Milk chocolate', brand: 'Cadbury', packLabel: '180g', packQty: 180, packUnit: 'g', category: 'Biscuits & snacks', basePence: 250 },
  { id: 28, ean: '5000328566498', name: 'Tea bags', brand: 'Yorkshire Tea', packLabel: '160 bags', packQty: 160, packUnit: 'item', category: 'Drinks', basePence: 560 },
  { id: 29, ean: '5000354408113', name: 'Instant coffee', brand: 'Nescafé', packLabel: '200g', packQty: 200, packUnit: 'g', category: 'Drinks', basePence: 750 },
  { id: 30, ean: '5449000000996', name: 'Cola', brand: 'Coca-Cola', packLabel: '6 x 330ml', packQty: 1980, packUnit: 'ml', category: 'Drinks', basePence: 420 },
  { id: 31, ean: '5000436589141', name: 'Orange juice, smooth', brand: 'Tropicana', packLabel: '850ml', packQty: 850, packUnit: 'ml', category: 'Drinks', basePence: 330 },
  { id: 32, ean: '5000436589158', name: 'Greek style yogurt', brand: 'Fage', packLabel: '500g', packQty: 500, packUnit: 'g', category: 'Dairy', basePence: 275 },
  { id: 33, ean: '5000436589165', name: 'Olive oil', brand: 'Filippo Berio', packLabel: '500ml', packQty: 500, packUnit: 'ml', category: 'Store cupboard', basePence: 700 },
  { id: 34, ean: '5000436589172', name: 'Chopped tomatoes', brand: 'Napolina', packLabel: '4 x 400g', packQty: 1600, packUnit: 'g', category: 'Store cupboard', basePence: 340 },
  { id: 35, ean: '5000436589189', name: 'Frozen garden peas', brand: 'Birds Eye', packLabel: '800g', packQty: 800, packUnit: 'g', category: 'Frozen', basePence: 265 },
  { id: 36, ean: '5000436589196', name: 'Frozen chips', brand: 'McCain', packLabel: '1.5kg', packQty: 1500, packUnit: 'g', category: 'Frozen', basePence: 390 },
  { id: 37, ean: '5000436589202', name: 'Fish fingers', brand: 'Birds Eye', packLabel: '12 pack', packQty: 12, packUnit: 'item', category: 'Frozen', basePence: 340 },
  { id: 38, ean: '5000436589219', name: 'Kitchen roll', brand: 'Plenty', packLabel: '4 rolls', packQty: 4, packUnit: 'item', category: 'Household', basePence: 475 },
  { id: 39, ean: '5000436589226', name: 'Bin liners, tie handle', brand: null, packLabel: '40 pack', packQty: 40, packUnit: 'item', category: 'Household', basePence: 220 },
  { id: 40, ean: '5000436589233', name: 'Nappies size 4', brand: 'Pampers', packLabel: '46 pack', packQty: 46, packUnit: 'item', category: 'Baby', basePence: 950 },
];

/** Ready-made starter baskets (PRD F5). Product ids reference SEED_PRODUCTS. */
export const STARTER_BASKETS = [
  {
    id: 'family-of-four',
    name: 'Family of four',
    blurb: 'A typical weekly shop for two adults and two children.',
    items: [
      { productId: 1, qty: 2 }, { productId: 3, qty: 1 }, { productId: 5, qty: 1 },
      { productId: 6, qty: 2 }, { productId: 7, qty: 1 }, { productId: 8, qty: 1 },
      { productId: 9, qty: 1 }, { productId: 10, qty: 1 }, { productId: 12, qty: 1 },
      { productId: 14, qty: 1 }, { productId: 15, qty: 1 }, { productId: 16, qty: 1 },
      { productId: 18, qty: 1 }, { productId: 21, qty: 2 }, { productId: 23, qty: 1 },
      { productId: 25, qty: 1 }, { productId: 28, qty: 1 }, { productId: 36, qty: 1 },
    ],
  },
  {
    id: 'couple',
    name: 'Couple, no kids',
    blurb: 'A smaller weekly shop, heavier on fresh food.',
    items: [
      { productId: 1, qty: 1 }, { productId: 6, qty: 1 }, { productId: 7, qty: 1 },
      { productId: 8, qty: 1 }, { productId: 11, qty: 1 }, { productId: 13, qty: 1 },
      { productId: 22, qty: 1 }, { productId: 24, qty: 1 }, { productId: 25, qty: 1 },
      { productId: 29, qty: 1 }, { productId: 32, qty: 1 }, { productId: 33, qty: 1 },
    ],
  },
  {
    id: 'single',
    name: 'Student or single',
    blurb: 'Cupboard staples and a few fresh items.',
    items: [
      { productId: 1, qty: 1 }, { productId: 6, qty: 1 }, { productId: 13, qty: 1 },
      { productId: 14, qty: 1 }, { productId: 21, qty: 1 }, { productId: 26, qty: 1 },
      { productId: 34, qty: 1 }, { productId: 35, qty: 1 },
    ],
  },
] as const;
