import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import type {
  User,
  AstrologerProfile,
  AstrologerApplication,
  Booking,
  BookingCounts,
  Question,
  QuestionCounts,
  AstrologerStats,
  ViewAs,
  SortOrder,
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
  usersApi,
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

  /**
   * The user's /register submission. `null` + `applicationLoaded` means they
   * have not registered yet (so /register should be shown); a non-null value
   * means the workflow is done and /register must be skipped. Clients never
   * have one, so they always go straight to the dashboard.
   */
  application: AstrologerApplication | null;
  applicationLoading: boolean;
  applicationLoaded: boolean;
  /** The application lookup failed. Never treat this as "unregistered". */
  applicationError: boolean;

  // Which side of the dashboard is shown. Astrologers can flip between their
  // provider view ("astrologer") and their own customer view ("client");
  // client-only users always see "client".
  viewAs: ViewAs;

  // ---- dashboard stats ----------------------------------------------------
  stats: AstrologerStats | null;
  statsLoading: boolean;
  statsLoadedAt: number | null;

  // ---- bookings ------------------------------------------------------------
  bookingPages: Record<string, BookingPage>;
  bookingCounts: BookingCounts | null;
  bookingsLoading: boolean;

  /**
   * The next sessions that have not started yet, nearest first. Kept apart from
   * `bookingPages` because it is shared: the navbar bell polls it on its own
   * cadence and must not invalidate (or be invalidated by) the paginated list.
   */
  upcomingBookings: Booking[];
  upcomingBookingsLoading: boolean;
  upcomingBookingsLoadedAt: number | null;

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
    mobile?: string;
    role?: "client" | "astrologer";
  }) => Promise<void>;
  signout: () => Promise<void>;
  onboard: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  applyProfile: (profile: AstrologerProfile) => void;
  setViewAs: (viewAs: ViewAs) => void;

  loadApplication: (force?: boolean) => Promise<AstrologerApplication | null>;
  submitApplication: (
    payload: Record<string, unknown>,
  ) => Promise<{ application: AstrologerApplication; profile: AstrologerProfile }>;
  /**
   * Where the user belongs right now: an astrologer who has not submitted the
   * register form goes to /register, everyone else to /dashboard.
   */
  landingPath: () => Promise<string>;

  loadStats: (force?: boolean) => Promise<AstrologerStats | null>;
  loadBookings: (filter: string, page: number, sort?: SortOrder, force?: boolean) => Promise<BookingPage>;
  loadUpcomingBookings: (force?: boolean) => Promise<Booking[]>;
  loadQuestions: (filter: string, page: number, sort?: SortOrder, force?: boolean) => Promise<QuestionPage>;
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

const VIEW_AS_KEY = "viewAs";

function getStoredViewAs(): ViewAs | null {
  try {
    const raw = localStorage.getItem(VIEW_AS_KEY);
    return raw === "client" || raw === "astrologer" ? raw : null;
  } catch {
    return null;
  }
}

/** Only astrologers can see the provider side; everyone else is a customer. */
function defaultViewAs(role: string | undefined): ViewAs {
  return role === "Astrologer" ? (getStoredViewAs() ?? "astrologer") : "client";
}

const AVAILABILITY_TTL = 30_000;
const SITE_TTL = 30_000;
const STATS_TTL = 60_000;
/** How stale the navbar's "next session" list may get before we refetch. */
const UPCOMING_TTL = 30_000;
/** Enough to cover the reminder window; the bell only ever shows a short list. */
const UPCOMING_LIMIT = 10;

/**
 * In development React StrictMode double-invokes the AuthProvider effect, so
 * hydrateAuth can run twice before a handoff exchange has finished. The second
 * run sees the ?code= already stripped from the URL and no token yet, which
 * would drop the session and bounce the client to /signin. Share the in-flight
 * exchange so duplicate runs wait for it instead.
 */
let handoffExchangeInFlight: Promise<void> | null = null;

export const useStore = create<StoreState>((set, get) => ({
  // ---- auth / identity ----------------------------------------------------
  user: null,
  profile: null,
  authLoading: true,
  authHydrated: false,
  application: null,
  applicationLoading: false,
  applicationLoaded: false,
  applicationError: false,
  viewAs: "client",

  // ---- dashboard stats ----------------------------------------------------
  stats: null,
  statsLoading: false,
  statsLoadedAt: null,

  // ---- bookings ------------------------------------------------------------
  bookingPages: {},
  bookingCounts: null,
  bookingsLoading: false,
  upcomingBookings: [],
  upcomingBookingsLoading: false,
  upcomingBookingsLoadedAt: null,

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
    // Cross-app handoff: the public site redirects here with a one-time
    // ?code= after a successful payment. Redeem it for a fresh token pair,
    // then strip the code from the URL before anything else runs.
    const rawQuery = typeof window !== "undefined" ? window.location.search : "";
    const query = new URLSearchParams(rawQuery);
    const handoffCode = query.get("code");
    if (handoffCode) {
      query.delete("code");
      const clean = `${window.location.pathname}${query.toString() ? `?${query.toString()}` : ""}${window.location.hash}`;
      window.history.replaceState(null, "", clean);
      handoffExchangeInFlight = (async () => {
        try {
          const data = await authApi.exchangeHandoff(handoffCode);
          setTokens(data.accessToken, data.refreshToken);
          storeUser(data.user);
        } catch {
          // Code invalid/expired/used. Fall through: if no stored session exists
          // the ProtectedRoute redirects to /signin and the client re-signs in.
        }
      })();
    }
    // Wait for the handoff exchange, no matter which run started it. A failed
    // exchange resolves this too, and the token check below decides what to do.
    if (handoffExchangeInFlight) {
      await handoffExchangeInFlight;
    }

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
        set({ user: data.user, profile: data.profile, viewAs: defaultViewAs(data.user.role) });
      } catch {
        const stored = getStoredUser();
        if (!stored) {
          clearTokens();
          storeUser(null);
        }
      }
    } else {
      try {
        const data = await usersApi.getMe();
        storeUser(data.user);
        set({ user: data.user, profile: null, viewAs: defaultViewAs(data.user.role) });
      } catch {
        const stored = getStoredUser();
        if (!stored) {
          clearTokens();
          storeUser(null);
        }
      }
    }

    set({ authLoading: false, authHydrated: true });
  },

  signin: async (identifier, password) => {
    const data = await authApi.signin({ identifier, password });
    setTokens(data.accessToken, data.refreshToken);
    storeUser(data.user);
    // Re-resolve the registration for whoever just signed in.
    set({
      user: data.user,
      viewAs: defaultViewAs(data.user.role),
      application: null,
      applicationLoaded: false,
      applicationError: false,
    });
    if (data.user.role === "Astrologer") {
      try {
        const profileData = await astrologerApi.getMe();
        set({ profile: profileData.profile });
      } catch {
        // profile might not exist yet (edge case)
      }
    } else {
      set({ profile: null });
    }
  },

  signup: async (regData) => {
    const data = await authApi.register(regData);
    setTokens(data.accessToken, data.refreshToken);
    storeUser(data.user);
    // A brand-new astrologer has no application yet, so the register workflow
    // is still ahead of them.
    set({
      user: data.user,
      profile: data.profile ?? null,
      viewAs: data.user.role === "Astrologer" ? "astrologer" : "client",
      application: null,
      applicationLoaded: regData.role !== "astrologer",
      applicationError: false,
    });
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
        viewAs: "client",
        application: null,
        applicationLoaded: false,
        applicationError: false,
        stats: null,
        statsLoadedAt: null,
        bookingPages: {},
        bookingCounts: null,
        upcomingBookings: [],
        upcomingBookingsLoadedAt: null,
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
    localStorage.setItem(VIEW_AS_KEY, "astrologer");
    storeUser(data.user);
    set({ user: data.user, profile: data.profile, viewAs: "astrologer" });
  },

  // ---- astrologer registration ------------------------------------------
  loadApplication: async (force = false) => {
    const { user, application, applicationLoaded, applicationLoading } = get();
    if (!user || user.role !== "Astrologer") {
      // Clients never register, so resolve without a request.
      set({ application: null, applicationLoaded: true, applicationError: false });
      return null;
    }
    if (!force && applicationLoaded) return application;
    if (applicationLoading) return application;

    set({ applicationLoading: true });
    try {
      const data = await astrologerApi.getApplication();
      set({ application: data.application, applicationLoaded: true, applicationError: false });
      return data.application;
    } catch {
      // Deliberately NOT resolved as "has no application": a failed lookup
      // must never be mistaken for "unregistered", or the register form would
      // reappear for someone who already submitted. Callers fall back to the
      // dashboard instead.
      set({ applicationLoaded: false, applicationError: true });
      return null;
    } finally {
      set({ applicationLoading: false });
    }
  },

  submitApplication: async (payload) => {
    const data = await astrologerApi.submitApplication(payload);
    set({
      application: data.application,
      applicationLoaded: true,
      applicationError: false,
      profile: data.profile,
    });
    return data;
  },

  landingPath: async () => {
    const { user } = get();
    if (user?.role === "Astrologer") {
      const application = await get().loadApplication();
      if (get().applicationError) return "/dashboard";
      return application ? "/dashboard" : "/register";
    }
    return "/dashboard";
  },

  setViewAs: (viewAs) => {
    if (viewAs === get().viewAs) return;
    localStorage.setItem(VIEW_AS_KEY, viewAs);
    // Per-view data must not bleed between the two sides, so drop the caches
    // and let the active page refetch from the new side.
    set({
      viewAs,
      stats: null,
      statsLoadedAt: null,
      bookingPages: {},
      bookingCounts: null,
      upcomingBookings: [],
      upcomingBookingsLoadedAt: null,
      questionPages: {},
      questionCounts: null,
    });
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
      const data = await usersApi.getStats(get().viewAs);
      set({ stats: data, statsLoadedAt: Date.now() });
      return data;
    } catch {
      return get().stats;
    } finally {
      set({ statsLoading: false });
    }
  },

  // ---- bookings ------------------------------------------------------------
  loadBookings: async (filter, page, sort = "latest", force = false) => {
    const key = `${filter}:${sort}:${page}`;
    const cached = get().bookingPages[key];
    if (!force && cached) {
      return cached;
    }
    set({ bookingsLoading: true });
    try {
      const status = filter === "all" ? undefined : filter;
      const offset = page * 10;
      const data = await bookingsApi.list(status, 10, offset, get().viewAs, sort);
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

  loadUpcomingBookings: async (force = false) => {
    const { upcomingBookings, upcomingBookingsLoadedAt } = get();
    // A short TTL absorbs the navbar's poll loop plus the Bookings page
    // mounting, so a page change does not immediately re-hit the endpoint.
    if (!force && upcomingBookingsLoadedAt && Date.now() - upcomingBookingsLoadedAt < UPCOMING_TTL) {
      return upcomingBookings;
    }
    set({ upcomingBookingsLoading: true });
    try {
      const data = await bookingsApi.upcoming(UPCOMING_LIMIT, get().viewAs);
      const items = data.bookings ?? [];
      set({ upcomingBookings: items, upcomingBookingsLoadedAt: Date.now() });
      return items;
    } catch {
      // Keep whatever we already had on screen rather than blanking the bell.
      return get().upcomingBookings;
    } finally {
      set({ upcomingBookingsLoading: false });
    }
  },

  // ---- questions -----------------------------------------------------------
  loadQuestions: async (filter, page, sort = "latest", force = false) => {
    const key = `${filter}:${sort}:${page}`;
    const cached = get().questionPages[key];
    if (!force && cached) {
      return cached;
    }
    set({ questionsLoading: true });
    try {
      const status = filter === "all" ? undefined : filter;
      const offset = page * 10;
      const data = await questionsApi.list(status, 10, offset, get().viewAs, sort);
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
      application: s.application,
      applicationLoading: s.applicationLoading,
      applicationLoaded: s.applicationLoaded,
      applicationError: s.applicationError,
      signin: s.signin,
      signup: s.signup,
      signout: s.signout,
      onboard: s.onboard,
      refreshProfile: s.refreshProfile,
      loadApplication: s.loadApplication,
      submitApplication: s.submitApplication,
      landingPath: s.landingPath,
    })),
  );