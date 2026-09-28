/**
 * A tiny coffee-shop order domain.
 *
 * The demo-app exists so the CI pipeline can fail on a *real* bug in real
 * code instead of a fake missing-script step.
 */

export interface OrderItem {
  name: string;
  price: number;
  quantity: number;
}

/** Orders with at least this many total items earn a discount. */
export function calculateOrderTotal(items: OrderItem[]): number {
  const subtotal = items.reduce(
    (sum, item) =>
      sum +
      item.price *
        item.quantity *
        (item.quantity >= DISCOUNT_THRESHOLD_ITEMS ? 1 - DISCOUNT_RATE : 1),
    0,
  );

  return roundToCents(subtotal);
}
 