import { test, expect } from "bun:test";
import { formatCompactINR, formatINR, formatNumberIN } from "./format";

// The API stores money in paise, so every input below is paise.
const rupees = (n: number) => Math.round(n * 100);

test("formatNumberIN groups digits the Indian way", () => {
  expect(formatNumberIN(0)).toBe("0");
  expect(formatNumberIN(999)).toBe("999");
  expect(formatNumberIN(1234567)).toBe("12,34,567");
  expect(formatNumberIN(123456789)).toBe("12,34,56,789");
});

test("formatINR shows the exact amount", () => {
  expect(formatINR(rupees(0))).toBe("₹0");
  expect(formatINR(rupees(1234.56))).toBe("₹1,234.56");
  expect(formatINR(rupees(1234567))).toBe("₹12,34,567");
});

test("formatCompactINR keeps small amounts exact", () => {
  expect(formatCompactINR(0)).toBe("₹0");
  expect(formatCompactINR(rupees(999))).toBe("₹999");
  expect(formatCompactINR(rupees(99999.5))).toBe("₹99,999.5");
});

test("formatCompactINR switches to lakhs and crores", () => {
  expect(formatCompactINR(rupees(100000))).toBe("₹1L");
  expect(formatCompactINR(rupees(123450))).toBe("₹1.23L");
  expect(formatCompactINR(rupees(9999999))).toBe("₹100L");
  expect(formatCompactINR(rupees(10000000))).toBe("₹1Cr");
  expect(formatCompactINR(rupees(25000000))).toBe("₹2.5Cr");
  expect(formatCompactINR(rupees(123500000))).toBe("₹12.35Cr");
});

test("formatCompactINR keeps the sign and survives bad input", () => {
  expect(formatCompactINR(-rupees(150000))).toBe("-₹1.5L");
  expect(formatCompactINR(Number.NaN)).toBe("₹0");
});