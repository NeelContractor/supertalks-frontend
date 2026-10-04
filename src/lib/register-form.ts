/** Shared shape of the astrologer registration form. Lives outside the page so
 *  both the UI (Register.tsx) and the draft persistence layer
 *  (register-draft.ts) can use it without a circular import. */

export type Specialty =
  | "Vedic Astrology"
  | "Tarot"
  | "Numerology"
  | "Vastu"
  | "Lal Kitab"
  | "KP Astrology";

export const SPECIALTIES: Specialty[] = [
  "Vedic Astrology",
  "Tarot",
  "Numerology",
  "Vastu",
  "Lal Kitab",
  "KP Astrology",
];

export type ServiceMode = "Online" | "Offline";

export interface ServiceEntry {
  id: string;
  name: string;
  description: string;
  duration: string;
  price: string;
  mode: ServiceMode;
  availableDays: string;
  availableTime: string;
}

export interface RegisterFormData {
  // Step 1 — Account
  fullName: string;
  mobile: string;
  otp: string;
  email: string;
  password: string;
  country: string;
  ageConfirmed: boolean;
  infoAccurate: boolean;

  // Step 2 — Astrologer profile
  displayName: string;
  profilePhoto: string;
  city: string;
  languages: string;
  gender: string;
  yearsExperience: string;
  specialties: Specialty[];
  shortBio: string;
  detailedIntro: string;
  education: string;
  certification: string;
  guruLineage: string;
  otherPlatforms: string;
  instagram: string;
  youtube: string;
  facebook: string;
  website: string;

  // Step 3 — Website information
  websiteUrl: string;
  heroHeadline: string;
  heroDescription: string;
  coverImage: string;
  aboutMe: string;
  aboutExperience: string;
  approach: string;
  whatsapp: string;
  contactEmail: string;
  siteCity: string;
  siteCountry: string;

  // Step 4 — Services
  services: ServiceEntry[];

  // Step 5 — Payment / business
  legalName: string;
  pan: string;
  hasGst: "yes" | "no" | "";
  gstin: string;
  businessName: string;
  bankAccountHolder: string;
  bankAccountNumber: string;
  ifsc: string;
  upi: string;
  billingAddress: string;

  // Step 6 — KYC
  kycPan: string;
  govId: string;
  selfieUploaded: boolean;
  bankVerified: boolean;
  astrologyCertificate: string;
  diploma: string;
  trainingCertificate: string;
  experienceProof: string;
  existingProfile: string;

  // Step 7 — Agreements
  agreeTerms: boolean;
  agreePrivacy: boolean;
  agreeDisclaimer: boolean;
  agreeRefund: boolean;
  agreeAccuracy: boolean;
}

export function emptyService(): ServiceEntry {
  return {
    id: crypto.randomUUID(),
    name: "",
    description: "",
    duration: "",
    price: "",
    mode: "Online",
    availableDays: "",
    availableTime: "",
  };
}

export function emptyRegisterData(): RegisterFormData {
  return {
    fullName: "",
    mobile: "",
    otp: "",
    email: "",
    password: "",
    country: "",
    ageConfirmed: false,
    infoAccurate: false,

    displayName: "",
    profilePhoto: "",
    city: "",
    languages: "",
    gender: "",
    yearsExperience: "",
    specialties: [],
    shortBio: "",
    detailedIntro: "",
    education: "",
    certification: "",
    guruLineage: "",
    otherPlatforms: "",
    instagram: "",
    youtube: "",
    facebook: "",
    website: "",

    websiteUrl: "",
    heroHeadline: "",
    heroDescription: "",
    coverImage: "",
    aboutMe: "",
    aboutExperience: "",
    approach: "",
    whatsapp: "",
    contactEmail: "",
    siteCity: "",
    siteCountry: "",

    services: [emptyService()],

    legalName: "",
    pan: "",
    hasGst: "",
    gstin: "",
    businessName: "",
    bankAccountHolder: "",
    bankAccountNumber: "",
    ifsc: "",
    upi: "",
    billingAddress: "",

    kycPan: "",
    govId: "",
    selfieUploaded: false,
    bankVerified: false,
    astrologyCertificate: "",
    diploma: "",
    trainingCertificate: "",
    experienceProof: "",
    existingProfile: "",

    agreeTerms: false,
    agreePrivacy: false,
    agreeDisclaimer: false,
    agreeRefund: false,
    agreeAccuracy: false,
  };
}