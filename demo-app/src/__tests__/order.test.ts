import { calculateOrderTotal } from "../order";

describe("calculateOrderTotal", () => {
  it("returns the full price for a single item", () => {
    expect(
      calculateOrderTotal([{ name: "espresso", price: 3.5, quantity: 1 }]),
    ).toBe(3.5);
  });

  it("sums multiple items without a discount below the threshold", () => {
    const order = [
      { name: "latte", price: 4, quantity: 1 },
      { name: "croissant", price: 2.5, quantity: 1 },
    ];
    expect(calculateOrderTotal(order)).toBe(6.5);
  });

  it("applies the 10% discount from 3+ total items", () => {
    const order = [{ name: "espresso", price: 3.5, quantity: 3 }];
    expect(calculateOrderTotal(order)).toBe(9.45); // 10.50 - 10%
  });

  it("counts total quantity, not the number of product lines", () => {
    const order = [
      { name: "latte", price: 4, quantity: 2 },
      { name: "croissant", price: 2.5, quantity: 1 },
    ];
    expect(calculateOrderTotal(order)).toBe(9.45); // (8.00 + 2.50) - 10%
  });

  it("returns 0 for an empty order", () => {
    expect(calculateOrderTotal([])).toBe(0);
  });

  it("rounds the total to two decimal places", () => {
    const order = [{ name: "cookie", price: 1.33, quantity: 3 }];
    expect(calculateOrderTotal(order)).toBe(3.59); // 3.99 - 10% = 3.591
  });
});