import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import type {
  User,
  AstrologerProfile,
  Booking,
  BookingCounts,
  Question,
  QuestionCounts,
  AstrologerStats,
  AvailabilityRule,
  AvailabilityException,
  QuestionMessage,
  MySite,
  WebsiteTemplate,
} from "@/types";
import {
  authApi,
  astrologerApi,
  bookingsApi,
  questionsApi,
  templatesApi,
  setTokens,
  clearTokens,
  getAccessToken,
} from "@/lib/api";

// ---------------------------------------------------------------------------
// Single-file global store for the astrologer dashboard app.
//
// Every piece of shared/domain state lives in this one Zustand store so that
// pages read from (and write to) one source of truth instead of each page
// re-fetching and re-building its own copies. Fetch actions are cached: they
// only hit the network the first time (or when `force` is passed).
// ---------------------------------------------------------------------------

interface BookingPage {
  items: Booking[];
  total: number;
  loadedAt: number;
}

interface QuestionPage {
  items: Question[];
  total: number;
  loadedAt: number;
}

interface StoreState {
  // ---- auth / identity ----------------------------------------------------
  user: User | null;
  profile: AstrologerProfile | null;
  authLoading: boolean;
  authHydrated: boolean;

  // ---- dashboard stats ----------------------------------------------------
  stats: AstrologerStats | null;
  statsLoading: boolean;
  statsLoadedAt: number | null;

  // ---- bookings ------------------------------------------------------------
  bookingPages: Record<string, BookingPage>;
  bookingCounts: BookingCounts | null;
  bookingsLoading: boolean;

  // ---- questions -----------------------------------------------------------
  questionPages: Record<string, QuestionPage>;
  questionCounts: QuestionCounts | null;
  questionsLoading: boolean;

  // ---- availability (rules + exceptions) -----------------------------------
  rules: AvailabilityRule[];
  exceptions: AvailabilityException[];
  availabilityLoading: boolean;
  availabilityLoadedAt: number | null;

  // ---- website / templates ---------------------------------------------------
  mySite: MySite | null;
  templates: WebsiteTemplate[];
  siteLoading: boolean;
  siteLoadedAt: number | null;

  // ---- question chat ---------------------------------------------------------
  messagesByQuestion: Record<string, QuestionMessage[]>;
  questionById: Record<string, Question>;

  // ---- actions ---------------------------------------------------------------
  hydrateAuth: () => Promise<void>;
  signin: (identifier: string, password: string) => Promise<void>;
  signup: (data: {
    name: string;
    email: string;
    username: string;
    password: string;
  }) => Promise<void>;
  signout: () => Promise<void>;
  onboard: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  applyProfile: (profile: AstrologerProfile) => void;

  loadStats: (force?: boolean) => Promise<AstrologerStats | null>;
  loadBookings: (filter: string, page: number, force?: boolean) => Promise<BookingPage>;
  loadQuestions: (filter: string, page: number, force?: boolean) => Promise<QuestionPage>;
  loadAvailability: (force?: boolean) => Promise<void>;
  setRules: (rules: AvailabilityRule[]) => void;
  setExceptions: (exceptions: AvailabilityException[]) => void;
  loadSiteResources: (force?: boolean) => Promise<{ mySite: MySite | null; templates: WebsiteTemplate[] }>;

  loadThread: (questionId: string, force?: boolean) => Promise<{ question: Question; messages: QuestionMessage[] }>;
  upsertMessage: (questionId: string, message: QuestionMessage) => void;
  setQuestionStatus: (questionId: string, status: string) => void;
}

function getStoredUser(): User | null {
  try {
    const raw = localStorage.getItem("user");
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

function storeUser(user: User | null) {
  if (user) {
    localStorage.setItem("user", JSON.stringify(user));
  } else {
    localStorage.removeItem("user");
  }
}

function decodeJwtPayload(token: string): { sub?: string; role?: string } | null {
  try {
    const parts = token.split(".");
    const base64 = parts[1];
    if (!base64) return null;
    const json = atob(base64.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

const AVAILABILITY_TTL = 30_000;
const SITE_TTL = 30_000;
const STATS_TTL = 60_000;

export const useStore = create<StoreState>((set, get) => ({
  // ---- auth / identity ----------------------------------------------------
  user: null,
  profile: null,
  authLoading: true,
  authHydrated: false,

  // ---- dashboard stats ----------------------------------------------------
  stats: null,
  statsLoading: false,
  statsLoadedAt: null,

  // ---- bookings ------------------------------------------------------------
  bookingPages: {},
  bookingCounts: null,
  bookingsLoading: false,

  // ---- questions -----------------------------------------------------------
  questionPages: {},
  questionCounts: null,
  questionsLoading: false,

  // ---- availability ---------------------------------------------------------
  rules: [],
  exceptions: [],
  availabilityLoading: false,
  availabilityLoadedAt: null,

  // ---- website / templates ---------------------------------------------------
  mySite: null,
  templates: [],
  siteLoading: false,
  siteLoadedAt: null,

  // ---- question chat ---------------------------------------------------------
  messagesByQuestion: {},
  questionById: {},

  // ---- actions ---------------------------------------------------------------
  hydrateAuth: async () => {
    const token = getAccessToken();
    if (!token) {
      set({ user: getStoredUser(), profile: null, authLoading: false, authHydrated: true });
      return;
    }

    const payload = decodeJwtPayload(token);
    if (!payload?.sub) {
      clearTokens();
      storeUser(null);
      set({ user: null, profile: null, authLoading: false, authHydrated: true });
      return;
    }

    if (payload.role === "Astrologer") {
      try {
        const data = await astrologerApi.getMe();
        storeUser(data.user);
        set({ user: data.user, profile: data.profile });
      } catch {
        const stored = getStoredUser();
        if (!stored) {
          clearTokens();
          storeUser(null);
        }
      }
    } else {
      const stored = getStoredUser();
      if (!stored) {
        set({ user: null });
      }
    }

    set({ authLoading: false, authHydrated: true });
  },

  signin: async (identifier, password) => {
    const data = await authApi.signin({ identifier, password });
    setTokens(data.accessToken, data.refreshToken);
    storeUser(data.user);
    set({ user: data.user });
    if (data.user.role === "Astrologer") {
      try {
        const profileData = await astrologerApi.getMe();
        set({ profile: profileData.profile });
      } catch {
        // profile might not exist yet (edge case)
      }
    }
  },

  signup: async (regData) => {
    const data = await authApi.register(regData);
    setTokens(data.accessToken, data.refreshToken);
    storeUser(data.user);
    set({ user: data.user });
  },

  signout: async () => {
    try {
      await authApi.signout();
    } finally {
      clearTokens();
      storeUser(null);
      set({
        user: null,
        profile: null,
        stats: null,
        statsLoadedAt: null,
        bookingPages: {},
        bookingCounts: null,
        questionPages: {},
        questionCounts: null,
        rules: [],
        exceptions: [],
        availabilityLoadedAt: null,
        mySite: null,
        templates: [],
        siteLoadedAt: null,
        messagesByQuestion: {},
        questionById: {},
      });
    }
  },

  onboard: async () => {
    const data = await astrologerApi.onboard();
    localStorage.setItem("accessToken", data.accessToken);
    storeUser(data.user);
    set({ user: data.user, profile: data.profile });
  },

  refreshProfile: async () => {
    try {
      const data = await astrologerApi.getMe();
      storeUser(data.user);
      set({ user: data.user, profile: data.profile });
    } catch {
      // silently fail
    }
  },

  applyProfile: (profile) => set({ profile }),

  // ---- dashboard stats ----------------------------------------------------
  loadStats: async (force = false) => {
    const { stats, statsLoadedAt } = get();
    if (!force && stats && statsLoadedAt && Date.now() - statsLoadedAt < STATS_TTL) {
      return stats;
    }
    set({ statsLoading: true });
    try {
      const data = await astrologerApi.getStats();
      set({ stats: data, statsLoadedAt: Date.now() });
      return data;
    } catch {
      return get().stats;
    } finally {
      set({ statsLoading: false });
    }
  },

  // ---- bookings ------------------------------------------------------------
  loadBookings: async (filter, page, force = false) => {
    const key = `${filter}:${page}`;
    const cached = get().bookingPages[key];
    if (!force && cached) {
      return cached;
    }
    set({ bookingsLoading: true });
    try {
      const status = filter === "all" ? undefined : filter;
      const offset = page * 10;
      const data = await bookingsApi.list(status, 10, offset);
      const pageData: BookingPage = { items: data.bookings, total: data.total, loadedAt: Date.now() };
      set((state) => ({
        bookingPages: { ...state.bookingPages, [key]: pageData },
        bookingCounts: data.counts ?? state.bookingCounts,
      }));
      return pageData;
    } finally {
      set({ bookingsLoading: false });
    }
  },

  // ---- questions -----------------------------------------------------------
  loadQuestions: async (filter, page, force = false) => {
    const key = `${filter}:${page}`;
    const cached = get().questionPages[key];
    if (!force && cached) {
      return cached;
    }
    set({ questionsLoading: true });
    try {
      const status = filter === "all" ? undefined : filter;
      const offset = page * 10;
      const data = await questionsApi.list(status, 10, offset);
      const pageData: QuestionPage = { items: data.questions, total: data.total, loadedAt: Date.now() };
      set((state) => ({
        questionPages: { ...state.questionPages, [key]: pageData },
        questionCounts: data.counts ?? state.questionCounts,
        questionById: {
          ...state.questionById,
          ...Object.fromEntries(data.questions.map((q) => [q.id, q])),
        },
      }));
      return pageData;
    } finally {
      set({ questionsLoading: false });
    }
  },

  // ---- availability ---------------------------------------------------------
  loadAvailability: async (force = false) => {
    const { rules, exceptions, availabilityLoadedAt } = get();
    const hasData = rules.length > 0 || exceptions.length > 0;
    if (!force && hasData && availabilityLoadedAt && Date.now() - availabilityLoadedAt < AVAILABILITY_TTL) {
      return;
    }
    set({ availabilityLoading: true });
    try {
      const [rulesData, exceptionsData] = await Promise.all([
        astrologerApi.getAvailabilityRules().catch(() => ({ rules: [] as AvailabilityRule[] })),
        astrologerApi.getExceptions().catch(() => ({ exceptions: [] as AvailabilityException[] })),
      ]);
      set({ rules: rulesData.rules, exceptions: exceptionsData.exceptions, availabilityLoadedAt: Date.now() });
    } finally {
      set({ availabilityLoading: false });
    }
  },

  setRules: (rules) => set({ rules }),
  setExceptions: (exceptions) => set({ exceptions }),

  // ---- website / templates -------------------------------------------------
  loadSiteResources: async (force = false) => {
    const { mySite, templates, siteLoadedAt } = get();
    const fresh =
      mySite &&
      (templates.length > 0 || siteLoadedAt !== null) &&
      siteLoadedAt !== null &&
      Date.now() - siteLoadedAt < SITE_TTL;
    if (!force && fresh && templates.length > 0) {
      return { mySite: mySite as MySite, templates };
    }
    set({ siteLoading: true });
    try {
      const [me, list] = await Promise.all([
        astrologerApi.getMySite(),
        templatesApi.list().catch(() => ({ templates: [] as WebsiteTemplate[] })),
      ]);
      set({ mySite: me, templates: list.templates, siteLoadedAt: Date.now() });
      return { mySite: me, templates: list.templates };
    } finally {
      set({ siteLoading: false });
    }
  },

  // ---- question chat ---------------------------------------------------------
  loadThread: async (questionId, force = false) => {
    const cachedMessages = get().messagesByQuestion[questionId];
    const cachedQuestion = get().questionById[questionId];
    if (!force && cachedMessages && cachedQuestion) {
      return { question: cachedQuestion, messages: cachedMessages };
    }
    try {
      const data = await questionsApi.messages(questionId);
      set((state) => ({
        messagesByQuestion: { ...state.messagesByQuestion, [questionId]: data.messages },
        questionById: { ...state.questionById, [questionId]: data.question },
      }));
      return { question: data.question, messages: data.messages };
    } catch (err: unknown) {
      const existing = get().questionById[questionId];
      if (existing) {
        throw err;
      }
      throw err;
    }
  },

  upsertMessage: (questionId, message) => {
    set((state) => {
      const existing = state.messagesByQuestion[questionId] ?? [];
      if (existing.some((m) => m.id === message.id)) {
        return state;
      }
      return {
        messagesByQuestion: {
          ...state.messagesByQuestion,
          [questionId]: [...existing, message],
        },
      };
    });
  },

  setQuestionStatus: (questionId, status) => {
    set((state) => {
      const q = state.questionById[questionId];
      if (!q) return state;
      return { questionById: { ...state.questionById, [questionId]: { ...q, status } } };
    });
  },
}));

// Convenience selector helpers kept in the same single state file.
export const useAuth = () =>
  useStore(
    useShallow((s) => ({
      user: s.user,
      profile: s.profile,
      loading: s.authLoading,
      signin: s.signin,
      signup: s.signup,
      signout: s.signout,
      onboard: s.onboard,
      refreshProfile: s.refreshProfile,
    })),
  );