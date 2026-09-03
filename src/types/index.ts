export interface User {
  id: string;
  name: string;
  email: string;
  username: string;
  role: "Client" | "Astrologer" | "Admin";
  profileImageUrl?: string;
}

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
