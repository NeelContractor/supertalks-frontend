import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useStore } from "@/store";
import { astrologerApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Pencil, HelpCircle } from "lucide-react";
import { useCoarsePointer } from "@/hooks/use-coarse-pointer";
import { cn } from "@/lib/utils";
import {
  formatDayRange,
  formatRuleWindow,
  groupRulesByDaySet,
  upcomingExceptions,
} from "@/lib/availability";
import { getProfileSetupStatus } from "@/lib/profile-setup";
import { EditProfileDialog, type EditSection } from "@/components/EditProfileDialog";
// Imported rather than referenced as "/images/...": this server's catch-all
// route answers every unmatched path with index.html, so nothing under public/
// is ever served and a plain URL would hand the browser HTML for the image.
import customInputBoxSm from "../../public/images/custom_input_box_sm.png";

function OverviewRow({ label, value }: { label: string; value?: string | number | null | React.ReactNode }) {
  const hasValue = value !== undefined && value !== null && (typeof value !== "string" || value.trim() !== "");
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-2 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="whitespace-pre-line text-right text-sm font-medium">
        {hasValue ? (typeof value === "string" || typeof value === "number" ? String(value) : value) : "—"}
      </span>
    </div>
  );
}

/**
 * The profile page is a read-only overview of everything an astrologer has
 * configured. Every write - account, bio, pricing, weekly availability and date
 * exceptions - happens in the single edit dialog, so there is exactly one place
 * to look for "how do I change this".
 */
export default function ProfilePage() {
  const user = useStore((s) => s.user);
  const profile = useStore((s) => s.profile);
  const rules = useStore((s) => s.rules);
  const exceptions = useStore((s) => s.exceptions);
  /** An exception disappears from the profile once its date/window has passed. */
  const upcomingExceptionList = upcomingExceptions(exceptions);
  const loadAvailability = useStore((s) => s.loadAvailability);
  const applyProfile = useStore((s) => s.applyProfile);
  const refreshProfile = useStore((s) => s.refreshProfile);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("bio");

  const [searchParams, setSearchParams] = useSearchParams();
  const [editOpen, setEditOpen] = useState(false);
  const [editSection, setEditSection] = useState<EditSection>("account");

  // The custom question box preview is a hover tooltip on pointer devices, but
  // Radix will not open it from a tap, so touch gets an explicit open-on-tap.
  const coarsePointer = useCoarsePointer();
  const [tipOpen, setTipOpen] = useState(false);

  // Custom question box on the public site. Lives directly on the profile
  // (no local copy) so the switch is a single source of truth. It stays a
  // one-click toggle here rather than joining the edit dialog: there is nothing
  // to fill in, and burying it in a modal would be two taps for the same switch.
  const allowCustomQuestions = profile?.allowCustomQuestions ?? false;
  const [savingCustom, setSavingCustom] = useState(false);

  const openEditor = (section: EditSection = "account") => {
    setEditSection(section);
    setEditOpen(true);
  };

  const load = async () => {
    try {
      let p = useStore.getState().profile;
      if (!p) {
        await refreshProfile();
        p = useStore.getState().profile;
      }
      await loadAvailability();
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

  // /profile?setup=1 is where an astrologer with an incomplete profile is sent
  // (see landingPath). Since the page no longer edits anything inline, that
  // arrival opens the editor on the first section that is still missing rather
  // than dumping them on a read-only screen with no hint what to do. Waited on
  // `loading` so the dialog is not seeded before the profile has arrived.
  useEffect(() => {
    if (loading) return;
    if (searchParams.get("setup") !== "1") return;
    const { missing } = getProfileSetupStatus(
      useStore.getState().profile,
      useStore.getState().rules.length,
    );
    const firstMissing = missing.find((field) => field !== "name");
    const target: EditSection =
      firstMissing === "questionPrice" || firstMissing === "callPrice"
        ? "pricing"
        : firstMissing === "availability"
          ? "availability"
          : "bio";
    setTab(target);
    openEditor(target);
    setSearchParams({}, { replace: true });
  }, [loading, searchParams, setSearchParams]);

  const handleToggleCustomQuestions = async (next: boolean) => {
    setSavingCustom(true);
    try {
      const data = await astrologerApi.updateProfile({ allowCustomQuestions: next });
      applyProfile(data.profile);
      toast.success(
        next
          ? "Custom question box is now live on your website"
          : "Custom question box removed from your website",
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update your website");
    } finally {
      setSavingCustom(false);
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Profile &amp; Settings</h1>
          <p className="text-muted-foreground">Manage your astrologer profile, pricing, and availability</p>
        </div>
        <Button onClick={() => openEditor()}>
          <Pencil className="h-4 w-4" />
          Edit Profile
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex w-full justify-start overflow-x-auto md:w-auto md:justify-center md:overflow-visible">
          <TabsTrigger className="hover:cursor-pointer" value="bio">Bio &amp; Info</TabsTrigger>
          <TabsTrigger className="hover:cursor-pointer" value="pricing">Pricing</TabsTrigger>
          <TabsTrigger className="hover:cursor-pointer" value="availability">Availability</TabsTrigger>
          <TabsTrigger className="hover:cursor-pointer" value="exceptions">Exceptions</TabsTrigger>
        </TabsList>

        {/* Bio Tab */}
        <TabsContent value="bio">
          <div className="space-y-6">
            <Card className="gap-7 pb-7">
              <CardHeader>
                <CardTitle>Account</CardTitle>
                <CardDescription>Your login details and basic information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <OverviewRow label="Name" value={user?.name} />
                <OverviewRow label="Username" value={`@${user?.username}`} />
                <OverviewRow label="Email" value={user?.email} />
                <OverviewRow
                  label="Profile Photo"
                  value={
                    user?.profileImageUrl ? (
                      <img
                        src={user.profileImageUrl}
                        alt="Profile photo"
                        className="h-10 w-10 rounded-full border object-cover"
                      />
                    ) : (
                      user?.profileImageUrl
                    )
                  }
                />
              </CardContent>
            </Card>
            <Card className="gap-7 pb-7">
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
                <CardDescription>Tell clients about yourself</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <OverviewRow label="Bio" value={profile?.bio} />
                <OverviewRow label="Specializations" value={profile?.specializations.join(", ")} />
                <OverviewRow label="Languages" value={profile?.languages.join(", ")} />
                <OverviewRow label="Years of Experience" value={profile?.experienceYears} />
              </CardContent>
            </Card>

            <Card className="gap-7 pb-7">
              <CardHeader>
                <div className="flex items-center gap-1.5">
                  <CardTitle>Custom Question Box</CardTitle>
                  {/* Touch gets a tap-driven popover and pointer devices get the
                      hover tooltip. A tooltip cannot do this job on a phone: it
                      only opens on hover or focus, and the touch pointer is
                      destroyed on touchend, which fires pointerleave and closes
                      the panel again the instant it appears. */}
                  {(() => {
                    const trigger = (
                      <button
                        type="button"
                        aria-label="What is the custom question box?"
                        // 44px on touch, where the bare icon would be a 24px target.
                        // Keyed off the input type rather than a width breakpoint, so
                        // a touch tablet keeps the large target too.
                        className={cn(
                          "flex shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                          coarsePointer ? "h-11 w-11" : "-my-2.5 h-6 w-6",
                        )}
                      >
                        <HelpCircle className="h-4 w-4" />
                      </button>
                    );
                    // p-0 lets the preview run edge to edge with the copy in its
                    // own padded block below. Width is capped against the viewport
                    // so the panel cannot spill off a narrow phone, and
                    // collisionPadding keeps it clear of the screen edge.
                    const panelClass =
                      "w-[calc(100vw-1.5rem)] max-w-xs overflow-hidden p-0";
                    // The shared TooltipContent is themed dark (bg-foreground), so
                    // the pointer variant is re-skinned onto the popover's light
                    // surface. Without this the description is white-on-black on
                    // desktop and dark-on-white on a phone.
                    //
                    // The primitive's arrow is a 10px square rotated 45 degrees,
                    // which reads as a detached diamond on this panel and, now that
                    // the surface is light, cuts a notch into its own border. The
                    // popover used on touch has no arrow, so the pointer variant
                    // drops it too and lets the border and shadow carry the
                    // connection to the icon.
                    const lightPanelClass = cn(
                      panelClass,
                      "border bg-popover text-popover-foreground shadow-md",
                    );
                    const body = (
                      <>
                        <img
                          src={customInputBoxSm}
                          alt="The custom question box as visitors see it on your website"
                          className="aspect-[4/3] w-full object-cover"
                        />
                        <div className="space-y-1 p-3">
                          <p className="font-medium">Let clients ask their own question</p>
                          <p className="text-muted-foreground">
                            Adds a free-text box under your listed questions, so visitors can ask
                            something you have not prewritten.
                          </p>
                        </div>
                      </>
                    );
                    return coarsePointer ? (
                      <Popover open={tipOpen} onOpenChange={setTipOpen}>
                        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
                        <PopoverContent
                          side="bottom"
                          align="start"
                          collisionPadding={12}
                          sideOffset={6}
                          className={panelClass}
                        >
                          {body}
                        </PopoverContent>
                      </Popover>
                    ) : (
                      <Tooltip>
                        <TooltipTrigger asChild>{trigger}</TooltipTrigger>
                        <TooltipContent
                          arrow={false}
                          side="bottom"
                          align="start"
                          collisionPadding={12}
                          sideOffset={6}
                          className={lightPanelClass}
                        >
                          {body}
                        </TooltipContent>
                      </Tooltip>
                    );
                  })()}
                </div>
                <CardDescription>
                  Let clients write their own question on your website, below the questions you have
                  already listed.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-start justify-between gap-4 rounded-lg border p-5">
                  <div className="space-y-1">
                    <Label htmlFor="allow-custom-questions" className="text-base">
                      Allow custom questions
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {allowCustomQuestions
                        ? "Visitors can type their own question and submit it alongside your prefilled ones."
                        : "Visitors can only pick from the questions you have listed."}
                    </p>
                  </div>
                  <Switch
                    className="hover:cursor-pointer"
                    id="allow-custom-questions"
                    checked={allowCustomQuestions}
                    disabled={savingCustom}
                    onCheckedChange={handleToggleCustomQuestions}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Pricing Tab */}
        <TabsContent value="pricing">
          <Card>
            <CardHeader>
              <CardTitle>Pricing</CardTitle>
              <CardDescription>Set your consultation and question prices</CardDescription>
            </CardHeader>
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
          </Card>
        </TabsContent>

        {/* Availability Tab */}
        <TabsContent value="availability">
          <Card>
            <CardHeader>
              <CardTitle>Availability Rules</CardTitle>
              <CardDescription>Your recurring weekly available hours</CardDescription>
            </CardHeader>
            <CardContent>
              {rules.length === 0 ? (
                <p className="text-sm text-muted-foreground">No availability rules set yet.</p>
              ) : (
                <div className="space-y-2">
                  {groupRulesByDaySet(rules).map((group) => (
                    <div
                      key={group.key}
                      className="flex items-center justify-between gap-3 rounded-md border p-3"
                    >
                      <Badge variant={group.isActive ? "default" : "outline"}>
                        {formatDayRange(group.days)}
                      </Badge>
                      <span className="text-sm">
                        {group.windows
                          .map((w) => formatRuleWindow(w.startTime, w.endTime))
                          .join(", ")}
                      </span>
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
            <CardHeader>
              <CardTitle>Exceptions</CardTitle>
              <CardDescription>
                Blocked or adjusted dates. These override weekly rules for that date only, and
                disappear here once they&apos;ve passed.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {upcomingExceptionList.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {exceptions.length === 0
                    ? "No exceptions set yet."
                    : "No upcoming exceptions."}
                </p>
              ) : (
                <div className="space-y-2">
                  {upcomingExceptionList.map((exc) => (
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
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <EditProfileDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        initialSection={editSection}
      />
    </div>
  );
}