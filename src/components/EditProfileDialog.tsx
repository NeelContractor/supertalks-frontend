import { useEffect, useRef, useState } from "react";
import { useStore } from "@/store";
import { astrologerApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, TriangleAlert, Upload, Loader2, X } from "lucide-react";
import { uploadImageToCloudinary } from "@/lib/cloudinary";
import {
  DAYS,
  type ClashDialog,
  type ExceptionClash,
  type RuleClash,
  daysInRange,
  formatDayRange,
  formatExceptionWindow,
  formatRuleWindow,
  groupRulesByDaySet,
  readClash,
} from "@/lib/availability";

export type EditSection = "account" | "bio" | "pricing" | "availability" | "exceptions";

/** Day-set shortcuts; individual days stay clickable for anything unusual. */
const DAY_PRESETS = [
  { label: "Every day", days: daysInRange(0, 6) },
  { label: "Weekdays (Mon - Fri)", days: daysInRange(1, 5) },
  { label: "Weekend (Sun, Sat)", days: [0, 6] },
  { label: "Mon - Wed", days: daysInRange(1, 3) },
  { label: "Thu - Sat", days: daysInRange(4, 6) },
];

/** Rupees typed in the pricing fields -> paise, or null when unusable. */
function parseRupees(value: string): number | null {
  const amount = parseFloat(value);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 100);
}

function splitList(value: string): string[] {
  return value
    ? value
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean)
    : [];
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-lg border p-4">
      <div className="space-y-1">
        <h3 className="font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

/**
 * Profile photo picker. The file goes straight to Cloudinary with a signed
 * upload and only the resulting CDN URL is stored, which is the same path the
 * website editor uses for its images. Asking for a URL instead would make the
 * astrologer host the photo somewhere themselves before they could set it.
 */
function PhotoUpload({
  value,
  onChange,
  inputId,
}: {
  value: string;
  onChange: (url: string) => void;
  inputId: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  // Tracking *which* URL failed, rather than a boolean, so a fresh upload shows
  // immediately instead of flashing the fallback for a frame.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      onChange(await uploadImageToCloudinary(file));
      toast.success("Image uploaded");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Image upload failed");
    } finally {
      setUploading(false);
      // Reset so picking the same file twice in a row still fires a change.
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const hasPhoto = value !== "" && failedUrl !== value;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4">
        {hasPhoto ? (
          <img
            src={value}
            alt="Profile photo preview"
            className="h-16 w-16 rounded-full border object-cover"
            onError={() => setFailedUrl(value)}
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-dashed bg-muted/40 text-[10px] text-muted-foreground">
            {value ? "Unavailable" : "No photo"}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <Loader2 className="animate-spin" /> : <Upload />}
            {uploading ? "Uploading..." : hasPhoto ? "Replace Image" : "Upload Image"}
          </Button>
          {value ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange("")}
            >
              <X className="text-destructive" />
              Remove
            </Button>
          ) : null}
        </div>
      </div>
      {/* Labelled so clicking the field text opens the picker as well. */}
      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </div>
  );
}

interface EditProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Section to land on when the dialog opens, e.g. the incomplete one. */
  initialSection?: EditSection;
}

/**
 * The single place an astrologer edits their profile. The profile page behind
 * it is a read-only overview, so everything writable - account details, bio,
 * pricing, weekly availability and date exceptions - lives in here, split into
 * tabs because the whole set is too long for one dialog on a phone.
 *
 * Each section saves on its own rather than sharing one footer button: the
 * writes are separate endpoints (and the availability ones can fail with a
 * clash the astrologer has to resolve), so a single "Save" would either have to
 * claim to be atomic when it is not, or hide which write actually failed.
 */
export function EditProfileDialog({ open, onOpenChange, initialSection = "account" }: EditProfileDialogProps) {
  const rules = useStore((s) => s.rules);
  const exceptions = useStore((s) => s.exceptions);
  const loadAvailability = useStore((s) => s.loadAvailability);
  const setRules = useStore((s) => s.setRules);
  const setExceptions = useStore((s) => s.setExceptions);

  /** Rules are stored per day; a Monday-Friday range is shown as one entry. */
  const ruleGroups = groupRulesByDaySet(rules);
  const applyProfile = useStore((s) => s.applyProfile);
  const updateMe = useStore((s) => s.updateMe);

  const [section, setSection] = useState<EditSection>(initialSection);

  // Account form
  const [accountName, setAccountName] = useState("");
  const [accountUsername, setAccountUsername] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  const [accountMobile, setAccountMobile] = useState("");
  const [accountPhoto, setAccountPhoto] = useState("");
  const [savingAccount, setSavingAccount] = useState(false);

  // Bio form
  const [bio, setBio] = useState("");
  const [specializations, setSpecializations] = useState("");
  const [languages, setLanguages] = useState("");
  const [experienceYears, setExperienceYears] = useState("");
  const [savingBio, setSavingBio] = useState(false);

  // Pricing form
  const [questionPrice, setQuestionPrice] = useState("");
  const [callPrice, setCallPrice] = useState("");
  const [slotDuration, setSlotDuration] = useState("30");
  const [bufferMinutes, setBufferMinutes] = useState("5");
  const [savingPricing, setSavingPricing] = useState(false);

  // Availability - one editor for the whole weekly schedule. Days and hours are
  // picked together and applied in a single replace, so there is no second
  // "default template" flow that can quietly overwrite what was set here.
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [windows, setWindows] = useState([
    { startTime: "09:00", endTime: "13:00" },
    { startTime: "14:00", endTime: "19:00" },
  ]);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [savingAvailability, setSavingAvailability] = useState(false);

  /** One day set + one window list drive the whole weekly schedule. */
  const sortedSelectedDays = [...selectedDays].sort((a, b) => a - b);
  const completeWindows = windows.filter((w) => w.startTime && w.endTime);
  const daysWithRules = new Set(rules.map((r) => r.dayOfWeek));
  /** Applying replaces the picked days, so existing windows on them are lost. */
  const willReplace = sortedSelectedDays.some((d) => daysWithRules.has(d));

  // Exceptions
  const [excDate, setExcDate] = useState("");
  const [excBlocked, setExcBlocked] = useState(true);
  const [excStart, setExcStart] = useState("");
  const [excEnd, setExcEnd] = useState("");
  const [excReason, setExcReason] = useState("");
  const [savingException, setSavingException] = useState(false);

  // Clash handling between exceptions and availability rules
  const [clash, setClash] = useState<ClashDialog>(null);
  const [bookingBlock, setBookingBlock] = useState<string | null>(null);

  // Seed the forms from the store each time the dialog opens. Deliberately not
  // a subscription: a save writes back to the store, and re-seeding on every
  // store change would wipe whatever the astrologer is still typing elsewhere
  // in the dialog.
  useEffect(() => {
    if (!open) return;
    setSection(initialSection);

    const prof = useStore.getState().profile;
    const u = useStore.getState().user;
    if (prof) {
      setBio(prof.bio ?? "");
      setSpecializations(prof.specializations.join(", "));
      setLanguages(prof.languages.join(", "));
      setExperienceYears(String(prof.experienceYears ?? ""));
      setQuestionPrice(String(prof.questionPricePaise / 100));
      setCallPrice(String(prof.callPricePerSlotPaise / 100));
      setSlotDuration(String(prof.slotDurationMinutes));
      setBufferMinutes(String(prof.bufferMinutes));
    }
    if (u) {
      setAccountName(u.name ?? "");
      setAccountUsername(u.username ?? "");
      setAccountEmail(u.email ?? "");
      setAccountMobile(u.mobile ?? "");
      setAccountPhoto(u.profileImageUrl ?? "");
    }

    void loadAvailability();
  }, [open, initialSection, loadAvailability]);

  const toggleDay = (day: number) => {
    setConfirmReplace(false);
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  /** Preset shortcuts: the common shapes without clicking day by day. */
  const selectDays = (days: number[]) => {
    setConfirmReplace(false);
    setSelectedDays(days);
  };

  const updateWindow = (index: number, field: "startTime" | "endTime", value: string) => {
    setConfirmReplace(false);
    setWindows((prev) => prev.map((w, i) => (i === index ? { ...w, [field]: value } : w)));
  };

  const handleSaveAccount = async () => {
    if (!accountName.trim()) {
      toast.error("Name is required");
      return;
    }
    const mobile = accountMobile.trim();
    if (mobile && !/^\+[1-9]\d{7,14}$/.test(mobile)) {
      toast.error("Mobile must be in E.164 format (+919876543210)");
      return;
    }
    setSavingAccount(true);
    try {
      await updateMe({
        name: accountName.trim(),
        mobile: mobile ? mobile : null,
        profileImageUrl: accountPhoto.trim() ? accountPhoto.trim() : null,
      });
      toast.success("Account details updated");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update account");
    } finally {
      setSavingAccount(false);
    }
  };

  const handleSaveBio = async () => {
    setSavingBio(true);
    try {
      const data = await astrologerApi.updateProfile({
        bio: bio.trim() || undefined,
        specializations: splitList(specializations),
        languages: splitList(languages),
        experienceYears: experienceYears ? parseInt(experienceYears, 10) : undefined,
      });
      applyProfile(data.profile);
      toast.success("Profile updated");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setSavingBio(false);
    }
  };

  const handleSavePricing = async () => {
    const questionPricePaise = parseRupees(questionPrice);
    const callPricePerSlotPaise = parseRupees(callPrice);
    if (questionPricePaise === null || callPricePerSlotPaise === null) {
      toast.error("Enter both prices as a number of rupees");
      return;
    }
    const slot = parseInt(slotDuration, 10);
    const buffer = parseInt(bufferMinutes, 10);
    if (!Number.isFinite(slot) || slot <= 0 || !Number.isFinite(buffer) || buffer < 0) {
      toast.error("Enter a valid slot duration and buffer");
      return;
    }
    setSavingPricing(true);
    try {
      const data = await astrologerApi.updatePricing({
        questionPricePaise,
        callPricePerSlotPaise,
        slotDurationMinutes: slot,
        bufferMinutes: buffer,
      });
      applyProfile(data.profile);
      toast.success("Pricing updated");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update pricing");
    } finally {
      setSavingPricing(false);
    }
  };

  /** Removes every day of a displayed range, since they are saved as one action. */
  const handleDeleteRuleGroup = async (ruleIds: string[], days: number[]) => {
    try {
      await Promise.all(ruleIds.map((id) => astrologerApi.deleteAvailabilityRule(id)));
      const removed = new Set(ruleIds);
      setRules(useStore.getState().rules.filter((r) => !removed.has(r.id)));
      toast.success(
        days.length === 1 ? "Rule deleted" : `Availability removed for ${formatDayRange(days)}`,
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete rule");
      await loadAvailability(true);
    }
  };

  /**
   * The single weekly-availability write: the picked days end up with exactly
   * the picked windows, every week. Running it again with the same values
   * updates instead of duplicating, which is what "set it once" needs.
   */
  const handleApplyAvailability = async (resolve?: "remove-exceptions") => {
    if (sortedSelectedDays.length === 0) {
      toast.error("Pick at least one day");
      return;
    }
    // A window the astrologer started filling in but did not finish is dropped
    // rather than sent, so a half-typed row cannot wipe a whole day.
    if (completeWindows.length === 0) {
      toast.error("Add at least one complete time window");
      return;
    }
    // Replacing days that already have rules is destructive, so it takes a
    // second, explicit click. The clash-resolution retry skips straight through.
    if (willReplace && resolve === undefined && !confirmReplace) {
      setConfirmReplace(true);
      return;
    }

    setSavingAvailability(true);
    try {
      const data = await astrologerApi.bulkSetAvailabilityRules({
        daysOfWeek: sortedSelectedDays,
        windows: completeWindows,
        resolve,
      });
      setRules(data.rules);
      setConfirmReplace(false);
      setClash(null);
      toast.success(`Availability saved for ${formatDayRange(sortedSelectedDays)}`);
    } catch (err: unknown) {
      const info = readClash(err);
      if (info?.code === "EXCEPTION_CONFLICT") {
        setClash({
          kind: "exception",
          conflicts: (info.data.conflicts as ExceptionClash[]) ?? [],
          summary:
            "These weekly windows overlap one or more date-specific exceptions. Pick which one to keep.",
          onResolve: () => handleApplyAvailability("remove-exceptions"),
        });
        return;
      }
      toast.error(err instanceof Error ? err.message : "Failed to save availability");
    } finally {
      setSavingAvailability(false);
    }
  };

  const handleAddException = async (resolve?: "trim-rules") => {
    if (!excDate) {
      toast.error("Pick a date");
      return;
    }
    if (!excBlocked && (!excStart || !excEnd)) {
      toast.error("Enter both start and end time for adjusted hours");
      return;
    }
    setSavingException(true);
    try {
      await astrologerApi.createException({
        date: excDate,
        isBlocked: excBlocked,
        startTime: excStart || undefined,
        endTime: excEnd || undefined,
        reason: excReason.trim() || undefined,
        resolve,
      });
      toast.success(
        resolve ? "Availability updated and exception saved" : "Exception added"
      );
      setExcDate("");
      setExcReason("");
      setClash(null);
      await loadAvailability(true);
    } catch (err: unknown) {
      const info = readClash(err);
      if (info?.code === "BOOKING_CONFLICT") {
        setBookingBlock(
          err instanceof Error
            ? err.message
            : "This exception overlaps a session already booked by a client.",
        );
        return;
      }
      if (info?.code === "RULE_CONFLICT") {
        const window = excStart && excEnd ? `${excStart} - ${excEnd}` : "the whole day";
        setClash({
          kind: "rule",
          conflicts: (info.data.conflicts as RuleClash[]) ?? [],
          summary: `Your exception on ${excDate} (${window}) clashes with your availability. Pick which one to remove.`,
          onResolve: () => handleAddException("trim-rules"),
        });
        return;
      }
      toast.error(err instanceof Error ? err.message : "Failed to add exception");
    } finally {
      setSavingException(false);
    }
  };

  const handleDeleteException = async (id: string) => {
    try {
      await astrologerApi.deleteException(id);
      setExceptions(useStore.getState().exceptions.filter((e) => e.id !== id));
      toast.success("Exception deleted");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete exception");
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        {/* A tall, scrollable shell: the five sections together are far taller
            than any viewport. The header and footer sit outside the scroll area
            so the tabs and the Close button never scroll away. */}
        <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
          <DialogHeader className="shrink-0 border-b px-6 py-4 pr-12">
            <DialogTitle>Edit Profile</DialogTitle>
            <DialogDescription>
              Update your account, bio, pricing, availability and exceptions. Each section saves on
              its own.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <Tabs value={section} onValueChange={(v) => setSection(v as EditSection)}>
              <TabsList className="flex w-full justify-start overflow-x-auto">
                <TabsTrigger className="hover:cursor-pointer" value="account">Account</TabsTrigger>
                <TabsTrigger className="hover:cursor-pointer" value="bio">Bio &amp; Info</TabsTrigger>
                <TabsTrigger className="hover:cursor-pointer" value="pricing">Pricing</TabsTrigger>
                <TabsTrigger className="hover:cursor-pointer" value="availability">Availability</TabsTrigger>
                <TabsTrigger className="hover:cursor-pointer" value="exceptions">Exceptions</TabsTrigger>
              </TabsList>

              <TabsContent value="account" className="mt-4">
                <Section
                  title="Account"
                  description="Your login details and basic information"
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="edit-acc-name">Full Name</Label>
                      <Input
                        id="edit-acc-name"
                        placeholder="Your full name"
                        value={accountName}
                        onChange={(e) => setAccountName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-acc-username">Username</Label>
                      <Input
                        id="edit-acc-username"
                        value={accountUsername}
                        disabled
                        readOnly
                      />
                      <p className="text-xs text-muted-foreground">Username cannot be changed</p>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="edit-acc-email">Email</Label>
                      <Input
                        id="edit-acc-email"
                        value={accountEmail}
                        disabled
                        readOnly
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-acc-mobile">Mobile (E.164)</Label>
                      <Input
                        id="edit-acc-mobile"
                        placeholder="+919876543210"
                        value={accountMobile}
                        onChange={(e) => setAccountMobile(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Format: +countrycode followed by number
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-acc-photo">Profile Photo</Label>
                    <PhotoUpload
                      inputId="edit-acc-photo"
                      value={accountPhoto}
                      onChange={setAccountPhoto}
                    />
                  </div>
                  <Button onClick={handleSaveAccount} disabled={savingAccount}>
                    {savingAccount ? "Saving..." : "Save Account"}
                  </Button>
                </Section>
              </TabsContent>

              <TabsContent value="bio" className="mt-4">
                <Section title="Personal Information" description="Tell clients about yourself">
                  <div className="space-y-2">
                    <Label htmlFor="edit-bio">Bio</Label>
                    <Textarea
                      id="edit-bio"
                      placeholder="Share your experience, approach to astrology, and what makes you unique..."
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      rows={5}
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="edit-specializations">Specializations (comma separated)</Label>
                      <Input
                        id="edit-specializations"
                        placeholder="Vedic Astrology, Numerology, Tarot"
                        value={specializations}
                        onChange={(e) => setSpecializations(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-languages">Languages (comma separated)</Label>
                      <Input
                        id="edit-languages"
                        placeholder="English, Hindi, Sanskrit"
                        value={languages}
                        onChange={(e) => setLanguages(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="edit-experience">Years of Experience</Label>
                      <Input
                        id="edit-experience"
                        type="number"
                        min={0}
                        max={80}
                        placeholder="10"
                        value={experienceYears}
                        onChange={(e) => setExperienceYears(e.target.value)}
                      />
                    </div>
                  </div>
                  <Button onClick={handleSaveBio} disabled={savingBio}>
                    {savingBio ? "Saving..." : "Save Bio & Info"}
                  </Button>
                </Section>
              </TabsContent>

              <TabsContent value="pricing" className="mt-4">
                <Section
                  title="Pricing"
                  description="Set your consultation and question prices"
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="edit-qPrice">Question Price (₹)</Label>
                      <Input
                        id="edit-qPrice"
                        type="number"
                        min={0}
                        step={10}
                        placeholder="100"
                        value={questionPrice}
                        onChange={(e) => setQuestionPrice(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-cPrice">Call Price per Slot (₹)</Label>
                      <Input
                        id="edit-cPrice"
                        type="number"
                        min={0}
                        step={10}
                        placeholder="500"
                        value={callPrice}
                        onChange={(e) => setCallPrice(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="edit-slotDuration">Slot Duration</Label>
                      <Select value={slotDuration} onValueChange={setSlotDuration}>
                        <SelectTrigger id="edit-slotDuration">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[15, 20, 30, 45, 60].map((v) => (
                            <SelectItem key={v} value={String(v)}>
                              {v} minutes
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-buffer">Buffer Between Slots (min)</Label>
                      <Input
                        id="edit-buffer"
                        type="number"
                        min={0}
                        max={60}
                        placeholder="5"
                        value={bufferMinutes}
                        onChange={(e) => setBufferMinutes(e.target.value)}
                      />
                    </div>
                  </div>
                  <Button onClick={handleSavePricing} disabled={savingPricing}>
                    {savingPricing ? "Saving..." : "Save Pricing"}
                  </Button>
                </Section>
              </TabsContent>

              <TabsContent value="availability" className="mt-4 space-y-4">
                <Section
                  title="Weekly Availability"
                  description="Pick the days and the hours, and they repeat every week. Applying replaces the availability for the days you pick. If a window clashes with a date-specific exception you'll be asked which one to keep."
                >
                  {ruleGroups.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No availability set yet — choose your days and hours below.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {ruleGroups.map((group) => (
                        <div
                          key={group.key}
                          className="flex items-center justify-between gap-3 rounded-md border p-3"
                        >
                          <div className="min-w-0">
                            <Badge variant={group.isActive ? "default" : "outline"}>
                              {formatDayRange(group.days)}
                            </Badge>
                            <p className="mt-1.5 text-sm">
                              {group.windows
                                .map((w) => formatRuleWindow(w.startTime, w.endTime))
                                .join(", ")}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Delete ${formatDayRange(group.days)} availability`}
                            onClick={() => handleDeleteRuleGroup(group.ruleIds, group.days)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="space-y-4 border-t pt-4">
                    <div className="space-y-2">
                      <Label>Days</Label>
                      <div className="flex flex-wrap gap-2">
                        {DAY_PRESETS.map((preset) => {
                          const active =
                            sortedSelectedDays.length === preset.days.length &&
                            preset.days.every((d) => sortedSelectedDays.includes(d));
                          return (
                            <button
                              key={preset.label}
                              type="button"
                              aria-pressed={active}
                              onClick={() => selectDays(preset.days)}
                              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                                active
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-input text-muted-foreground hover:border-primary hover:text-primary"
                              }`}
                            >
                              {preset.label}
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {DAYS.map((day, i) => {
                          const selected = selectedDays.includes(i);
                          return (
                            <button
                              key={i}
                              type="button"
                              aria-pressed={selected}
                              onClick={() => toggleDay(i)}
                              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                                selected
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-input text-muted-foreground hover:border-primary hover:text-primary"
                              }`}
                            >
                              {day.slice(0, 3)}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Time Windows</Label>
                      {windows.map((w, i) => (
                        <div key={i} className="flex items-end gap-3">
                          <div className="grid flex-1 grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <Label htmlFor={`edit-win-start-${i}`}>Start Time</Label>
                              <Input
                                id={`edit-win-start-${i}`}
                                type="time"
                                value={w.startTime}
                                onChange={(e) => updateWindow(i, "startTime", e.target.value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`edit-win-end-${i}`}>End Time</Label>
                              <Input
                                id={`edit-win-end-${i}`}
                                type="time"
                                value={w.endTime}
                                onChange={(e) => updateWindow(i, "endTime", e.target.value)}
                              />
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Remove window ${i + 1}`}
                            onClick={() => {
                              setConfirmReplace(false);
                              setWindows((prev) => prev.filter((_, j) => j !== i));
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setConfirmReplace(false);
                          setWindows((prev) => [...prev, { startTime: "", endTime: "" }]);
                        }}
                      >
                        <Plus className="h-4 w-4" />
                        Add Window
                      </Button>
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">
                        Repeats every week on{" "}
                        <span className="font-medium text-foreground">
                          {formatDayRange(sortedSelectedDays) || "no days"}
                        </span>
                        {completeWindows.length > 0 && (
                          <>
                            {" "}
                            &middot;{" "}
                            {completeWindows.map((w) => formatRuleWindow(w.startTime, w.endTime)).join(", ")}
                          </>
                        )}
                      </p>
                      {confirmReplace && (
                        <p className="text-xs text-destructive">
                          This replaces the current availability for{" "}
                          {formatDayRange(sortedSelectedDays)}. Click apply again to confirm.
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        onClick={() => void handleApplyAvailability()}
                        disabled={savingAvailability || sortedSelectedDays.length === 0}
                        variant={confirmReplace ? "destructive" : "default"}
                      >
                        {savingAvailability
                          ? "Saving..."
                          : confirmReplace
                            ? "Replace and save"
                            : "Save availability"}
                      </Button>
                      {confirmReplace && (
                        <Button variant="ghost" onClick={() => setConfirmReplace(false)}>
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                </Section>
              </TabsContent>

              <TabsContent value="exceptions" className="mt-4">
                <Section
                  title="Exceptions"
                  description="Block or adjust specific dates. These override weekly rules for that date only."
                >
                  {exceptions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No exceptions set yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {exceptions.map((exc) => (
                        <div
                          key={exc.id}
                          className="flex items-center justify-between rounded-md border p-3"
                        >
                          <div className="flex items-center gap-3">
                            <Badge variant={exc.isBlocked ? "destructive" : "default"}>
                              {exc.isBlocked ? "Blocked" : "Adjusted"}
                            </Badge>
                            <div>
                              <span className="text-sm font-medium">{exc.date}</span>
                              {exc.startTime && exc.endTime && (
                                <span className="ml-2 text-sm text-muted-foreground">
                                  {formatRuleWindow(exc.startTime, exc.endTime)}
                                </span>
                              )}
                              {exc.reason && (
                                <p className="text-xs text-muted-foreground">{exc.reason}</p>
                              )}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Delete exception on ${exc.date}`}
                            onClick={() => handleDeleteException(exc.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="space-y-4 border-t pt-4">
                    <p className="text-sm font-medium">Add an exception</p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="edit-exc-date">Date</Label>
                        <Input
                          id="edit-exc-date"
                          type="date"
                          value={excDate}
                          onChange={(e) => setExcDate(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-exc-type">Type</Label>
                        <Select
                          value={excBlocked ? "blocked" : "adjusted"}
                          onValueChange={(v) => setExcBlocked(v === "blocked")}
                        >
                          <SelectTrigger id="edit-exc-type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="blocked">Blocked (No bookings)</SelectItem>
                            <SelectItem value="adjusted">Adjusted hours</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {!excBlocked && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="edit-exc-start">Start Time</Label>
                          <Input
                            id="edit-exc-start"
                            type="time"
                            value={excStart}
                            onChange={(e) => setExcStart(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="edit-exc-end">End Time</Label>
                          <Input
                            id="edit-exc-end"
                            type="time"
                            value={excEnd}
                            onChange={(e) => setExcEnd(e.target.value)}
                          />
                        </div>
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="edit-exc-reason">Reason (optional)</Label>
                      <Input
                        id="edit-exc-reason"
                        placeholder="Holiday, personal day off..."
                        value={excReason}
                        onChange={(e) => setExcReason(e.target.value)}
                      />
                    </div>
                    <Button
                      onClick={() => handleAddException()}
                      disabled={savingException || !excDate}
                    >
                      <Plus className="h-4 w-4" />
                      {savingException ? "Adding..." : "Add Exception"}
                    </Button>
                  </div>
                </Section>
              </TabsContent>
            </Tabs>
          </div>

          <DialogFooter className="shrink-0 border-t px-6 py-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* The clash prompts are separate roots rather than children of the edit
          dialog: Radix traps focus in whichever dialog is open, and a second
          overlay nested inside the first fights it for focus. */}
      <Dialog open={clash?.kind === "rule"} onOpenChange={(next) => !next && setClash(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TriangleAlert className="h-5 w-5 text-amber-500" />
              Availability clash
            </DialogTitle>
            <DialogDescription>{clash?.summary}</DialogDescription>
          </DialogHeader>
          {clash?.kind === "rule" && (
            <div className="space-y-2">
              {clash.conflicts.map((c) => (
                <div
                  key={c.ruleId}
                  className="flex items-center gap-3 rounded-md border p-3 text-sm"
                >
                  <Badge variant="outline">{DAYS[c.dayOfWeek]}</Badge>
                  <span>{formatRuleWindow(c.startTime, c.endTime)}</span>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setClash(null)}>
              Remove exception
            </Button>
            <Button
              variant="destructive"
              disabled={savingAvailability}
              onClick={() => void clash?.onResolve()}
            >
              {savingAvailability ? "Working..." : "Remove availability"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={clash?.kind === "exception"}
        onOpenChange={(next) => !next && setClash(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TriangleAlert className="h-5 w-5 text-amber-500" />
              Exception clash
            </DialogTitle>
            <DialogDescription>{clash?.summary}</DialogDescription>
          </DialogHeader>
          {clash?.kind === "exception" && (
            <div className="space-y-2">
              {clash.conflicts.map((e) => (
                <div
                  key={e.exceptionId}
                  className="flex items-center gap-3 rounded-md border p-3 text-sm"
                >
                  <Badge variant={e.isBlocked ? "destructive" : "default"}>
                    {e.isBlocked ? "Blocked" : "Adjusted"}
                  </Badge>
                  <span className="font-medium">{e.date}</span>
                  <span className="text-muted-foreground">{formatExceptionWindow(e)}</span>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setClash(null)}>
              Remove availability
            </Button>
            <Button
              variant="destructive"
              disabled={savingAvailability}
              onClick={() => void clash?.onResolve()}
            >
              Remove exception
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bookingBlock !== null} onOpenChange={(next) => !next && setBookingBlock(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TriangleAlert className="h-5 w-5 text-destructive" />
              Slot already booked
            </DialogTitle>
            <DialogDescription>{bookingBlock}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setBookingBlock(null)}>Got it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}