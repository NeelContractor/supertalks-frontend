import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/auth";
import { astrologerApi } from "@/lib/api";
import type { AstrologerProfile, AvailabilityRule, AvailabilityException } from "@/types";
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
import { Plus, Trash2 } from "lucide-react";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function ProfilePage() {
  const { profile: initialProfile, refreshProfile } = useAuth();
  const [profile, setProfile] = useState<AstrologerProfile | null>(initialProfile);
  const [rules, setRules] = useState<AvailabilityRule[]>([]);
  const [exceptions, setExceptions] = useState<AvailabilityException[]>([]);
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

  const load = useCallback(async () => {
    try {
      const [profileData, rulesData, exceptionsData] = await Promise.all([
        astrologerApi.getMe(),
        astrologerApi.getAvailabilityRules().catch(() => ({ rules: [] })),
        astrologerApi.getExceptions().catch(() => ({ exceptions: [] })),
      ]);
      setProfile(profileData.profile);
      setRules(rulesData.rules);
      setExceptions(exceptionsData.exceptions);

      const p = profileData.profile;
      setBio(p.bio ?? "");
      setSpecializations(p.specializations.join(", "));
      setLanguages(p.languages.join(", "));
      setExperienceYears(String(p.experienceYears ?? ""));
      setQuestionPrice(String(p.questionPricePaise / 100));
      setCallPrice(String(p.callPricePerSlotPaise / 100));
      setSlotDuration(String(p.slotDurationMinutes));
      setBufferMinutes(String(p.bufferMinutes));
    } catch {
      toast.error("Failed to load profile");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
      setProfile(data.profile);
      await refreshProfile();
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
      setProfile(data.profile);
      await refreshProfile();
      toast.success("Pricing updated");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update pricing");
    } finally {
      setSaving(false);
    }
  };

  const handleAddRule = async () => {
    setSaving(true);
    try {
      await astrologerApi.createAvailabilityRule({
        dayOfWeek: parseInt(ruleDay, 10),
        startTime: ruleStart,
        endTime: ruleEnd,
      });
      toast.success("Availability rule added");
      setRuleDialog(false);
      const data = await astrologerApi.getAvailabilityRules();
      setRules(data.rules);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to add rule");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRule = async (id: string) => {
    try {
      await astrologerApi.deleteAvailabilityRule(id);
      setRules((prev) => prev.filter((r) => r.id !== id));
      toast.success("Rule deleted");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete rule");
    }
  };

  const handleAddException = async () => {
    setSaving(true);
    try {
      await astrologerApi.createException({
        date: excDate,
        isBlocked: excBlocked,
        startTime: excStart || undefined,
        endTime: excEnd || undefined,
        reason: excReason.trim() || undefined,
      });
      toast.success("Exception added");
      setExceptionDialog(false);
      const data = await astrologerApi.getExceptions();
      setExceptions(data.exceptions);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to add exception");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteException = async (id: string) => {
    try {
      await astrologerApi.deleteException(id);
      setExceptions((prev) => prev.filter((e) => e.id !== id));
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
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>Tell clients about yourself</CardDescription>
            </CardHeader>
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
          </Card>
        </TabsContent>

        {/* Pricing Tab */}
        <TabsContent value="pricing">
          <Card>
            <CardHeader>
              <CardTitle>Pricing</CardTitle>
              <CardDescription>Set your consultation and question prices</CardDescription>
            </CardHeader>
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
        </TabsContent>

        {/* Exceptions Tab */}
        <TabsContent value="exceptions">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Exceptions</CardTitle>
                <CardDescription>Block or adjust specific dates</CardDescription>
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
            <Button onClick={handleAddRule} disabled={saving}>
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
            <Button onClick={handleAddException} disabled={saving || !excDate}>
              {saving ? "Adding..." : "Add Exception"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
