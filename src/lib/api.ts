const API_BASE = "http://localhost:3000";

import type {
  User,
  AstrologerProfile,
  AuthResponse,
  AvailabilityRule,
  AvailabilityException,
  Booking,
  Question,
  QuestionMessage,
  QuestionThread,
  PaginatedBookings,
  PaginatedQuestions,
  AstrologerStats,
  WebsiteTemplate,
  MySite,
  SiteDocument,
  StoredTemplateData,
} from "@/types";

type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  headers?: Record<string, string>;
  /** Internal: marks a retried request so we never refresh twice in a row. */
  retried?: boolean;
}

class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(status: number, message: string, data: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

/**
 * When a request that carried an access token comes back 401 the session is
 * expired/invalid. Clear it once and send the user back to sign in instead of
 * leaving them staring at a failed data fetch.
 */
let expiredRedirectPending = false;

function handleExpiredSession() {
  clearTokens();
  localStorage.removeItem("user");
  if (expiredRedirectPending) return;
  expiredRedirectPending = true;
  const current = window.location.pathname;
  window.location.assign(
    current === "/signin" ? current : `/signin?expired=1&next=${encodeURIComponent(current + window.location.search)}`
  );
}

/**
 * Exchange the stored refresh token for a fresh pair (single-flight: parallel
 * 401s share one refresh instead of stampeding, since the backend rotates and
 * revokes the token on every use).
 */
let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { accessToken: string; refreshToken: string };
    setTokens(data.accessToken, data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

export function getAccessToken(): string | null {
  return localStorage.getItem("accessToken");
}

function getRefreshToken(): string | null {
  return localStorage.getItem("refreshToken");
}

export function setTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem("accessToken", accessToken);
  localStorage.setItem("refreshToken", refreshToken);
}

export function clearTokens() {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
}

export async function api<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {  const { method = "GET", body, headers: extraHeaders = {}, retried = false } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...extraHeaders,
  };

  const token = getAccessToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    if (res.status === 401 && token && !retried) {
      // Token probably expired: try to refresh once, then replay the request.
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
      }
      const refreshed = await refreshPromise;
      if (refreshed) {
        return api<T>(path, { ...options, retried: true });
      }
    }
    if (res.status === 401 && token) {
      handleExpiredSession();
    }
    throw new ApiError(res.status, (data as { error?: string })?.error ?? res.statusText, data);
  }

  return data as T;
}

// Auth API
export const authApi = {
  register: (data: {
    name: string;
    email: string;
    username: string;
    password: string;
    mobile?: string;
  }) => api<AuthResponse>("/auth/register", { method: "POST", body: data }),

  signin: (data: { identifier: string; password: string }) =>
    api<AuthResponse>("/auth/signin", { method: "POST", body: data }),

  signout: () => {
    const refreshToken = getRefreshToken();
    return api<{ message: string }>("/auth/signout", {
      method: "POST",
      body: { refreshToken },
    });
  },
};

// Astrologer API
export const astrologerApi = {
  onboard: () =>
    api<{ user: User; profile: AstrologerProfile; accessToken: string }>("/astrologers/onboard", {
      method: "POST",
    }),

  getMe: () =>
    api<{ user: User; profile: AstrologerProfile }>("/astrologers/me"),

  getStats: () => api<AstrologerStats>("/astrologers/me/stats"),

  updateProfile: (data: {
    bio?: string;
    specializations?: string[];
    languages?: string[];
    experienceYears?: number;
    timezone?: string;
  }) =>
    api<{ profile: AstrologerProfile }>("/astrologers/me", {
      method: "PATCH",
      body: data,
    }),

  updatePricing: (data: {
    questionPricePaise: number;
    callPricePerSlotPaise: number;
    slotDurationMinutes: number;
    bufferMinutes: number;
  }) =>
    api<{ profile: AstrologerProfile }>("/astrologers/me/pricing", {
      method: "PATCH",
      body: data,
    }),

  getAvailabilityRules: () =>
    api<{ rules: AvailabilityRule[] }>("/astrologers/me/availability-rules"),

  createAvailabilityRule: (data: {
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  }) =>
    api<{ rule: AvailabilityRule }>("/astrologers/me/availability-rules", {
      method: "POST",
      body: data,
    }),

  updateAvailabilityRule: (
    id: string,
    data: { dayOfWeek?: number; startTime?: string; endTime?: string; isActive?: boolean },
  ) =>
    api<{ rule: AvailabilityRule }>(`/astrologers/me/availability-rules/${id}`, {
      method: "PATCH",
      body: data,
    }),

  deleteAvailabilityRule: (id: string) =>
    api<{ message: string }>(`/astrologers/me/availability-rules/${id}`, {
      method: "DELETE",
    }),

  bulkSetAvailabilityRules: (data: {
    daysOfWeek: number[];
    windows: { startTime: string; endTime: string }[];
  }) =>
    api<{ rules: AvailabilityRule[] }>("/astrologers/me/availability-rules/bulk", {
      method: "POST",
      body: data,
    }),

  getExceptions: () =>
    api<{ exceptions: AvailabilityException[] }>("/astrologers/me/exceptions"),

  createException: (data: {
    date: string;
    isBlocked: boolean;
    startTime?: string;
    endTime?: string;
    reason?: string;
  }) =>
    api<{ exception: AvailabilityException }>("/astrologers/me/exceptions", {
      method: "POST",
      body: data,
    }),

  deleteException: (id: string) =>
    api<{ message: string }>(`/astrologers/me/exceptions/${id}`, {
      method: "DELETE",
    }),

  getMySite: () => api<MySite>("/astrologers/me/site"),

  saveTemplateData: (data: {
    templateId?: string;
    templateData: StoredTemplateData;
  }) =>
    api<{ profile: AstrologerProfile; site: SiteDocument }>(
      "/astrologers/me/template-data",
      {
        method: "PATCH",
        body: data,
      },
    ),
};

// Templates API
export const templatesApi = {
  list: () => api<{ templates: WebsiteTemplate[] }>("/templates"),

  get: (id: string) => api<{ template: WebsiteTemplate }>(`/templates/${id}`),
};

function buildListPath(
  base: string,
  params: { status?: string; limit?: number; offset?: number },
): string {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  if (params.limit !== undefined) qs.set("limit", String(params.limit));
  if (params.offset !== undefined) qs.set("offset", String(params.offset));
  const str = qs.toString();
  return str ? `${base}?${str}` : base;
}

// Bookings API
export const bookingsApi = {
  list: (status?: string, limit?: number, offset?: number) =>
    api<PaginatedBookings>(buildListPath("/bookings", { status, limit, offset })),

  get: (id: string) => api<{ booking: Booking }>(`/bookings/${id}`),

  reschedule: (id: string, newStartAt: string) =>
    api<{ booking: Booking }>(`/bookings/${id}/reschedule`, {
      method: "PATCH",
      body: { newStartAt },
    }),

  cancel: (id: string, reason?: string) =>
    api<{ booking: Booking }>(`/bookings/${id}/cancel`, {
      method: "PATCH",
      body: { reason },
    }),

  complete: (id: string) =>
    api<{ booking: Booking }>(`/bookings/${id}/complete`, {
      method: "PATCH",
    }),
};

// Questions API
export const questionsApi = {
  list: (status?: string, limit?: number, offset?: number) =>
    api<PaginatedQuestions>(buildListPath("/questions", { status, limit, offset })),

  get: (id: string) => api<{ question: Question }>(`/questions/${id}`),

  answer: (id: string, answerText: string) =>
    api<{ question: Question }>(`/questions/${id}/answer`, {
      method: "PATCH",
      body: { answerText },
    }),

  reject: (id: string, reason?: string) =>
    api<{ question: Question }>(`/questions/${id}/reject`, {
      method: "PATCH",
      body: { reason },
    }),

  unreject: (id: string) =>
    api<{ question: Question }>(`/questions/${id}/unreject`, {
      method: "PATCH",
    }),

  messages: (id: string) => api<QuestionThread>(`/questions/${id}/messages`),

  sendMessage: (id: string, body: string) =>
    api<{ message: QuestionMessage; question: Question }>(`/questions/${id}/messages`, {
      method: "POST",
      body: { body },
    }),
};
