import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useStore } from "@/store";
import { bookingsApi } from "@/lib/api";
import type { Booking } from "@/types";
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
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
} from "@/components/ui/pagination";
import { toast } from "sonner";
import { CalendarDays, Clock, CheckCircle, XCircle, ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE = 10;

export default function BookingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(0);
  const pageData = useStore((s) => s.bookingPages[`${filter}:${page}`]);
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
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  const load = useCallback(async (targetPage: number, force = false) => {
    try {
      const data = await loadBookings(filter, targetPage, force);
      const highlightId = searchParams.get("id");
      if (highlightId && targetPage === 0) {
        setHighlightedId(highlightId);
        setSearchParams({}, { replace: true });
      }
      return data;
    } catch {
      toast.error("Failed to load bookings");
      return null;
    }
  }, [filter, loadBookings, searchParams, setSearchParams]);

  useEffect(() => {
    void load(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, page]);

  useEffect(() => {
    if (!loading && highlightedId) {
      const el = document.getElementById(`booking-${highlightedId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      const id = highlightedId;
      const timeout = setTimeout(() => {
        const el2 = document.getElementById(`booking-${id}`);
        if (el2) el2.classList.remove("ring-2", "ring-primary");
      }, 2000);
      return () => clearTimeout(timeout);
    }
  }, [loading, highlightedId]);

  const handleComplete = async (booking: Booking) => {
    setSubmitting(true);
    try {
      await bookingsApi.complete(booking.id);
      toast.success("Booking marked as completed");
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
    Confirmed: counts?.Confirmed ?? bookings.filter((b) => b.status === "Confirmed").length,
    Completed: counts?.Completed ?? bookings.filter((b) => b.status === "Completed").length,
    CancelledByClient: counts?.Cancelled ?? bookings.filter((b) => b.status.startsWith("Cancelled")).length,
  };

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    if (status === "Completed") return "default";
    if (status === "Confirmed") return "secondary";
    if (status.startsWith("Cancelled")) return "destructive";
    return "outline";
  };

  const isUpcoming = (b: Booking) =>
    b.status === "Confirmed" && new Date(b.startAt) > new Date();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Bookings</h1>
        <p className="text-muted-foreground">Manage your client bookings and schedule</p>
      </div>

      <Tabs
        value={filter}
        onValueChange={(v) => {
          setFilter(v);
          setPage(0);
        }}
      >
        <TabsList>
          <TabsTrigger value="all">All ({statusCounts.all})</TabsTrigger>
          <TabsTrigger value="Confirmed">Upcoming ({statusCounts.Confirmed})</TabsTrigger>
          <TabsTrigger value="Completed">Completed ({statusCounts.Completed})</TabsTrigger>
        </TabsList>

        <TabsContent value={filter}>
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : bookings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <CalendarDays className="h-12 w-12 mb-4" />
              <p>No bookings found.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {bookings.map((b) => (
                <Card
                  key={b.id}
                  id={`booking-${b.id}`}
                  className={highlightedId === b.id ? "ring-2 ring-primary" : ""}
                >
                  <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
                    <div className="space-y-1">
                      <CardTitle className="text-base">{b.client?.name ?? "Client"}</CardTitle>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {new Date(b.startAt).toLocaleString()}
                        </span>
                        <span>₹{(b.pricePaise / 100).toLocaleString()}</span>
                      </div>
                    </div>
                    <Badge variant={getStatusVariant(b.status)}>{b.status}</Badge>
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
                    {b.clientNote && (
                      <p className="text-sm text-muted-foreground mt-2">Note: {b.clientNote}</p>
                    )}
                    {b.cancellationReason && (
                      <p className="text-sm text-destructive mt-2">
                        Cancellation reason: {b.cancellationReason}
                      </p>
                    )}
                    {isUpcoming(b) && (
                      <div className="flex gap-2 mt-3">
                        <Button size="sm" onClick={() => handleComplete(b)} disabled={submitting}>
                          <CheckCircle className="h-3.5 w-3.5" />
                          Complete
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setRescheduleDialog(b);
                            setNewDateTime("");
                          }}
                        >
                          Reschedule
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            setCancelDialog(b);
                            setCancelReason("");
                          }}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Cancel
                        </Button>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-3">
                      Booked {new Date(b.createdAt).toLocaleString()}
                    </p>
                  </CardContent>
                </Card>
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
                Booking with {cancelDialog.client?.name ?? "Client"} on{" "}
                {new Date(cancelDialog.startAt).toLocaleString()}
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
