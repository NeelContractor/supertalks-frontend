import { test, expect } from "bun:test";
import { bookingStatusLabel, questionStatusLabel } from "./status-labels";

test("Queued reads as Unanswered", () => {
  expect(questionStatusLabel("Queued")).toBe("Unanswered");
  expect(questionStatusLabel("Answered")).toBe("Answered");
  expect(questionStatusLabel("Rejected")).toBe("Rejected");
});

test("unpaid statuses are spelled out", () => {
  expect(questionStatusLabel("PendingPayment")).toBe("Payment pending");
  expect(bookingStatusLabel("PendingPayment")).toBe("Payment pending");
});

test("booking statuses are humanised", () => {
  expect(bookingStatusLabel("Confirmed")).toBe("Confirmed");
  expect(bookingStatusLabel("CancelledByClient")).toBe("Cancelled by client");
  expect(bookingStatusLabel("CancelledByAstrologer")).toBe("Cancelled by astrologer");
  expect(bookingStatusLabel("NoShowClient")).toBe("No show (client)");
});

test("an unknown status is passed through rather than blanked", () => {
  expect(questionStatusLabel("SomethingNew")).toBe("SomethingNew");
  expect(bookingStatusLabel("")).toBe("");
});