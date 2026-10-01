import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell, Video } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth";
import { useStore } from "@/store";
import { bookingFocusHref } from "@/lib/booking-focus";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Booking } from "@/types";
import {
  REMINDER_LEAD_MS,
  formatCountdown,
  imminentBookings,
  loadAlerted,
  msUntilStart,
  saveAlerted,
} from "@/lib/booking-reminders";

/** Matched to the store's upcoming TTL so a poll and a remount agree. */
const POLL_MS = 30_000;
/** How far ahead the dropdown looks. The store returns more; nobody reads 10 rows. */
const VISIBLE = 5;

export function BookingBell() {
  const { user } = useAuth();
  const viewAs = useStore((s) => s.viewAs);
  const upcoming = useStore((s) => s.upcomingBookings);
  const loadUpcomingBookings = useStore((s) => s.loadUpcomingBookings);
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const alertedRef = useRef<Set<string> | null>(null);
  const alertedScopeRef = useRef<string | null>(null);

  const userId = user?.id ?? null;
  const scope = userId ? `${userId}:${viewAs}` : null;

  useEffect(() => {
    if (!userId) return;
    // Respect the store TTL on mount so bouncing between dashboard pages does
    // not refetch; the interval below always forces a fresh read.
    void loadUpcomingBookings();
    const id = setInterval(() => void loadUpcomingBookings(true), POLL_MS);
    return () => clearInterval(id);
  }, [userId, viewAs, loadUpcomingBookings]);

  // The bell owns the only ticking clock in the navbar, so countdowns stay
  // live without every consumer re-rendering on a timer.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!scope) return;
    if (alertedScopeRef.current !== scope) {
      alertedRef.current = loadAlerted(scope);
      alertedScopeRef.current = scope;
    }
    const alerted = alertedRef.current;
    if (!alerted) return;

    const fresh: Booking[] = [];
    for (const booking of upcoming) {
      const delta = msUntilStart(booking, now);
      if (delta <= 0 || delta > REMINDER_LEAD_MS) continue;
      if (alerted.has(booking.id)) continue;
      alerted.add(booking.id);
      fresh.push(booking);
    }
    if (fresh.length === 0) return;

    // Persist before toasting: a reload mid-render must not replay these.
    saveAlerted(scope, alerted);
    for (const booking of fresh) {
      const who = viewAs === "astrologer" ? booking.client?.name : booking.astrologer?.user?.name;
      toast("Session starting soon", {
        description: `${who ? `With ${who}. ` : ""}Starts ${formatCountdown(msUntilStart(booking, now))}.`,
        duration: 12_000,
        action: {
          label: "View booking",
          onClick: () => navigate(bookingFocusHref(booking.id)),
        },
      });
    }
  }, [upcoming, now, scope, viewAs, navigate]);

  const imminent = useMemo(() => imminentBookings(upcoming, now), [upcoming, now]);
  const pending = useMemo(() => upcoming.filter((b) => msUntilStart(b, now) > 0), [upcoming, now]);
  const visible = useMemo(() => pending.slice(0, VISIBLE), [pending]);
  // The inline label tracks the next session at any distance; only the badge is
  // scoped to the reminder window, so a session two hours out still reads as
  // upcoming rather than "nothing".
  const [nextSession] = pending;
  const nextDelta = nextSession ? msUntilStart(nextSession, now) : null;

  const close = useCallback(() => setOpen(false), []);

  if (!user) return null;

  const nextTitle = nextDelta === null ? "Upcoming sessions" : `Next session ${formatCountdown(nextDelta)}`;
  const bellLabel = [
    "Upcoming sessions",
    imminent.length ? `${imminent.length} starting soon` : null,
    nextDelta === null ? null : `next ${formatCountdown(nextDelta)}`,
  ]
    .filter(Boolean)
    .join(": ");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" title={nextTitle} aria-label={bellLabel}>
          <span className="relative flex shrink-0">
            <Bell className="h-4 w-4" />
            {imminent.length > 0 && (
              <span
                className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground"
                aria-hidden="true"
              >
                {imminent.length}
              </span>
            )}
          </span>
          <span className="hidden whitespace-nowrap text-xs font-medium tabular-nums sm:inline">
            {nextDelta === null ? "No upcoming" : formatCountdown(nextDelta)}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
          <p className="text-sm font-semibold">Upcoming sessions</p>
          {pending.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {pending.length} scheduled
            </span>
          )}
        </div>
        {visible.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            Nothing scheduled ahead.
          </p>
        ) : (
          <ul className="max-h-80 overflow-y-auto py-1">
            {visible.map((booking) => {
              const delta = msUntilStart(booking, now);
              const who = viewAs === "astrologer" ? booking.client?.name : booking.astrologer?.user?.name;
              const soon = delta <= REMINDER_LEAD_MS;
              return (
                <li key={booking.id}>
                  <Link
                    to={bookingFocusHref(booking.id)}
                    onClick={close}
                    className="flex items-center gap-3 px-3 py-2 transition-colors hover:bg-accent"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {who ?? (viewAs === "astrologer" ? "Client" : "Astrologer")}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {new Date(booking.startAt).toLocaleString(undefined, {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 text-xs font-medium tabular-nums ${
                        soon ? "text-primary" : "text-muted-foreground"
                      }`}
                    >
                      {formatCountdown(delta)}
                    </span>
                  </Link>
                  {booking.meetingLink && (
                    <a
                      href={booking.meetingLink}
                      target="_blank"
                      rel="noreferrer"
                      onClick={close}
                      className="mx-3 mb-1.5 flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      <Video className="h-3 w-3" />
                      Join call
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <div className="border-t px-3 py-2">
          <Link
            to="/bookings"
            onClick={close}
            className="text-xs font-medium text-primary hover:underline"
          >
            View all bookings
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
