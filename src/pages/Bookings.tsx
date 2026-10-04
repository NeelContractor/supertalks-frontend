import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useStore } from "@/store";
import { bookingsApi } from "@/lib/api";
import type { Booking, SortOrder } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
} from "@/components/ui/pagination";
import { toast } from "sonner";
import { astrologerSiteUrl } from "@/lib/site";
import { focusKeyFrom, resolveFocus, shouldDismissFocus } from "@/lib/booking-focus";
import { bookingStatusLabel } from "@/lib/status-labels";
import type { ViewKey } from "@/lib/booking-focus";
import { CalendarDays, Clock, CheckCircle, XCircle, ChevronLeft, ChevronRight, ExternalLink, X } from "lucide-react";

const PAGE_SIZE = 10;

function getStatusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "Completed") return "default";
  if (status === "Confirmed") return "secondary";
  if (status.startsWith("Cancelled")) return "destructive";
  return "outline";
}

/** A session still ahead of us. Mirrors the server's Upcoming tab filter. */
const isUpcoming = (b: Booking) => b.status === "Confirmed" && new Date(b.startAt) > new Date();

/**
 * Extracted so the same card can be rendered twice: once inside the paginated
 * list, and once pinned above it when a deep-linked session is not part of the
 * current filter/page.
 */
function BookingCard({
  booking: b,
  isClient,
  cardId,
  highlighted = false,
  submitting = false,
  onComplete,
  onCancel,
  onReschedule,
}: {
  booking: Booking;
  isClient: boolean;
  cardId?: string;
  highlighted?: boolean;
  submitting?: boolean;
  onComplete?: (b: Booking) => void;
  onCancel?: (b: Booking) => void;
  onReschedule?: (b: Booking) => void;
}) {
  const siteUrl = isClient ? astrologerSiteUrl(b.astrologer?.slug) : null;
  return (
    <Card id={cardId} className={highlighted ? "ring-2 ring-primary" : ""}>
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
        <div className="space-y-1">
          <CardTitle className="text-base">
            {isClient ? b.astrologer?.user.name ?? "Astrologer" : b.client?.name ?? "Client"}
          </CardTitle>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {new Date(b.startAt).toLocaleString()}
            </span>
            <span>₹{(b.pricePaise / 100).toLocaleString()}</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {siteUrl && (
            <a
              href={siteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary underline-offset-4 hover:underline"
            >
              <span className="inline-flex items-center gap-1">
                Visit site <ExternalLink className="h-3.5 w-3.5" />
              </span>
            </a>
          )}
          <Badge variant={getStatusVariant(b.status)}>{bookingStatusLabel(b.status)}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {b.meetingLink && (
          <a
            href={b.meetingLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            Join Meeting
          </a>
        )}
        {b.clientNote && <p className="text-sm text-muted-foreground mt-2">Note: {b.clientNote}</p>}
        {b.cancellationReason && (
          <p className="text-sm text-destructive mt-2">
            Cancellation reason: {b.cancellationReason}
          </p>
        )}
        {isUpcoming(b) && (
          <div className="flex gap-2 mt-3">
            {isClient ? (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => onCancel?.(b)}
              >
                <XCircle className="h-3.5 w-3.5" />
                Cancel Booking
              </Button>
            ) : (
              <>
                <Button size="sm" onClick={() => onComplete?.(b)} disabled={submitting}>
                  <CheckCircle className="h-3.5 w-3.5" />
                  Complete
                </Button>
                <Button size="sm" variant="outline" onClick={() => onReschedule?.(b)}>
                  Reschedule
                </Button>
                <Button size="sm" variant="destructive" onClick={() => onCancel?.(b)}>
                  <XCircle className="h-3.5 w-3.5" />
                  Cancel
                </Button>
              </>
            )}
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-3">
          Booked {new Date(b.createdAt).toLocaleString()}
        </p>
      </CardContent>
    </Card>
  );
}

export default function BookingsPage() {
  const isClient = useStore((s) => s.viewAs) === "client";
  const viewAs = useStore((s) => s.viewAs);
  const [searchParams] = useSearchParams();
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState<SortOrder>("latest");
  const [page, setPage] = useState(0);
  const pageData = useStore((s) => s.bookingPages[`${filter}:${sort}:${page}`]);
  const bookings = pageData?.items ?? [];
  const total = pageData?.total ?? 0;
  const counts = useStore((s) => s.bookingCounts);
  const loading = useStore((s) => s.bookingsLoading);
  const loadBookings = useStore((s) => s.loadBookings);
  const [cancelDialog, setCancelDialog] = useState<Booking | null>(null);
  const [rescheduleDialog, setRescheduleDialog] = useState<Booking | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [newDateTime, setNewDateTime] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async (targetPage: number, force = false) => {
    try {
      return await loadBookings(filter, targetPage, sort, force);
    } catch {
      toast.error("Failed to load bookings");
      return null;
    }
  }, [filter, sort, loadBookings]);

  useEffect(() => {
    void load(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, sort, page, viewAs]);

  // The focus target is keyed on the id *and* the nonce, and is deliberately
  // independent of `load`. The navbar bell is a client-side link, so arriving
  // from it while already on /bookings changes nothing but the query string:
  // folding this into the loader effect meant the second click did nothing at
  // all, because filter/sort/page never change.
  const focusParam = searchParams.get("id");
  const focusNonce = searchParams.get("t");
  const focusKey = focusKeyFrom(focusParam, focusNonce);

  const [focusId, setFocusId] = useState<string | null>(null);
  const [focusBooking, setFocusBooking] = useState<Booking | null>(null);
  const [focusFailed, setFocusFailed] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  // Bumped on every focus so re-picking the *same* session still re-runs the
  // scroll/ring effects. Setting state to a value it already holds would bail
  // out of the re-render and leave the highlight looking already-consumed.
  const [focusTick, setFocusTick] = useState(0);

  useEffect(() => {
    if (!focusKey || !focusParam) {
      setFocusId(null);
      setFocusBooking(null);
      setFocusFailed(false);
      return;
    }
    let cancelled = false;
    setFocusId(focusParam);
    setFocusBooking(null);
    setFocusFailed(false);
    // Highlight straight away so a cached list row lights up without waiting
    // on the round-trip; the pin below covers the case where it is not there.
    setHighlightedId(focusParam);
    setFocusTick((n) => n + 1);
    bookingsApi
      .get(focusParam)
      .then(({ booking }) => {
        if (!cancelled) setFocusBooking(booking);
      })
      .catch(() => {
        if (cancelled) return;
        setFocusFailed(true);
        toast.error("That booking could not be loaded");
      });
    return () => {
      cancelled = true;
    };
  }, [focusKey, focusParam]);

  const clearFocus = useCallback(() => {
    setFocusId(null);
    setFocusBooking(null);
    setFocusFailed(false);
    setHighlightedId(null);
    // The query string is left alone on purpose: keeping `?id=` means a
    // refresh or a shared link still re-focuses, and the bell's nonce makes a
    // repeat click a real navigation instead of a no-op.
  }, []);

  // Changing what you are looking at dismisses the pin, otherwise it would
  // follow the user around a list it no longer belongs to. `viewAs` is in the
  // deps because the pinned snapshot is role-scoped: keeping it across a
  // switch would show one side's booking inside the other side's list.
  //
  // This compares against the *previously seen* values rather than skipping
  // the first run with a ref. StrictMode deliberately double-invokes effects on
  // mount, and a "first run" ref guard reads the second invocation as a real
  // change, so it called clearFocus() on every mount and wiped the highlight
  // before the card could ever render. Comparing values makes an identical
  // re-run a genuine no-op.
  const lastView = useRef<ViewKey>({ filter, sort, page, viewAs });
  useEffect(() => {
    const prev = lastView.current;
    lastView.current = { filter, sort, page, viewAs };
    if (!shouldDismissFocus(prev, { filter, sort, page, viewAs })) return;
    clearFocus();
  }, [filter, sort, page, viewAs, clearFocus]);

  // The list only holds 10 rows of the current filter/page, while the bell
  // links the *soonest* upcoming session. With the default `latest` sort
  // (newest start first) that session is usually on the last page, so pin it
  // above the list when the row is not actually rendered.
  const { pinned: focusPinned } = resolveFocus(
    focusId,
    bookings.map((b) => b.id),
    loading,
  );

  useEffect(() => {
    if (!highlightedId) return;
    const el = document.getElementById(`booking-${highlightedId}`);
    // Wait for the target to actually exist before doing anything. Arriving
    // here from another page means the list is still in flight, so the row is
    // not in the DOM yet; starting the ring timer now would expire the
    // highlight before the card ever rendered. Re-running on `loading` /
    // focusPinned / focusBooking picks it up as soon as the row (or the pin)
    // appears.
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    // Clearing state instead of stripping the class keeps React in charge of
    // the ring, so it cannot be re-applied by an unrelated re-render.
    const timeout = setTimeout(() => setHighlightedId(null), 4000);
    return () => clearTimeout(timeout);
  }, [highlightedId, focusTick, loading, focusPinned, focusBooking]);

  const handleComplete = async (booking: Booking) => {
    setSubmitting(true);
    try {
      await bookingsApi.complete(booking.id);
      toast.success("Booking marked as completed");
      // The pinned copy is a snapshot from before the change, so drop the
      // focus and let the refreshed list speak for itself.
      clearFocus();
      setPage(0);
      void load(0, true);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to complete");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelDialog) return;
    setSubmitting(true);
    try {
      await bookingsApi.cancel(cancelDialog.id, cancelReason.trim() || undefined);
      toast.success("Booking cancelled");
      setCancelDialog(null);
      setCancelReason("");
      clearFocus();
      setPage(0);
      void load(0, true);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReschedule = async () => {
    if (!rescheduleDialog || !newDateTime) return;
    setSubmitting(true);
    try {
      const iso = new Date(newDateTime).toISOString();
      await bookingsApi.reschedule(rescheduleDialog.id, iso);
      toast.success("Booking rescheduled");
      setRescheduleDialog(null);
      setNewDateTime("");
      clearFocus();
      setPage(0);
      void load(0, true);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to reschedule");
    } finally {
      setSubmitting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const statusCounts = {
    all: counts?.all ?? total,
    Confirmed: counts?.Confirmed ?? bookings.filter(isUpcoming).length,
    Completed: counts?.Completed ?? bookings.filter((b) => b.status === "Completed").length,
    CancelledByClient: counts?.Cancelled ?? bookings.filter((b) => b.status.startsWith("Cancelled")).length,
  };

  const openCancel = (b: Booking) => {
    setCancelDialog(b);
    setCancelReason("");
  };

  const openReschedule = (b: Booking) => {
    setRescheduleDialog(b);
    setNewDateTime("");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{isClient ? "My Bookings" : "Bookings"}</h1>
        <p className="text-muted-foreground">
          {isClient
            ? "Track your booked sessions with astrologers"
            : "Manage your client bookings and schedule"}
        </p>
      </div>

      <Tabs
        value={filter}
        onValueChange={(v) => {
          setFilter(v);
          setPage(0);
        }}
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <TabsList>
            <TabsTrigger className="hover:cursor-pointer" value="all">All ({statusCounts.all})</TabsTrigger>
            <TabsTrigger className="hover:cursor-pointer" value="Confirmed">Upcoming ({statusCounts.Confirmed})</TabsTrigger>
            <TabsTrigger className="hover:cursor-pointer" value="Completed">Completed ({statusCounts.Completed})</TabsTrigger>
          </TabsList>

          <Select
            value={sort}
            onValueChange={(v) => {
              setSort(v as SortOrder);
              setPage(0);
            }}
          >
            <SelectTrigger className="w-full md:w-[140px] hover:cursor-pointer" aria-label="Sort bookings">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem className="hover:cursor-pointer" value="latest">Latest</SelectItem>
              <SelectItem className="hover:cursor-pointer" value="oldest">Oldest</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <TabsContent value={filter}>
          {focusPinned ? (
            <div className="mb-4 space-y-2">
              <div className="flex items-center justify-between gap-2 rounded-md border border-primary/40 bg-primary/5 px-3 py-2">
                <p className="text-xs text-muted-foreground">
                  {focusFailed
                    ? "That booking is no longer available."
                    : "Showing the session you picked \u2014 it is outside the current tab and page."}
                </p>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title="Dismiss"
                  aria-label="Dismiss selected booking"
                  onClick={clearFocus}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
              {focusBooking && (
                <BookingCard
                  booking={focusBooking}
                  isClient={isClient}
                  cardId={focusBooking.id ? `booking-${focusBooking.id}` : undefined}
                  highlighted={highlightedId === focusBooking.id}
                  submitting={submitting}
                  onComplete={handleComplete}
                  onCancel={openCancel}
                  onReschedule={openReschedule}
                />
              )}
            </div>
          ) : null}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : bookings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <CalendarDays className="h-12 w-12 mb-4" />
              <p>{filter === "Confirmed" ? "No upcoming sessions." : "No bookings found."}</p>
              {filter === "Confirmed" && (
                <p className="mt-1 text-sm">Sessions you have already had are under All.</p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {bookings.map((b) => (
                <BookingCard
                  key={b.id}
                  booking={b}
                  isClient={isClient}
                  cardId={`booking-${b.id}`}
                  highlighted={highlightedId === b.id}
                  submitting={submitting}
                  onComplete={handleComplete}
                  onCancel={openCancel}
                  onReschedule={openReschedule}
                />
              ))}
            </div>
          )}
          {bookings.length > 0 && totalPages > 1 && (
            <Pagination className="mt-6">
              <PaginationContent>
                <PaginationItem>
                  <PaginationLink
                    href="#"
                    aria-disabled={page === 0}
                    className={page === 0 ? "pointer-events-none opacity-50" : undefined}
                    onClick={(e) => {
                      e.preventDefault();
                      if (page > 0) {
                        setPage(page - 1);
                      }
                    }}
                  >
                    <ChevronLeft />
                    <span className="sr-only">Previous</span>
                  </PaginationLink>
                </PaginationItem>

                {Array.from({ length: totalPages }, (_, i) => (
                  <PaginationItem key={i}>
                    <PaginationLink
                      href="#"
                      isActive={i === page}
                      onClick={(e) => {
                        e.preventDefault();
                        setPage(i);
                      }}
                    >
                      {i + 1}
                    </PaginationLink>
                  </PaginationItem>
                ))}

                <PaginationItem>
                  <PaginationLink
                    href="#"
                    aria-disabled={page >= totalPages - 1}
                    className={page >= totalPages - 1 ? "pointer-events-none opacity-50" : undefined}
                    onClick={(e) => {
                      e.preventDefault();
                      if (page < totalPages - 1) {
                        setPage(page + 1);
                      }
                    }}
                  >
                    <ChevronRight />
                    <span className="sr-only">Next</span>
                  </PaginationLink>
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </TabsContent>
      </Tabs>

      {/* Cancel Dialog */}
      <Dialog open={!!cancelDialog} onOpenChange={(open) => !open && setCancelDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Booking</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this booking?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {cancelDialog && (
              <p className="text-sm rounded-md bg-muted p-3">
                Booking with{" "}
                {isClient
                  ? cancelDialog.astrologer?.user.name ?? "Astrologer"
                  : cancelDialog.client?.name ?? "Client"}{" "}
                on {new Date(cancelDialog.startAt).toLocaleString()}
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="cancel-reason">Reason (optional)</Label>
              <Textarea
                id="cancel-reason"
                placeholder="Why are you cancelling?"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialog(null)}>
              Keep Booking
            </Button>
            <Button variant="destructive" onClick={handleCancel} disabled={submitting}>
              {submitting ? "Cancelling..." : "Cancel Booking"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reschedule Dialog */}
      <Dialog open={!!rescheduleDialog} onOpenChange={(open) => !open && setRescheduleDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reschedule Booking</DialogTitle>
            <DialogDescription>Pick a new date and time</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {rescheduleDialog && (
              <p className="text-sm rounded-md bg-muted p-3">
                Current: {new Date(rescheduleDialog.startAt).toLocaleString()}
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="new-datetime">New Date & Time</Label>
              <Input
                id="new-datetime"
                type="datetime-local"
                value={newDateTime}
                onChange={(e) => setNewDateTime(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRescheduleDialog(null)}>
              Cancel
            </Button>
            <Button onClick={handleReschedule} disabled={submitting || !newDateTime}>
              {submitting ? "Rescheduling..." : "Reschedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
