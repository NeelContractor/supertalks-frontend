import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "@/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HelpCircle, CalendarDays, IndianRupee, Clock } from "lucide-react";

export default function DashboardPage() {
  const user = useStore((s) => s.user);
  const profile = useStore((s) => s.profile);
  const stats = useStore((s) => s.stats);
  const recentBookings = (useStore((s) => s.bookingPages["all:0"]?.items) ?? []).slice(0, 5);
  const recentQuestions = (useStore((s) => s.questionPages["all:0"]?.items) ?? []).slice(0, 5);
  const loadStats = useStore((s) => s.loadStats);
  const loadBookings = useStore((s) => s.loadBookings);
  const loadQuestions = useStore((s) => s.loadQuestions);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([loadStats(), loadBookings("all", 0), loadQuestions("all", 0)]).finally(
      () => setLoading(false),
    );
  }, [loadStats, loadBookings, loadQuestions]);

  const pendingQuestions = stats?.pendingQuestions ?? 0;
  const upcomingBookings = stats?.upcomingBookings ?? 0;
  const totalEarnings = stats?.totalEarningsPaise ?? 0;
  const totalQuestions = stats?.totalQuestions ?? 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">
          Welcome, {user?.name ?? "Astrologer"}
        </h1>
        <p className="text-muted-foreground">
          {profile?.status === "Approved"
            ? "Your profile is live and accepting clients."
            : profile?.status === "Pending"
              ? "Your profile is under review. You'll be approved soon."
              : "Set up your profile to start receiving clients."}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending Questions</CardTitle>
            <HelpCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingQuestions}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Upcoming Bookings</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{upcomingBookings}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
            <IndianRupee className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₹{(totalEarnings / 100).toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Questions</CardTitle>
            <HelpCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalQuestions}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Questions</CardTitle>
            <Link to="/questions" className="text-sm text-primary hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {recentQuestions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No questions yet.</p>
            ) : (
              <div className="space-y-3">
                {recentQuestions.map((q) => (
                  <Link
                    key={q.id}
                    to={`/questions?id=${q.id}`}
                    className="flex items-start justify-between gap-2 rounded-md border p-3 transition-colors hover:bg-accent/50 cursor-pointer"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm line-clamp-1">{q.questionText}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {q.client?.name ?? "Client"}
                      </p>
                    </div>
                    <Badge
                      variant={
                        q.status === "Answered"
                          ? "default"
                          : q.status === "Queued"
                            ? "secondary"
                            : q.status === "Rejected"
                              ? "destructive"
                              : "outline"
                      }
                    >
                      {q.status}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Bookings</CardTitle>
            <Link to="/bookings" className="text-sm text-primary hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {recentBookings.length === 0 ? (
              <p className="text-sm text-muted-foreground">No bookings yet.</p>
            ) : (
              <div className="space-y-3">
                {recentBookings.map((b) => (
                  <Link
                    key={b.id}
                    to={`/bookings?id=${b.id}`}
                    className="flex items-start justify-between gap-2 rounded-md border p-3 transition-colors hover:bg-accent/50 cursor-pointer"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{b.client?.name ?? "Client"}</p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                        <Clock className="h-3 w-3" />
                        {new Date(b.startAt).toLocaleString()}
                      </div>
                    </div>
                    <Badge variant="secondary">{b.status}</Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}