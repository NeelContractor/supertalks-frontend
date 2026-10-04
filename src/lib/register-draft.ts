import {
  emptyRegisterData,
  emptyService,
  SPECIALTIES,
  type RegisterFormData,
  type ServiceEntry,
} from "./register-form";

/**
 * Local draft persistence for the multi-step astrologer registration.
 *
 * The form is long (7 steps) and there is no server-side draft, so an
 * astrologer who closes the tab at "Verification" would otherwise restart at
 * step 1. We persist the entered values plus the step they were on, scoped per
 * user id so two accounts sharing a browser never see each other's draft, and
 * always drop the password/OTP rather than writing credentials to disk.
 */

export const REGISTER_DRAFT_VERSION = 1;

const KEY_PREFIX = "registerDraft:";

/** Never written to storage, even when present in the form state. */
const SECRET_FIELDS = ["password", "otp"] as const;

export interface RegisterDraft {
  /** Zero-based index into the STEPS array the astrologer last saw. */
  stepIndex: number;
  data: RegisterFormData;
}

/** Structural subset of the DOM Storage API, so tests can pass a fake. */
export interface DraftStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface StoredDraft {
  v: number;
  stepIndex: number;
  updatedAt: number;
  data: unknown;
}

const memory = new Map<string, string>();

const memoryStorage: DraftStorage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => void memory.set(key, value),
  removeItem: (key) => void memory.delete(key),
};

/** localStorage when usable (Safari private mode throws on setItem), otherwise
 *  an in-memory shim so the page never crashes and tests need no globals. */
function resolveStorage(): DraftStorage {
  try {
    if (typeof localStorage !== "undefined") {
      const probe = `${KEY_PREFIX}__probe`;
      localStorage.setItem(probe, "1");
      localStorage.removeItem(probe);
      return localStorage;
    }
  } catch {
    /* fall through to the in-memory shim */
  }
  return memoryStorage;
}

export function registerDraftKey(userId: string): string {
  return `${KEY_PREFIX}${userId}`;
}

export function clampStepIndex(stepIndex: unknown, stepCount: number): number {
  const last = Math.max(stepCount - 1, 0);
  const value =
    typeof stepIndex === "number" && Number.isFinite(stepIndex) ? Math.floor(stepIndex) : 0;
  return Math.min(Math.max(value, 0), last);
}

function normalizeServices(saved: unknown): ServiceEntry[] {
  if (!Array.isArray(saved)) return emptyRegisterData().services;

  const entries = saved
    .filter((item): item is Partial<ServiceEntry> => typeof item === "object" && item !== null)
    .map((item): ServiceEntry => {
      const base = emptyService();
      return {
        ...base,
        ...pickStrings(item, base),
        id: typeof item.id === "string" && item.id ? item.id : base.id,
        mode: item.mode === "Offline" ? "Offline" : "Online",
      };
    });

  return entries.length ? entries : emptyRegisterData().services;
}

function pickStrings(
  source: Partial<ServiceEntry>,
  base: ServiceEntry,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of Object.keys(base) as (keyof ServiceEntry)[]) {
    const value = source[key];
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

/** Rebuilds the form state from untrusted JSON: unknown/mistyped fields fall
 *  back to the blank defaults so a stale or hand-edited draft cannot break the
 *  form, and secrets stay blank. */
function normalizeData(saved: unknown): RegisterFormData {
  const base = emptyRegisterData();
  const source = (typeof saved === "object" && saved !== null ? saved : {}) as Record<
    string,
    unknown
  >;

  const data = { ...base } as Record<string, unknown>;
  for (const key of Object.keys(base) as (keyof RegisterFormData)[]) {
    const fallback = base[key];
    const value = source[key];
    if (value === undefined || value === null) continue;
    if (typeof fallback === "boolean") {
      data[key] = value === true;
    } else if (typeof fallback === "string" && typeof value === "string") {
      data[key] = value;
    }
  }

  data.services = normalizeServices(source.services);

  const savedSpecialties = Array.isArray(source.specialties) ? source.specialties : [];
  data.specialties = SPECIALTIES.filter((s) => savedSpecialties.includes(s));
  data.hasGst = source.hasGst === "yes" || source.hasGst === "no" ? source.hasGst : "";

  for (const field of SECRET_FIELDS) data[field] = "";

  return data as unknown as RegisterFormData;
}

export function saveRegisterDraft(
  userId: string,
  stepIndex: number,
  data: RegisterFormData,
  storage: DraftStorage = resolveStorage(),
): void {
  if (!userId) return;

  const payload: StoredDraft = {
    v: REGISTER_DRAFT_VERSION,
    stepIndex,
    updatedAt: Date.now(),
    // Credentials stay out of storage even if the caller passes them in.
    data: { ...data, password: "", otp: "" },
  };

  try {
    storage.setItem(registerDraftKey(userId), JSON.stringify(payload));
  } catch {
    /* quota exceeded / storage disabled — losing the draft is acceptable */
  }
}

/** Returns the saved step + values, or null when there is nothing usable. */
export function loadRegisterDraft(
  userId: string,
  stepCount: number,
  storage: DraftStorage = resolveStorage(),
): RegisterDraft | null {
  if (!userId) return null;

  let raw: string | null = null;
  try {
    raw = storage.getItem(registerDraftKey(userId));
  } catch {
    return null;
  }
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    clearRegisterDraft(userId, storage);
    return null;
  }

  const stored = parsed as Partial<StoredDraft> | null;
  if (typeof stored !== "object" || stored === null || stored.v !== REGISTER_DRAFT_VERSION) {
    clearRegisterDraft(userId, storage);
    return null;
  }

  return {
    stepIndex: clampStepIndex(stored.stepIndex, stepCount),
    data: normalizeData(stored.data),
  };
}

export function clearRegisterDraft(
  userId: string,
  storage: DraftStorage = resolveStorage(),
): void {
  if (!userId) return;
  try {
    storage.removeItem(registerDraftKey(userId));
  } catch {
    /* nothing to do */
  }
}