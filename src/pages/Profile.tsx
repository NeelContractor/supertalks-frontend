import { useEffect, useState } from "react";
import { useStore } from "@/store";
import { ApiError, astrologerApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { Plus, Trash2, TriangleAlert } from "lucide-react";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface RuleClash {
  ruleId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

interface ExceptionClash {
  exceptionId: string;
  date: string;
  isBlocked: boolean;
  startTime: string | null;
  endTime: string | null;
  reason: string | null;
}

type ClashDialog =
  | { kind: "rule"; conflicts: RuleClash[]; summary: string; onResolve: () => Promise<void> }
  | {
      kind: "exception";
      conflicts: ExceptionClash[];
      summary: string;
      onResolve: () => Promise<void>;
    }
  | null;

function formatExceptionWindow(e: ExceptionClash) {
  return e.startTime && e.endTime ? `${e.startTime} - ${e.endTime}` : "All day";
}

function OverviewRow({ label, value }: { label: string; value?: string | number | null }) {
  const hasValue = value !== undefined && value !== null && String(value).trim() !== "";
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-2 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="whitespace-pre-line text-right text-sm font-medium">
        {hasValue ? String(value) : "—"}
      </span>
    </div>
  );
}

export default function ProfilePage() {
  const profile = useStore((s) => s.profile);
  const rules = useStore((s) => s.rules);
  const exceptions = useStore((s) => s.exceptions);
  const loadAvailability = useStore((s) => s.loadAvailability);
  const setRules = useStore((s) => s.setRules);
  const setExceptions = useStore((s) => s.setExceptions);
  const applyProfile = useStore((s) => s.applyProfile);
  const refreshProfile = useStore((s) => s.refreshProfile);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("bio");

  // Bio form
  const [bio, setBio] = useState("");
  const [specializations, setSpecializations] = useState("");
  const [languages, setLanguages] = useState("");
  const [experienceYears, setExperienceYears] = useState("");
  const [saving, setSaving] = useState(false);

  // Pricing form
  const [questionPrice, setQuestionPrice] = useState("");
  const [callPrice, setCallPrice] = useState("");
  const [slotDuration, setSlotDuration] = useState("30");
  const [bufferMinutes, setBufferMinutes] = useState("5");

  // Edit/view mode toggles
  const [bioEditing, setBioEditing] = useState(true);
  const [pricingEditing, setPricingEditing] = useState(true);

  // Rule dialog
  const [ruleDialog, setRuleDialog] = useState(false);
  const [ruleDay, setRuleDay] = useState("1");
  const [ruleStart, setRuleStart] = useState("09:00");
  const [ruleEnd, setRuleEnd] = useState("17:00");

  // Exception dialog
  const [exceptionDialog, setExceptionDialog] = useState(false);
  const [excDate, setExcDate] = useState("");
  const [excBlocked, setExcBlocked] = useState(true);
  const [excStart, setExcStart] = useState("");
  const [excEnd, setExcEnd] = useState("");
  const [excReason, setExcReason] = useState("");

  // Clash handling between exceptions and availability rules
  const [clash, setClash] = useState<ClashDialog>(null);
  const [bookingBlock, setBookingBlock] = useState<string | null>(null);

  const readClash = (err: unknown) => {
    if (!(err instanceof ApiError)) return null;
    const data = (err.data ?? {}) as Record<string, unknown>;
    const code = typeof data.code === "string" ? data.code : "";
    return code ? { code, data, message: err.message } : null;
  };

  // Weekly default template
  const [templateDays, setTemplateDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [templateWindows, setTemplateWindows] = useState([
    { startTime: "09:00", endTime: "13:00" },
    { startTime: "14:00", endTime: "19:00" },
  ]);
  const [applyingTemplate, setApplyingTemplate] = useState(false);

  const toggleTemplateDay = (day: number) => {
    setTemplateDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const updateWindow = (index: number, field: "startTime" | "endTime", value: string) => {
    setTemplateWindows((prev) =>
      prev.map((w, i) => (i === index ? { ...w, [field]: value } : w))
    );
  };

  const handleApplyTemplate = async (resolve?: "remove-exceptions") => {
    if (templateDays.length === 0) return;
    setApplyingTemplate(true);
    try {
      const data = await astrologerApi.bulkSetAvailabilityRules({
        daysOfWeek: templateDays,
        windows: templateWindows,
        resolve,
      });
      setRules(data.rules);
      setClash(null);
      toast.success("Default availability applied");
    } catch (err: unknown) {
      const info = readClash(err);
      if (info?.code === "EXCEPTION_CONFLICT") {
        setClash({
          kind: "exception",
          conflicts: (info.data.conflicts as ExceptionClash[]) ?? [],
          summary:
            "These weekly windows overlap one or more date-specific exceptions. Pick which one to keep.",
          onResolve: () => handleApplyTemplate("remove-exceptions"),
        });
        return;
      }
      toast.error(err instanceof Error ? err.message : "Failed to apply default availability");
    } finally {
      setApplyingTemplate(false);
    }
  };

  const load = async () => {
    try {
      let p = useStore.getState().profile;
      if (!p) {
        await refreshProfile();
        p = useStore.getState().profile;
      }
      await loadAvailability();

      const prof = p ?? useStore.getState().profile;
      if (prof) {
        setBio(prof.bio ?? "");
        setSpecializations(prof.specializations.join(", "));
        setLanguages(prof.languages.join(", "));
        setExperienceYears(String(prof.experienceYears ?? ""));
        setQuestionPrice(String(prof.questionPricePaise / 100));
        setCallPrice(String(prof.callPricePerSlotPaise / 100));
        setSlotDuration(String(prof.slotDurationMinutes));
        setBufferMinutes(String(prof.bufferMinutes));

        const hasBio =
          !!prof.bio?.trim() ||
          prof.specializations.length > 0 ||
          prof.languages.length > 0 ||
          prof.experienceYears != null;
        const hasPricing = prof.questionPricePaise > 0 || prof.callPricePerSlotPaise > 0;
        setBioEditing(!hasBio);
        setPricingEditing(!hasPricing);
      }
    } catch {
      toast.error("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveBio = async () => {
    setSaving(true);
    try {
      const data = await astrologerApi.updateProfile({
        bio: bio.trim() || undefined,
        specializations: specializations
          ? specializations.split(",").map((s) => s.trim()).filter(Boolean)
          : [],
        languages: languages
          ? languages.split(",").map((l) => l.trim()).filter(Boolean)
          : [],
        experienceYears: experienceYears ? parseInt(experienceYears, 10) : undefined,
      });
      applyProfile(data.profile);
      setBioEditing(false);
      toast.success("Profile updated");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleSavePricing = async () => {
    setSaving(true);
    try {
      const data = await astrologerApi.updatePricing({
        questionPricePaise: Math.round(parseFloat(questionPrice || "0") * 100),
        callPricePerSlotPaise: Math.round(parseFloat(callPrice || "0") * 100),
        slotDurationMinutes: parseInt(slotDuration, 10),
        bufferMinutes: parseInt(bufferMinutes, 10),
      });
      applyProfile(data.profile);
      setPricingEditing(false);
      toast.success("Pricing updated");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update pricing");
    } finally {
      setSaving(false);
    }
  };

  const handleAddRule = async (resolve?: "remove-exceptions") => {
    setSaving(true);
    try {
      await astrologerApi.createAvailabilityRule({
        dayOfWeek: parseInt(ruleDay, 10),
        startTime: ruleStart,
        endTime: ruleEnd,
        resolve,
      });
      toast.success("Availability rule added");
      setRuleDialog(false);
      setClash(null);
      await loadAvailability(true);
    } catch (err: unknown) {
      const info = readClash(err);
      if (info?.code === "EXCEPTION_CONFLICT") {
        setClash({
          kind: "exception",
          conflicts: (info.data.conflicts as ExceptionClash[]) ?? [],
          summary: `This ${DAYS[parseInt(ruleDay, 10)]} availability overlaps one or more date-specific exceptions. Pick which one to keep.`,
          onResolve: () => handleAddRule("remove-exceptions"),
        });
        return;
      }
      toast.error(err instanceof Error ? err.message : "Failed to add rule");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRule = async (id: string) => {
    try {
      await astrologerApi.deleteAvailabilityRule(id);
      setRules(useStore.getState().rules.filter((r) => r.id !== id));
      toast.success("Rule deleted");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete rule");
    }
  };

  const handleAddException = async (resolve?: "trim-rules") => {
    setSaving(true);
    try {
      await astrologerApi.createException({
        date: excDate,
        isBlocked: excBlocked,
        startTime: excStart || undefined,
        endTime: excEnd || undefined,
        reason: excReason.trim() || undefined,
        resolve,
      });
      toast.success(resolve ? "Availability updated and exception saved" : "Exception added");
      setExceptionDialog(false);
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
      setSaving(false);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Profile & Settings</h1>
        <p className="text-muted-foreground">Manage your astrologer profile, pricing, and availability</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="bio">Bio & Info</TabsTrigger>
          <TabsTrigger value="pricing">Pricing</TabsTrigger>
          <TabsTrigger value="availability">Availability</TabsTrigger>
          <TabsTrigger value="exceptions">Exceptions</TabsTrigger>
        </TabsList>

        {/* Bio Tab */}
        <TabsContent value="bio">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between">
              <div>
                <CardTitle>Personal Information</CardTitle>
                <CardDescription>Tell clients about yourself</CardDescription>
              </div>
              {!bioEditing ? (
                <Button variant="outline" size="sm" onClick={() => setBioEditing(true)}>
                  Edit
                </Button>
              ) : null}
            </CardHeader>
            {bioEditing ? (
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  placeholder="Share your experience, approach to astrology, and what makes you unique..."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={5}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="specializations">Specializations (comma separated)</Label>
                  <Input
                    id="specializations"
                    placeholder="Vedic Astrology, Numerology, Tarot"
                    value={specializations}
                    onChange={(e) => setSpecializations(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="languages">Languages (comma separated)</Label>
                  <Input
                    id="languages"
                    placeholder="English, Hindi, Sanskrit"
                    value={languages}
                    onChange={(e) => setLanguages(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="experience">Years of Experience</Label>
                  <Input
                    id="experience"
                    type="number"
                    min={0}
                    max={80}
                    placeholder="10"
                    value={experienceYears}
                    onChange={(e) => setExperienceYears(e.target.value)}
                  />
                </div>
              </div>
              <Button onClick={handleSaveBio} disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </CardContent>
            ) : (
            <CardContent className="space-y-2">
              <OverviewRow label="Bio" value={profile?.bio} />
              <OverviewRow label="Specializations" value={profile?.specializations.join(", ")} />
              <OverviewRow label="Languages" value={profile?.languages.join(", ")} />
              <OverviewRow label="Years of Experience" value={profile?.experienceYears} />
            </CardContent>
            )}
          </Card>
        </TabsContent>

        {/* Pricing Tab */}
        <TabsContent value="pricing">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between">
              <div>
                <CardTitle>Pricing</CardTitle>
                <CardDescription>Set your consultation and question prices</CardDescription>
              </div>
              {!pricingEditing ? (
                <Button variant="outline" size="sm" onClick={() => setPricingEditing(true)}>
                  Edit
                </Button>
              ) : null}
            </CardHeader>
            {pricingEditing ? (
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="qPrice">Question Price (₹)</Label>
                  <Input
                    id="qPrice"
                    type="number"
                    min={0}
                    step={10}
                    placeholder="100"
                    value={questionPrice}
                    onChange={(e) => setQuestionPrice(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cPrice">Call Price per Slot (₹)</Label>
                  <Input
                    id="cPrice"
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
                  <Label>Slot Duration</Label>
                  <Select value={slotDuration} onValueChange={setSlotDuration}>
                    <SelectTrigger>
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
                  <Label htmlFor="buffer">Buffer Between Slots (min)</Label>
                  <Input
                    id="buffer"
                    type="number"
                    min={0}
                    max={60}
                    placeholder="5"
                    value={bufferMinutes}
                    onChange={(e) => setBufferMinutes(e.target.value)}
                  />
                </div>
              </div>
              <Button onClick={handleSavePricing} disabled={saving}>
                {saving ? "Saving..." : "Save Pricing"}
              </Button>
            </CardContent>
            ) : (
            <CardContent className="space-y-2">
              <OverviewRow
                label="Question Price"
                value={profile ? `₹${(profile.questionPricePaise / 100).toLocaleString("en-IN")}` : undefined}
              />
              <OverviewRow
                label="Call Price per Slot"
                value={profile ? `₹${(profile.callPricePerSlotPaise / 100).toLocaleString("en-IN")}` : undefined}
              />
              <OverviewRow label="Slot Duration" value={profile ? `${profile.slotDurationMinutes} min` : undefined} />
              <OverviewRow label="Buffer Between Slots" value={profile ? `${profile.bufferMinutes} min` : undefined} />
            </CardContent>
            )}
          </Card>
        </TabsContent>

        {/* Availability Tab */}
        <TabsContent value="availability">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Availability Rules</CardTitle>
                <CardDescription>Set your weekly available hours</CardDescription>
              </div>
              <Button size="sm" onClick={() => setRuleDialog(true)}>
                <Plus className="h-4 w-4" />
                Add Rule
              </Button>
            </CardHeader>
            <CardContent>
              {rules.length === 0 ? (
                <p className="text-sm text-muted-foreground">No availability rules set yet.</p>
              ) : (
                <div className="space-y-2">
                  {rules.map((rule) => (
                    <div
                      key={rule.id}
                      className="flex items-center justify-between rounded-md border p-3"
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant={rule.isActive ? "default" : "outline"}>
                          {DAYS[rule.dayOfWeek]}
                        </Badge>
                        <span className="text-sm">
                          {rule.startTime} - {rule.endTime}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleDeleteRule(rule.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Default Weekly Availability</CardTitle>
              <CardDescription>
                Pick days and time windows, then apply them in one go. If a window clashes with a
                date-specific exception you'll be asked which one to keep.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Days</Label>
                <div className="flex flex-wrap gap-2">
                  {DAYS.map((day, i) => {
                    const selected = templateDays.includes(i);
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => toggleTemplateDay(i)}
                        className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                          selected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-input text-muted-foreground hover:bg-accent"
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
                {templateWindows.map((w, i) => (
                  <div key={i} className="flex items-end gap-3">
                    <div className="grid flex-1 grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor={`tw-start-${i}`}>Start Time</Label>
                        <Input
                          id={`tw-start-${i}`}
                          type="time"
                          value={w.startTime}
                          onChange={(e) => updateWindow(i, "startTime", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`tw-end-${i}`}>End Time</Label>
                        <Input
                          id={`tw-end-${i}`}
                          type="time"
                          value={w.endTime}
                          onChange={(e) => updateWindow(i, "endTime", e.target.value)}
                        />
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setTemplateWindows((prev) => prev.filter((_, j) => j !== i))}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setTemplateWindows((prev) => [...prev, { startTime: "", endTime: "" }])}
                >
                  <Plus className="h-4 w-4" />
                  Add Window
                </Button>
              </div>

              <Button onClick={() => void handleApplyTemplate()} disabled={applyingTemplate || templateDays.length === 0}>
                {applyingTemplate ? "Applying..." : "Apply to selected days"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Exceptions Tab */}
        <TabsContent value="exceptions">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
<CardTitle>Exceptions</CardTitle>
                  <CardDescription>Block or adjust specific dates. These override weekly rules for that date only.</CardDescription>
              </div>
              <Button size="sm" onClick={() => setExceptionDialog(true)}>
                <Plus className="h-4 w-4" />
                Add Exception
              </Button>
            </CardHeader>
            <CardContent>
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
                            <span className="text-sm text-muted-foreground ml-2">
                              {exc.startTime} - {exc.endTime}
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
                        onClick={() => handleDeleteException(exc.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Rule Dialog */}
      <Dialog open={ruleDialog} onOpenChange={setRuleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Availability Rule</DialogTitle>
            <DialogDescription>Set a recurring weekly time slot</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Day of Week</Label>
              <Select value={ruleDay} onValueChange={setRuleDay}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS.map((day, i) => (
                    <SelectItem key={i} value={String(i)}>
                      {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rule-start">Start Time</Label>
                <Input
                  id="rule-start"
                  type="time"
                  value={ruleStart}
                  onChange={(e) => setRuleStart(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rule-end">End Time</Label>
                <Input
                  id="rule-end"
                  type="time"
                  value={ruleEnd}
                  onChange={(e) => setRuleEnd(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRuleDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => handleAddRule()} disabled={saving}>
              {saving ? "Adding..." : "Add Rule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Exception Dialog */}
      <Dialog open={exceptionDialog} onOpenChange={setExceptionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Exception</DialogTitle>
            <DialogDescription>Block or adjust hours for a specific date</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="exc-date">Date</Label>
              <Input
                id="exc-date"
                type="date"
                value={excDate}
                onChange={(e) => setExcDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={excBlocked ? "blocked" : "adjusted"} onValueChange={(v) => setExcBlocked(v === "blocked")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="blocked">Blocked (No bookings)</SelectItem>
                  <SelectItem value="adjusted">Adjusted hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {!excBlocked && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="exc-start">Start Time</Label>
                  <Input
                    id="exc-start"
                    type="time"
                    value={excStart}
                    onChange={(e) => setExcStart(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="exc-end">End Time</Label>
                  <Input
                    id="exc-end"
                    type="time"
                    value={excEnd}
                    onChange={(e) => setExcEnd(e.target.value)}
                  />
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="exc-reason">Reason (optional)</Label>
              <Input
                id="exc-reason"
                placeholder="Holiday, personal day off..."
                value={excReason}
                onChange={(e) => setExcReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExceptionDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => handleAddException()} disabled={saving || !excDate}>
              {saving ? "Adding..." : "Add Exception"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Exception clashes with weekly availability */}
      <Dialog open={clash?.kind === "rule"} onOpenChange={(open) => !open && setClash(null)}>
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
                  <span>
                    {c.startTime} - {c.endTime}
                  </span>
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
              disabled={saving}
              onClick={() => void clash?.onResolve()}
            >
              {saving ? "Working..." : "Remove availability"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Weekly availability clashes with existing exceptions */}
      <Dialog open={clash?.kind === "exception"} onOpenChange={(open) => !open && setClash(null)}>
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
              disabled={saving || applyingTemplate}
              onClick={() => void clash?.onResolve()}
            >
              Remove exception
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Exception overlaps a booked session */}
      <Dialog open={bookingBlock !== null} onOpenChange={(open) => !open && setBookingBlock(null)}>
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
    </div>
  );
}
