import type { AstrologerProfile } from "@/types";

export interface ProfileSetupMissing {
  name?: boolean;
  bio?: boolean;
  specializations?: boolean;
  languages?: boolean;
  experienceYears?: boolean;
  questionPricePaise?: boolean;
  callPricePerSlotPaise?: boolean;
  hasAvailabilityRule?: boolean;
}

export interface ProfileSetupStatus {
  complete: boolean;
  missing: string[];
}

function isNonEmptyString(s: string | null | undefined) {
  return !!s && s.trim().length > 0;
}

function isNonEmptyArray<T>(arr: T[] | undefined | null) {
  return !!arr && arr.length > 0;
}

export function getProfileSetupStatus(
  profile: AstrologerProfile | null | undefined,
  ruleCount: number,
): ProfileSetupStatus {
  if (!profile) {
    return {
      complete: false,
      missing: [
        "name",
        "bio",
        "specializations",
        "languages",
        "experienceYears",
        "pricing",
        "availability",
      ],
    };
  }

  const missing: string[] = [];

  // Note: name lives on User, not on AstrologerProfile. We treat name as present
  // only when passed in via a future check; this helper focuses on profile fields.
  // Callers may augment missing based on user.name.
  if (!isNonEmptyString(profile.bio)) missing.push("bio");
  if (!isNonEmptyArray(profile.specializations)) missing.push("specializations");
  if (!isNonEmptyArray(profile.languages)) missing.push("languages");
  if (profile.experienceYears == null || profile.experienceYears < 0) missing.push("experienceYears");
  if (!profile.questionPricePaise || profile.questionPricePaise <= 0) missing.push("questionPrice");
  if (!profile.callPricePerSlotPaise || profile.callPricePerSlotPaise <= 0) missing.push("callPrice");
  if (ruleCount <= 0) missing.push("availability");

  return {
    complete: missing.length === 0,
    missing,
  };
}