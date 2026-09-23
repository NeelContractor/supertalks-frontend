import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Textarea } from "@/components/ui/textarea";
import {
    InputOTP,
    InputOTPGroup,
    InputOTPSeparator,
    InputOTPSlot,
} from "@/components/ui/input-otp"

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Specialty =
  | "Vedic Astrology"
  | "Tarot"
  | "Numerology"
  | "Vastu"
  | "Lal Kitab"
  | "KP Astrology";

const SPECIALTIES: Specialty[] = [
  "Vedic Astrology",
  "Tarot",
  "Numerology",
  "Vastu",
  "Lal Kitab",
  "KP Astrology",
];

type ServiceMode = "Online" | "Offline";

interface ServiceEntry {
  id: string;
  name: string;
  description: string;
  duration: string;
  price: string;
  mode: ServiceMode;
  availableDays: string;
  availableTime: string;
}

interface RegisterFormData {
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

const emptyService = (): ServiceEntry => ({
  id: crypto.randomUUID(),
  name: "",
  description: "",
  duration: "",
  price: "",
  mode: "Online",
  availableDays: "",
  availableTime: "",
});

const initialData: RegisterFormData = {
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

/* ------------------------------------------------------------------ */
/*  Step config                                                        */
/* ------------------------------------------------------------------ */

interface StepConfig {
  key: string;
  label: string;
  hint: string;
}

const STEPS: StepConfig[] = [
  { key: "account", label: "Account", hint: "Sign-up basics" },
  { key: "profile", label: "Profile", hint: "Your public page" },
  { key: "website", label: "Website", hint: "How it's presented" },
  { key: "services", label: "Services", hint: "What you offer" },
  { key: "payment", label: "Payment", hint: "Where you get paid" },
  { key: "kyc", label: "Verification", hint: "Prove it's you" },
  { key: "review", label: "Review", hint: "Agreements & submit" },
];

/* ------------------------------------------------------------------ */
/*  Small field primitives                                             */
/* ------------------------------------------------------------------ */

function Field(props: {
  label: string;
  required?: boolean;
  optional?: boolean;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>
        {props.label}
        {props.required && <span className="text-primary"> *</span>}
        {props.optional && (
          <span className="text-xs font-normal text-muted-foreground"> (optional)</span>
        )}
      </Label>
      {props.hint && <p className="text-xs text-muted-foreground">{props.hint}</p>}
      <div>{props.children}</div>
    </div>
  );
}

function TextInput(props: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  accept?: string;
}) {
  if (props.type === "password") {
    return (
      <PasswordInput
        className="bg-background"
        value={props.value}
        placeholder={props.placeholder}
        onChange={(e) => props.onChange(e.target.value)}
      />
    );
  }
  return (
    <Input
      type={props.type ?? "text"}
      accept={props.accept}
      className="bg-background"
      value={props.value}
      placeholder={props.placeholder}
      onChange={(e) => props.onChange(e.target.value)}
    />
  );
}

function TextArea(props: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
}) {
  return (
    <div className="space-y-1.5">
      <Textarea
        className="bg-background resize-none"
        rows={props.rows ?? 3}
        value={props.value}
        placeholder={props.placeholder}
        maxLength={props.maxLength}
        onChange={(e) => props.onChange(e.target.value)}
      />
      {props.maxLength ? (
        <div className="flex justify-end">
          <span className="text-xs tabular-nums text-muted-foreground">
            {props.value.length} / {props.maxLength}
          </span>
        </div>
      ) : null}
    </div>
  );
}

function SectionTitle(props: { title: string; description?: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-2xl font-semibold tracking-tight text-foreground">{props.title}</h2>
      {props.description && (
        <p className="mt-1.5 text-sm text-muted-foreground">{props.description}</p>
      )}
    </div>
  );
}

function SubGroup(props: { title: string; children: ReactNode }) {
  return (
    <div className="mb-6 border-l-2 border-border pl-4">
      <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {props.title}
      </h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{props.children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function Register() {
  const [stepIndex, setStepIndex] = useState(0);
  const [data, setData] = useState<RegisterFormData>(initialData);
  const [submitted, setSubmitted] = useState(false);

  const update = <K extends keyof RegisterFormData>(key: K, value: RegisterFormData[K]) =>
    setData((prev) => ({ ...prev, [key]: value }));

  const toggleSpecialty = (s: Specialty) =>
    setData((prev) => ({
      ...prev,
      specialties: prev.specialties.includes(s)
        ? prev.specialties.filter((x) => x !== s)
        : [...prev.specialties, s],
    }));

  const updateService = (id: string, patch: Partial<ServiceEntry>) =>
    setData((prev) => ({
      ...prev,
      services: prev.services.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }));

  const addService = () =>
    setData((prev) => ({ ...prev, services: [...prev.services, emptyService()] }));

  const removeService = (id: string) =>
    setData((prev) => ({
      ...prev,
      services: prev.services.length > 1 ? prev.services.filter((s) => s.id !== id) : prev.services,
    }));

  const step = STEPS[stepIndex]!;
  const isLast = stepIndex === STEPS.length - 1;
  const isFirst = stepIndex === 0;

  const goNext = () => setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  const goBack = () => setStepIndex((i) => Math.max(i - 1, 0));

  const canSubmit =
    data.agreeTerms &&
    data.agreePrivacy &&
    data.agreeDisclaimer &&
    data.agreeRefund &&
    data.agreeAccuracy;

  const handleSubmit = () => {
    if (!canSubmit) return;
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path
                d="M5 12.5L10 17.5L19 6.5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-foreground">Submitted for review</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Your profile is now in <span className="font-medium text-primary">Under Review</span>.
            We'll notify you at {data.email || "your registered email"} once it's approved and
            published.
          </p>
          <Button
            variant="outline"
            className="mt-6"
            onClick={() => {
              setSubmitted(false);
              setStepIndex(0);
            }}
          >
            Edit application
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <p className="text-xs font-medium uppercase tracking-wide text-primary">
            Astrologer registration
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
            Set up your practice on the platform
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Seven short steps — your work saves as a draft until you submit it for review.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[220px_1fr]">
          {/* Stepper / tabs */}
          <nav aria-label="Registration steps" className="lg:sticky lg:top-10 lg:self-start">
            <ol className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0">
              {STEPS.map((s, i) => {
                const state =
                  i === stepIndex ? "current" : i < stepIndex ? "done" : "upcoming";
                return (
                  <li key={s.key} className="shrink-0 lg:shrink">
                    <button
                      onClick={() => setStepIndex(i)}
                      className={
                        "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors " +
                        (state === "current"
                          ? "bg-muted text-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground")
                      }
                    >
                      <span
                        className={
                          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium " +
                          (state === "done"
                            ? "bg-primary text-primary-foreground"
                            : state === "current"
                            ? "border border-primary text-primary"
                            : "border border-border text-muted-foreground")
                        }
                      >
                        {state === "done" ? "✓" : i + 1}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{s.label}</span>
                        <span className="hidden truncate text-xs text-muted-foreground lg:block">
                          {s.hint}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>

          {/* Panel */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
            {step.key === "account" && (
              <>
                <SectionTitle
                  title="Create your account"
                  description="This is your private login — it won't appear on your public profile."
                />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Full name" required>
                    <TextInput value={data.fullName} onChange={(v) => update("fullName", v)} />
                  </Field>
                  <Field label="Country" required>
                    <TextInput value={data.country} onChange={(v) => update("country", v)} />
                  </Field>
                  <Field label="Mobile number" required>
                    <TextInput
                    type="number"
                      value={data.mobile}
                      onChange={(v) => update("mobile", v)}
                      placeholder="+91"
                    />
                  </Field>
                  <Field label="OTP" required hint="Sent to your mobile number">
                    {/* <TextInput value={data.otp} onChange={(v) => update("otp", v)} /> */}
                    <InputOTP maxLength={6}>
                        <InputOTPGroup>
                            <InputOTPSlot index={0} />
                            <InputOTPSlot index={1} />
                            <InputOTPSlot index={2} />
                        </InputOTPGroup>
                        <InputOTPSeparator />
                        <InputOTPGroup>
                            <InputOTPSlot index={3} />
                            <InputOTPSlot index={4} />
                            <InputOTPSlot index={5} />
                        </InputOTPGroup>
                    </InputOTP>
                  </Field>
                  <Field label="Email" required>
                    <TextInput
                      type="email"
                      value={data.email}
                      onChange={(v) => update("email", v)}
                    />
                  </Field>
                  <Field label="Password" required>
                    <TextInput
                      type="password"
                      value={data.password}
                      onChange={(v) => update("password", v)}
                    />
                  </Field>
                </div>
                <div className="mt-5 space-y-3">
                  <label className="flex items-start gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 accent-primary"
                      checked={data.ageConfirmed}
                      onChange={(e) => update("ageConfirmed", e.target.checked)}
                    />
                    I confirm I am 18 years of age or older.
                  </label>
                  <label className="flex items-start gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 accent-primary"
                      checked={data.infoAccurate}
                      onChange={(e) => update("infoAccurate", e.target.checked)}
                    />
                    I confirm that the information provided by me is accurate and that I am
                    legally eligible to provide my services.
                  </label>
                </div>
              </>
            )}

            {step.key === "profile" && (
              <>
                <SectionTitle
                  title="Build your astrologer profile"
                  description="This becomes your public-facing profile."
                />
                <SubGroup title="Required">
                  <Field label="Display name" required>
                    <TextInput
                      value={data.displayName}
                      onChange={(v) => update("displayName", v)}
                    />
                  </Field>
                  <Field label="Profile photo" required>
                    <TextInput
                      type="file"
                      accept="image/*"
                      value={data.profilePhoto}
                      onChange={(v) => update("profilePhoto", v)}
                      placeholder="Upload URL or file name"
                    />
                  </Field>
                  <Field label="City" required>
                    <TextInput value={data.city} onChange={(v) => update("city", v)} />
                  </Field>
                  <Field label="Languages" required hint="Comma-separated">
                    <TextInput
                      value={data.languages}
                      onChange={(v) => update("languages", v)}
                      placeholder="Hindi, English, Gujarati"
                    />
                  </Field>
                  <Field label="Gender" optional>
                    <TextInput value={data.gender} onChange={(v) => update("gender", v)} />
                  </Field>
                  <Field label="Years of experience" required>
                    <TextInput
                      type="number"
                      value={data.yearsExperience}
                      onChange={(v) => update("yearsExperience", v)}
                    />
                  </Field>
                </SubGroup>

                <div className="mb-6">
                  <span className="mb-2 block text-sm font-medium text-foreground">
                    Astrology specialties <span className="text-primary">*</span>
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {SPECIALTIES.map((s) => {
                      const active = data.specialties.includes(s);
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => toggleSpecialty(s)}
                          className={
                            "rounded-full border px-3 py-1.5 text-sm transition-colors " +
                            (active
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border text-muted-foreground hover:border-primary hover:text-primary")
                          }
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mb-6 grid grid-cols-1 gap-4">
                  <Field label="Short bio" required hint="One or two sentences">
                    <TextArea
                      value={data.shortBio}
                      onChange={(v) => update("shortBio", v)}
                      rows={2}
                      maxLength={100}
                    />
                  </Field>
                  <Field label="Detailed introduction" required>
                    <TextArea
                      value={data.detailedIntro}
                      onChange={(v) => update("detailedIntro", v)}
                      rows={4}
                      maxLength={200}
                    />
                  </Field>
                </div>

                <SubGroup title="Optional">
                  <Field label="Education" optional>
                    <TextInput value={data.education} onChange={(v) => update("education", v)} />
                  </Field>
                  <Field label="Astrology certification" optional>
                    <TextInput
                      value={data.certification}
                      onChange={(v) => update("certification", v)}
                    />
                  </Field>
                  <Field label="Guru / lineage" optional>
                    <TextInput
                      value={data.guruLineage}
                      onChange={(v) => update("guruLineage", v)}
                    />
                  </Field>
                  <Field label="Other astrology platforms" optional>
                    <TextInput
                      value={data.otherPlatforms}
                      onChange={(v) => update("otherPlatforms", v)}
                    />
                  </Field>
                  <Field label="Instagram" optional>
                    <TextInput value={data.instagram} onChange={(v) => update("instagram", v)} />
                  </Field>
                  <Field label="YouTube" optional>
                    <TextInput value={data.youtube} onChange={(v) => update("youtube", v)} />
                  </Field>
                  <Field label="Facebook" optional>
                    <TextInput value={data.facebook} onChange={(v) => update("facebook", v)} />
                  </Field>
                  <Field label="Website" optional>
                    <TextInput value={data.website} onChange={(v) => update("website", v)} />
                  </Field>
                </SubGroup>
              </>
            )}

            {step.key === "website" && (
              <>
                <SectionTitle
                  title="Set up your website"
                  description="Specific to your personal booking page."
                />
                <Field label="Website URL" required hint="e.g. rahul.yourplatform.com">
                  <TextInput value={data.websiteUrl} onChange={(v) => update("websiteUrl", v)} />
                </Field>

                <SubGroup title="Hero section">
                  <Field label="Headline" required>
                    <TextInput
                      value={data.heroHeadline}
                      onChange={(v) => update("heroHeadline", v)}
                    />
                  </Field>
                  <Field label="Short description" required>
                    <TextInput
                      value={data.heroDescription}
                      onChange={(v) => update("heroDescription", v)}
                    />
                  </Field>
                  <Field label="Profile photo" required>
                    <TextInput
                        type="file"
                        accept="image/*"
                        value={data.profilePhoto}
                        onChange={(v) => update("profilePhoto", v)}
                    />
                  </Field>
                  <Field label="Cover / banner image" required>
                    <TextInput
                        type="file"
                        accept="image/*"
                        value={data.coverImage}
                        onChange={(v) => update("coverImage", v)}
                    />
                  </Field>
                </SubGroup>

                <SubGroup title="About">
                  <Field label="About me" required>
                    <TextArea value={data.aboutMe} onChange={(v) => update("aboutMe", v)} maxLength={100} />
                  </Field>
                  <Field label="Experience" required>
                    <TextArea
                      value={data.aboutExperience}
                      onChange={(v) => update("aboutExperience", v)}
                    />
                  </Field>
                  <div className="sm:col-span-2">
                    <Field label="Approach / methodology" required>
                      <TextArea value={data.approach} onChange={(v) => update("approach", v)} maxLength={100} />
                    </Field>
                  </div>
                </SubGroup>

                <SubGroup title="Contact">
                  <Field label="WhatsApp number" required>
                    <TextInput type="number" value={data.whatsapp} onChange={(v) => update("whatsapp", v)} />
                  </Field>
                  <Field label="Email" required>
                    <TextInput
                      type="email"
                      value={data.contactEmail}
                      onChange={(v) => update("contactEmail", v)}
                    />
                  </Field>
                </SubGroup>

                <SubGroup title="Location">
                  <Field label="City" required>
                    <TextInput value={data.siteCity} onChange={(v) => update("siteCity", v)} />
                  </Field>
                  <Field label="Country" required hint="Full home address stays private">
                    <TextInput
                      value={data.siteCountry}
                      onChange={(v) => update("siteCountry", v)}
                    />
                  </Field>
                </SubGroup>
              </>
            )}

            {step.key === "services" && (
              <>
                <SectionTitle
                  title="List your services"
                  description="Your website revolves around booking — add every service you offer."
                />
                <div className="space-y-5">
                  {data.services.map((svc, idx) => (
                    <div
                      key={svc.id}
                      className="rounded-lg border border-border bg-background p-5"
                    >
                      <div className="mb-4 flex items-center justify-between">
                        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Service {idx + 1}
                        </span>
                        {data.services.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => removeService(svc.id)}
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Field label="Service name" required>
                          <TextInput
                            value={svc.name}
                            onChange={(v) => updateService(svc.id, { name: v })}
                            placeholder="Marriage Consultation"
                          />
                        </Field>
                        <Field label="Duration" required>
                          <TextInput
                            value={svc.duration}
                            onChange={(v) => updateService(svc.id, { duration: v })}
                            placeholder="30 minutes"
                          />
                        </Field>
                        <div className="sm:col-span-2">
                          <Field label="Description" required>
                            <TextArea
                              value={svc.description}
                              onChange={(v) => updateService(svc.id, { description: v })}
                              rows={2}
                              maxLength={100}
                            />
                          </Field>
                        </div>
                        <Field label="Price" required>
                          <TextInput
                            type="number"
                            value={svc.price}
                            onChange={(v) => updateService(svc.id, { price: v })}
                            placeholder="₹999"
                          />
                        </Field>
                        <Field label="Mode" required>
                          <div className="flex gap-2">
                            {(["Online", "Offline"] as ServiceMode[]).map((m) => (
                              <button
                                key={m}
                                type="button"
                                onClick={() => updateService(svc.id, { mode: m })}
                                className={
                                  "flex-1 rounded-md border px-3 py-2 text-sm transition-colors " +
                                  (svc.mode === m
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-border text-muted-foreground hover:border-primary hover:text-primary")
                                }
                              >
                                {m}
                              </button>
                            ))}
                          </div>
                        </Field>
                        <Field label="Available days" required>
                          <TextInput
                            value={svc.availableDays}
                            onChange={(v) => updateService(svc.id, { availableDays: v })}
                            placeholder="Mon–Sat"
                          />
                        </Field>
                        <Field label="Available time" required>
                          <TextInput
                            value={svc.availableTime}
                            onChange={(v) => updateService(svc.id, { availableTime: v })}
                            placeholder="6 PM – 10 PM"
                          />
                        </Field>
                      </div>
                    </div>
                  ))}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="mt-4 border-dashed"
                  onClick={addService}
                >
                  + Add another service
                </Button>

                <p className="mt-4 text-xs text-muted-foreground">
                  Also supported: 1:1 consultation, package, follow-up session, and per-minute
                  consultation formats.
                </p>
              </>
            )}

            {step.key === "payment" && (
              <>
                <SectionTitle
                  title="Payment & business details"
                  description="Kept separate from your public profile."
                />
                <SubGroup title="Legal">
                  <Field label="Legal name" required>
                    <TextInput value={data.legalName} onChange={(v) => update("legalName", v)} />
                  </Field>
                  <Field label="PAN" required>
                    <TextInput value={data.pan} onChange={(v) => update("pan", v)} />
                  </Field>
                  <Field label="Business / entity name" optional>
                    <TextInput
                      value={data.businessName}
                      onChange={(v) => update("businessName", v)}
                    />
                  </Field>
                </SubGroup>

                <div className="mb-6">
                  <span className="mb-2 block text-sm font-medium text-foreground">
                    Do you have GST registration?
                  </span>
                  <div className="flex gap-2">
                    {(["yes", "no"] as const).map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => update("hasGst", opt)}
                        className={
                          "rounded-md border px-4 py-2 text-sm capitalize transition-colors " +
                          (data.hasGst === opt
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border text-muted-foreground hover:border-primary hover:text-primary")
                        }
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                  {data.hasGst === "yes" && (
                    <div className="mt-3 max-w-sm">
                      <Field label="GSTIN" required>
                        <TextInput value={data.gstin} onChange={(v) => update("gstin", v)} />
                      </Field>
                    </div>
                  )}
                  {data.hasGst === "no" && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      You can continue without GSTIN, subject to the applicable tax rules for
                      your turnover and state.
                    </p>
                  )}
                </div>

                <SubGroup title="Bank details">
                  <Field label="Account holder name" required>
                    <TextInput
                      value={data.bankAccountHolder}
                      onChange={(v) => update("bankAccountHolder", v)}
                    />
                  </Field>
                  <Field label="Account number" required>
                    <TextInput
                      value={data.bankAccountNumber}
                      onChange={(v) => update("bankAccountNumber", v)}
                    />
                  </Field>
                  <Field label="IFSC" required>
                    <TextInput value={data.ifsc} onChange={(v) => update("ifsc", v)} />
                  </Field>
                  <Field label="UPI ID" optional>
                    <TextInput value={data.upi} onChange={(v) => update("upi", v)} />
                  </Field>
                  <div className="sm:col-span-2">
                    <Field label="Billing address" required>
                      <TextArea
                        value={data.billingAddress}
                        onChange={(v) => update("billingAddress", v)}
                        rows={2}
                      />
                    </Field>
                  </div>
                </SubGroup>
              </>
            )}

            {step.key === "kyc" && (
              <>
                <SectionTitle
                  title="Verification"
                  description="Basic verification is required to publish; professional verification can follow later."
                />
                <SubGroup title="Basic verification — required">
                  <Field label="PAN" required>
                    <TextInput value={data.kycPan} onChange={(v) => update("kycPan", v)} />
                  </Field>
                  <Field label="Government ID" required>
                    <TextInput value={data.govId} onChange={(v) => update("govId", v)} />
                  </Field>
                </SubGroup>

                <div className="mb-6 flex flex-col gap-3">
                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-primary"
                      checked={data.selfieUploaded}
                      onChange={(e) => update("selfieUploaded", e.target.checked)}
                    />
                    Selfie / face verification completed
                  </label>
                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-primary"
                      checked={data.bankVerified}
                      onChange={(e) => update("bankVerified", e.target.checked)}
                    />
                    Bank account verified
                  </label>
                </div>

                <SubGroup title="Professional verification — optional for now">
                  <Field label="Astrology certificate" optional>
                    <TextInput
                      value={data.astrologyCertificate}
                      onChange={(v) => update("astrologyCertificate", v)}
                    />
                  </Field>
                  <Field label="Diploma" optional>
                    <TextInput value={data.diploma} onChange={(v) => update("diploma", v)} />
                  </Field>
                  <Field label="Training certificate" optional>
                    <TextInput
                      value={data.trainingCertificate}
                      onChange={(v) => update("trainingCertificate", v)}
                    />
                  </Field>
                  <Field label="Experience proof" optional>
                    <TextInput
                      value={data.experienceProof}
                      onChange={(v) => update("experienceProof", v)}
                    />
                  </Field>
                  <Field label="Existing platform profile" optional>
                    <TextInput
                      value={data.existingProfile}
                      onChange={(v) => update("existingProfile", v)}
                    />
                  </Field>
                </SubGroup>
              </>
            )}

            {step.key === "review" && (
              <>
                <SectionTitle
                  title="Agreements & submission"
                  description="Your profile stays in Draft until it passes review — it won't go live automatically."
                />
                <div className="mb-6 space-y-3">
                  {[
                    { key: "agreeTerms" as const, label: "Astrologer Terms" },
                    { key: "agreePrivacy" as const, label: "Privacy Policy" },
                    { key: "agreeDisclaimer" as const, label: "Platform Disclaimer" },
                    { key: "agreeRefund" as const, label: "Refund / Cancellation Policy" },
                    {
                      key: "agreeAccuracy" as const,
                      label: "I confirm the information provided is accurate",
                    },
                  ].map((item) => (
                    <label
                      key={item.key}
                      className="flex items-center gap-2 text-sm text-foreground"
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-primary"
                        checked={data[item.key]}
                        onChange={(e) => update(item.key, e.target.checked)}
                      />
                      {item.label}
                    </label>
                  ))}
                </div>

                <div className="mb-6 rounded-lg border border-border bg-background p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Application status
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    {["Draft", "Under Review", "Approved", "Published"].map((s, i) => (
                      <span key={s} className="flex items-center gap-2">
                        <span
                          className={
                            i === 0
                              ? "rounded-full bg-primary/10 px-2.5 py-1 text-primary"
                              : "rounded-full px-2.5 py-1 text-muted-foreground"
                          }
                        >
                          {s}
                        </span>
                        {i < 3 && <span className="text-muted-foreground">→</span>}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button type="button" variant="outline" className="flex-1">
                    Preview website
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={!canSubmit}
                    className="flex-1"
                  >
                    Submit for review
                  </Button>
                </div>
              </>
            )}

            {/* Step nav */}
            {step.key !== "review" && (
              <div className="mt-8 flex items-center justify-between border-t border-border pt-5">
                <Button
                  variant="ghost"
                  onClick={goBack}
                  disabled={isFirst}
                  className="disabled:opacity-0"
                >
                  ← Back
                </Button>
                <Button onClick={goNext}>{isLast ? "Continue" : "Next"} →</Button>
              </div>
            )}
            {step.key === "review" && !isFirst && (
              <div className="mt-5 flex items-center border-t border-border pt-5">
                <Button variant="ghost" onClick={goBack}>
                  ← Back
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}