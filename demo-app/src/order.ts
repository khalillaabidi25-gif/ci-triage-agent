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
export const DISCOUNT_THRESHOLD_ITEMS = 3;

/** Percentage discount applied as a decimal. */
export const DISCOUNT_RATE = 0.1;

const roundToCents = (value: number): number => Math.round(value * 100) / 100;
export function calculateOrderTotal(items: OrderItem[]): number {
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  const subtotal = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );

  const total =
    totalItems >= DISCOUNT_THRESHOLD_ITEMS
      ? subtotal * (1 - DISCOUNT_RATE)
      : subtotal;

  return roundToCents(total);
}

 