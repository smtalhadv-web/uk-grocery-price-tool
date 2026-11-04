import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/* ---------------------------------------------------------------- catalogue */

export const stores = pgTable('stores', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  /** Null when the retailer runs no loyalty price layer. */
  loyaltyScheme: text('loyalty_scheme'),
  active: boolean('active').notNull().default(true),
});

export const products = pgTable(
  'products',
  {
    id: serial('id').primaryKey(),
    /** The matching spine. Null only for own-brand lines with no shared barcode. */
    ean: text('ean'),
    canonicalName: text('canonical_name').notNull(),
    brand: text('brand'),
    packLabel: text('pack_label').notNull(),
    packQty: real('pack_qty'),
    packUnit: text('pack_unit', { enum: ['g', 'ml', 'item'] }),
    category: text('category').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    eanIdx: uniqueIndex('products_ean_idx').on(table.ean),
    categoryIdx: index('products_category_idx').on(table.category),
  }),
);

/** One retailer's identity for one product. */
export const storeProducts = pgTable(
  'store_products',
  {
    id: serial('id').primaryKey(),
    storeId: integer('store_id')
      .notNull()
      .references(() => stores.id),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id),
    storeSku: text('store_sku').notNull(),
    storeUrl: text('store_url').notNull(),
    titleAtStore: text('title_at_store').notNull(),
    /** How this link was made: 'ean' or 'name'. Name matches carry a score (R5). */
    matchMethod: text('match_method', { enum: ['ean', 'name'] }).notNull(),
    matchScore: real('match_score'),
  },
  (table) => ({
    storeSkuIdx: uniqueIndex('store_products_store_sku_idx').on(table.storeId, table.storeSku),
    productIdx: index('store_products_product_idx').on(table.productId),
  }),
);

/* ------------------------------------------------------------------ prices */

/** Append-only (R8). Corrections are new rows, never updates. */
export const priceObservations = pgTable(
  'price_observations',
  {
    id: serial('id').primaryKey(),
    storeProductId: integer('store_product_id')
      .notNull()
      .references(() => storeProducts.id),
    observedAt: timestamp('observed_at', { withTimezone: true }).notNull().defaultNow(),
    shelfPence: integer('shelf_pence'),
    loyaltyPence: integer('loyalty_pence'),
    offerKind: text('offer_kind', {
      enum: ['shelf', 'shelf_offer', 'loyalty', 'rollback', 'multibuy'],
    })
      .notNull()
      .default('shelf'),
    /** Only set when the retailer published it (R2). */
    offerEndsOn: date('offer_ends_on'),
    offerFirstSeenOn: date('offer_first_seen_on'),
    inStock: boolean('in_stock').notNull().default(true),
    /** The parsed payload this row was derived from, for debugging a bad price. */
    raw: jsonb('raw'),
  },
  (table) => ({
    lookupIdx: index('price_observations_lookup_idx').on(table.storeProductId, table.observedAt),
  }),
);

/** Daily rollup so charts never scan the raw table. */
export const priceDaily = pgTable(
  'price_daily',
  {
    storeProductId: integer('store_product_id')
      .notNull()
      .references(() => storeProducts.id),
    day: date('day').notNull(),
    shelfMinPence: integer('shelf_min_pence'),
    loyaltyMinPence: integer('loyalty_min_pence'),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.storeProductId, table.day] }),
  }),
);

/** Rows the matcher could not place with enough confidence (R5). */
export const unmatched = pgTable('unmatched', {
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .notNull()
    .references(() => stores.id),
  storeSku: text('store_sku').notNull(),
  title: text('title').notNull(),
  bestGuessProductId: integer('best_guess_product_id').references(() => products.id),
  bestScore: real('best_score'),
  seenAt: timestamp('seen_at', { withTimezone: true }).notNull().defaultNow(),
  resolved: boolean('resolved').notNull().default(false),
});

/** One row per retailer per refresh run, so a silent breakage is visible. */
export const runs = pgTable('runs', {
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .notNull()
    .references(() => stores.id),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  fetched: integer('fetched').notNull().default(0),
  parsed: integer('parsed').notNull().default(0),
  matched: integer('matched').notNull().default(0),
  failed: integer('failed').notNull().default(0),
  status: text('status', { enum: ['running', 'ok', 'partial', 'failed'] })
    .notNull()
    .default('running'),
  note: text('note'),
});

/* --------------------------------------------------------- people and lists */

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const households = pgTable('households', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  ownerId: uuid('owner_id')
    .notNull()
    .references(() => users.id),
  reminderDays: integer('reminder_days').notNull().default(14),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const householdMembers = pgTable(
  'household_members',
  {
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    role: text('role', { enum: ['owner', 'member'] })
      .notNull()
      .default('member'),
    displayName: text('display_name'),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.householdId, table.userId] }),
  }),
);

export const lists = pgTable('lists', {
  id: uuid('id').primaryKey().defaultRandom(),
  householdId: uuid('household_id')
    .notNull()
    .references(() => households.id),
  name: text('name').notNull(),
  isDefault: boolean('is_default').notNull().default(false),
});

export const listItems = pgTable(
  'list_items',
  {
    id: serial('id').primaryKey(),
    listId: uuid('list_id')
      .notNull()
      .references(() => lists.id),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id),
    qty: integer('qty').notNull().default(1),
    addedByUserId: uuid('added_by_user_id').references(() => users.id),
    addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
    ticked: boolean('ticked').notNull().default(false),
  },
  (table) => ({
    listIdx: index('list_items_list_idx').on(table.listId),
  }),
);

export const alerts = pgTable('alerts', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  productId: integer('product_id')
    .notNull()
    .references(() => products.id),
  kind: text('kind', { enum: ['any_drop', 'below'] }).notNull(),
  thresholdPence: integer('threshold_pence'),
  active: boolean('active').notNull().default(true),
});

export const digestsSent = pgTable('digests_sent', {
  id: serial('id').primaryKey(),
  householdId: uuid('household_id')
    .notNull()
    .references(() => households.id),
  sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
  payload: jsonb('payload'),
});
