import type { Cart, Variant } from '../../../packages/contracts/src/index.ts';

export interface QueryDb {
  query(text: string, values?: unknown[]): Promise<{ rows: any[] }>;
}

export const QUERIES = {
  products: 'SELECT id, name, price_cents, seller_id FROM demo.products ORDER BY id',
  sellersBatch: 'SELECT id, name FROM demo.sellers WHERE id = ANY($1::int[]) ORDER BY id',
  sellerOne: 'SELECT id, name FROM demo.sellers WHERE id = $1',
} as const;

export async function loadCart(db: QueryDb, variant: Variant = 'baseline'): Promise<Cart> {
  const { rows: products } = await db.query(QUERIES.products);
  const sellerIds = [...new Set(products.map(p => p.seller_id))];
  const sellers: { id: number; name: string }[] = [];
  if (variant === 'regressed') {
    for (const product of products) {
      const result = await db.query(QUERIES.sellerOne, [product.seller_id]);
      sellers.push(...result.rows);
    }
  } else {
    // Baseline and the prepared fix both batch seller lookup; no automatic repair.
    sellers.push(...(await db.query(QUERIES.sellersBatch, [sellerIds])).rows);
  }
  const sellerMap = new Map(sellers.map(s => [s.id, s]));
  return {
    dataset: 'cart-v1',
    products: products.map(p => {
      const seller = sellerMap.get(p.seller_id);
      if (!seller) throw new Error('A product references a missing seller.');
      return { id: p.id, name: p.name, priceCents: p.price_cents, seller: { id: seller.id, name: seller.name } };
    }),
    totalCents: products.reduce((sum, p) => sum + p.price_cents, 0),
  };
}
