export interface User {
  id: string;
  name: string;
  email: string;
  username: string;
  role: "Client" | "Astrologer" | "Admin";
  profileImageUrl?: string;
}

/** Which side of the dashboard a user is looking at. Astrologers can have
 * both: their provider view ("astrologer") and their own customer view
 * ("client") for booking/asking other astrologers. */
export type ViewAs = "client" | "astrologer";

export interface AstrologerProfile {
  id: string;
  userId: string;
  slug: string;
  status: "Pending" | "Approved" | "Rejected" | "Suspended";
  bio?: string;
  specializations: string[];
  languages: string[];
  experienceYears?: number;
  timezone: string;
  questionPricePaise: number;
  callPricePerSlotPaise: number;
  slotDurationMinutes: number;
  bufferMinutes: number;
  cancellationWindowHours: number;
  ratingAvgX100: number;
  ratingCount: number;
  templateId?: string;
  templateData: Record<string, unknown>;
  isAcceptingQuestions: boolean;
  isAcceptingBookings: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface AvailabilityRule {
  id: string;
  astrologerId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
  createdAt: string;
}

export interface AvailabilityException {
  id: string;
  astrologerId: string;
  date: string;
  startTime?: string;
  endTime?: string;
  isBlocked: boolean;
  reason?: string;
  createdAt: string;
}

export interface Booking {
  id: string;
  clientId: string;
  astrologerId: string;
  startAt: string;
  endAt: string;
  status: string;
  pricePaise: number;
  paymentId?: string;
  meetingLink?: string;
  clientNote?: string;
  cancelledBy?: string;
  cancellationReason?: string;
  createdAt: string;
  updatedAt: string;
  client?: User;
  astrologer?: { user: User; profile: AstrologerProfile };
}

export interface Question {
  id: string;
  clientId: string;
  astrologerId: string;
  questionText: string;
  category?: string;
  status: string;
  pricePaise: number;
  paymentId?: string;
  answerText?: string;
  answeredAt?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
  client?: User;
  astrologer?: { user: User; profile: AstrologerProfile };
  lastMessage?: QuestionMessage | null;
}

export interface QuestionMessage {
  id: string;
  senderId: string;
  senderRole: "Client" | "Astrologer";
  body: string;
  createdAt: string;
  sender?: { id: string; name: string };
}

export interface QuestionThread {
  question: Question;
  messages: QuestionMessage[];
}

export type SendQuestionMessageResult =
  | { requiresPayment: true; payment: PaymentIntent; question: Question }
  | { requiresPayment: false; message: QuestionMessage; question: Question };

export interface PaymentIntent {
  id: string;
  amountPaise: number;
  currency: string;
  clientDetails?: Record<string, unknown> | null;
}

export interface CompletedPayment {
  id: string;
  amountPaise: number;
  currency: string;
  status: string;
  provider?: string;
  purpose?: string;
}

export interface PaymentOutcome {
  payment: CompletedPayment;
  message?: QuestionMessage | null;
  question?: Question | null;
  questions?: Question[] | null;
  bookings?: Booking[] | null;
}

export interface InitiatePaymentResult {
  mode: "mock" | "gateway";
  redirectUrl: string | null;
  payment: CompletedPayment;
  message?: QuestionMessage | null;
  question?: Question | null;
  questions?: Question[] | null;
  bookings?: Booking[] | null;
}

export interface BookingCounts {
  all: number;
  Confirmed: number;
  Completed: number;
  Cancelled: number;
  Pending: number;
}

export interface PaginatedBookings {
  bookings: Booking[];
  total: number;
  counts: BookingCounts;
}

export interface QuestionCounts {
  all: number;
  Queued: number;
  Answered: number;
  Rejected: number;
  Refunded: number;
}

export interface PaginatedQuestions {
  questions: Question[];
  total: number;
  counts: QuestionCounts;
}

export interface AstrologerStats {
  pendingQuestions: number;
  answeredQuestions: number;
  rejectedQuestions: number;
  totalQuestions: number;
  upcomingBookings: number;
  completedBookings: number;
  totalBookings: number;
  totalEarningsPaise: number;
}

// Website customization

export type TemplateFieldType =
  | "text"
  | "textarea"
  | "image"
  | "select"
  | "color"
  | "number"
  | "array";

export interface TemplateField {
  type: TemplateFieldType;
  default?: unknown;
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
  itemName?: string;
  itemProps?: Record<string, TemplateField>;
}

export interface TemplateSectionField {
  id: string;
  type: string;
  name: string;
  default: boolean;
  props: Record<string, TemplateField>;
}

export interface TemplateSchema {
  design: Record<string, TemplateField>;
  sections: TemplateSectionField[];
}

export interface WebsiteTemplate {
  id: string;
  name: string;
  previewImageUrl?: string | null;
  schema: TemplateSchema;
  isActive: boolean;
}

export interface FieldStyle {
  fontSize?: string;
  color?: string;
  fontFamily?: string;
  fontWeight?: string;
  fontStyle?: string;
  textTransform?: string;
}

export interface SiteSectionDoc {
  id: string;
  type: string;
  name: string;
  default: boolean;
  props: Record<string, unknown>;
  fieldStyles?: Record<string, FieldStyle>;
}

export interface SiteDocument {
  design: Record<string, string | number>;
  sections: SiteSectionDoc[];
}

export interface StoredTemplateData {
  design: Record<string, string | number>;
  sections: Record<string, { props: Record<string, unknown>; fieldStyles?: Record<string, FieldStyle> }>;
}

export interface MySite {
  slug: string;
  astrologerName: string;
  templateId: string;
  templateName: string;
  templatePreviewImageUrl?: string | null;
  schema: TemplateSchema;
  site: SiteDocument;
}
