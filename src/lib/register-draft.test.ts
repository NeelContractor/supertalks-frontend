import { test, expect } from "bun:test";
import {
  clearRegisterDraft,
  clampStepIndex,
  loadRegisterDraft,
  registerDraftKey,
  saveRegisterDraft,
  REGISTER_DRAFT_VERSION,
  type DraftStorage,
} from "./register-draft";
import { emptyRegisterData, type RegisterFormData } from "./register-form";

function fakeStorage(seed: Record<string, string> = {}): DraftStorage & {
  dump: () => Record<string, string>;
} {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
    dump: () => Object.fromEntries(map),
  };
}

function filledData(): RegisterFormData {
  const base = emptyRegisterData();
  return {
    ...base,
    fullName: "Rahul Sharma",
    email: "rahul@example.com",
    password: "super-secret",
    otp: "123456",
    displayName: "Acharya Rahul",
    city: "Varanasi",
    languages: "Hindi, English",
    specialties: ["Vedic Astrology", "Numerology"],
    services: [{ ...base.services[0]!, id: "svc-1", name: "Marriage Consultation", price: "999" }],
    agreeTerms: true,
  };
}

const STEPS = 7;

test("round-trips the step the astrologer left on", () => {
  const storage = fakeStorage();
  saveRegisterDraft("u1", 5, filledData(), storage);

  const draft = loadRegisterDraft("u1", STEPS, storage);
  expect(draft?.stepIndex).toBe(5);
  expect(draft?.data.displayName).toBe("Acharya Rahul");
  expect(draft?.data.services[0]?.name).toBe("Marriage Consultation");
  expect(draft?.data.agreeTerms).toBe(true);
});

test("returns null when the user has no draft", () => {
  expect(loadRegisterDraft("u1", STEPS, fakeStorage())).toBeNull();
});

test("drafts are scoped per user id", () => {
  const storage = fakeStorage();
  saveRegisterDraft("u1", 3, filledData(), storage);
  saveRegisterDraft("u2", 0, emptyRegisterData(), storage);

  expect(loadRegisterDraft("u1", STEPS, storage)?.stepIndex).toBe(3);
  expect(loadRegisterDraft("u2", STEPS, storage)?.stepIndex).toBe(0);
  expect(Object.keys(storage.dump())).toEqual([registerDraftKey("u1"), registerDraftKey("u2")]);
});

test("never persists the password or OTP", () => {
  const storage = fakeStorage();
  saveRegisterDraft("u1", 1, filledData(), storage);

  expect(storage.dump()[registerDraftKey("u1")]).not.toContain("super-secret");
  expect(storage.dump()[registerDraftKey("u1")]).not.toContain("123456");

  const restored = loadRegisterDraft("u1", STEPS, storage);
  expect(restored?.data.password).toBe("");
  expect(restored?.data.otp).toBe("");
});

test("falls back to the default storage when localStorage is unavailable", () => {
  saveRegisterDraft("fallback-user", 2, filledData());
  const draft = loadRegisterDraft("fallback-user", STEPS);
  expect(draft?.stepIndex).toBe(2);
  clearRegisterDraft("fallback-user");
  expect(loadRegisterDraft("fallback-user", STEPS)).toBeNull();
});

test("clamps an out-of-range step instead of rendering a blank step", () => {
  const storage = fakeStorage();
  saveRegisterDraft("u1", 99, filledData(), storage);
  expect(loadRegisterDraft("u1", STEPS, storage)?.stepIndex).toBe(STEPS - 1);

  saveRegisterDraft("u1", -4, filledData(), storage);
  expect(loadRegisterDraft("u1", STEPS, storage)?.stepIndex).toBe(0);

  expect(clampStepIndex(3.7, STEPS)).toBe(3);
  expect(clampStepIndex(Number.NaN, STEPS)).toBe(0);
  expect(clampStepIndex("2", STEPS)).toBe(0);
});

test("discards a corrupt or outdated draft", () => {
  const broken = fakeStorage({ [registerDraftKey("u1")]: "{not json" });
  expect(loadRegisterDraft("u1", STEPS, broken)).toBeNull();
  expect(broken.dump()[registerDraftKey("u1")]).toBeUndefined();

  const stale = fakeStorage({
    [registerDraftKey("u1")]: JSON.stringify({ v: REGISTER_DRAFT_VERSION + 1, stepIndex: 2, data: {} }),
  });
  expect(loadRegisterDraft("u1", STEPS, stale)).toBeNull();
});

test("repairs malformed values with the blank defaults", () => {
  const storage = fakeStorage({
    [registerDraftKey("u1")]: JSON.stringify({
      v: REGISTER_DRAFT_VERSION,
      stepIndex: 2,
      updatedAt: Date.now(),
      data: {
        fullName: 42,
        ageConfirmed: "yes",
        hasGst: "maybe",
        specialties: ["Vedic Astrology", "Underwater Basket-Weaving"],
        services: [{ name: "No id here" }, "junk"],
        brandNewField: "ignored",
      },
    }),
  });

  const draft = loadRegisterDraft("u1", STEPS, storage);
  const data = draft!.data;

  expect(data.fullName).toBe("");
  expect(data.ageConfirmed).toBe(false);
  expect(data.hasGst).toBe("");
  expect(data.specialties).toEqual(["Vedic Astrology"]);
  expect(data.services).toHaveLength(1);
  expect(data.services[0]?.id).toBeString();
  expect(data.services[0]?.name).toBe("No id here");
  expect(data.services[0]?.mode).toBe("Online");
});

test("clear removes only the given user's draft", () => {
  const storage = fakeStorage();
  saveRegisterDraft("u1", 1, filledData(), storage);
  saveRegisterDraft("u2", 1, filledData(), storage);

  clearRegisterDraft("u1", storage);
  expect(loadRegisterDraft("u1", STEPS, storage)).toBeNull();
  expect(loadRegisterDraft("u2", STEPS, storage)?.stepIndex).toBe(1);
});

test("ignores a missing user id", () => {
  const storage = fakeStorage();
  saveRegisterDraft("", 3, filledData(), storage);
  expect(loadRegisterDraft("", STEPS, storage)).toBeNull();
  expect(storage.dump()).toEqual({});
});