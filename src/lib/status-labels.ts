// Human labels for the backend's status enums.
//
// The API deliberately sends raw enum values (`Queued`, `PendingPayment`,
// `CancelledByAstrologer`) so the data stays machine-readable, but those strings
// mean nothing to an astrologer or a client reading the screen. Every status
// shown in the UI goes through here; all logic keeps comparing raw values.

const QUESTION_STATUS_LABELS: Record<string, string> = {
  // "Queued" reads as a support/queue concept this product does not have: there
  // is no ordering or priority on a question. It only ever means paid and
  // waiting for the astrologer, which is what "Unanswered" says.
  Queued: "Unanswered",
  PendingPayment: "Payment pending",
  Answered: "Answered",
  Rejected: "Rejected",
  Refunded: "Refunded",
};

const BOOKING_STATUS_LABELS: Record<string, string> = {
  PendingPayment: "Payment pending",
  Confirmed: "Confirmed",
  Rescheduled: "Rescheduled",
  Completed: "Completed",
  CancelledByClient: "Cancelled by client",
  CancelledByAstrologer: "Cancelled by astrologer",
  NoShowClient: "No show (client)",
  NoShowAstrologer: "No show (astrologer)",
};

export function questionStatusLabel(status: string): string {
  return QUESTION_STATUS_LABELS[status] ?? status;
}

export function bookingStatusLabel(status: string): string {
  return BOOKING_STATUS_LABELS[status] ?? status;
}