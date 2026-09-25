import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useStore } from "@/store";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HelpCircle } from "lucide-react";

const CLOSED_STATUSES = ["Rejected", "Refunded"];
const OPEN_STATUSES = new Set(["PendingPayment", "Queued"]);

type QuestionFilter = "all" | "open" | "answered" | "closed";

export default function ClientQuestionsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const threadParam = searchParams.get("thread");

  const stats = useStore((s) => s.stats);
  const pageData = useStore((s) => s.questionPages["all:0"]);
  const questions = useMemo(() => pageData?.items ?? [], [pageData]);
  const loading = useStore((s) => s.questionsLoading && !pageData);
  const loadQuestions = useStore((s) => s.loadQuestions);
  const loadStats = useStore((s) => s.loadStats);

  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<QuestionFilter>("all");

  const load = useCallback(
    async (force = false) => {
      await Promise.all([loadQuestions("all", 0, force), loadStats(force)]);
    },
    [loadQuestions, loadStats],
  );

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Deep link to a specific conversation: open the full-page chat window.
  useEffect(() => {
    if (!threadParam) return;
    navigate(`/questions/${threadParam}`, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadParam]);

  const filtered = useMemo(
    () =>
      filter === "all"
        ? questions
        : filter === "open"
          ? questions.filter((q) => OPEN_STATUSES.has(q.status))
          : filter === "answered"
            ? questions.filter((q) => q.status === "Answered")
            : questions.filter((q) => CLOSED_STATUSES.includes(q.status)),
    [questions, filter],
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / 10));
  const safePage = Math.min(page, totalPages);
  const pageQuestions = filtered.slice(safePage * 10, safePage * 10 + 10);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Questions</h1>
        <p className="text-muted-foreground">
          Continue your conversation with each astrologer here
        </p>
      </div>

      <Tabs
        value={filter}
        onValueChange={(v) => {
          setFilter(v as QuestionFilter);
          setPage(0);
        }}
      >
        <TabsList>
          <TabsTrigger value="all">All ({questions.length})</TabsTrigger>
          <TabsTrigger value="open">Open ({stats?.pendingQuestions ?? 0})</TabsTrigger>
          <TabsTrigger value="answered">Answered ({stats?.answeredQuestions ?? 0})</TabsTrigger>
          <TabsTrigger value="closed">Closed</TabsTrigger>
        </TabsList>

        <TabsContent value={filter}>
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : pageQuestions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <HelpCircle className="h-12 w-12 mb-4" />
              <p>
                {questions.length === 0
                  ? "You haven't asked any questions yet. Ask one from any astrologer's page."
                  : "No questions match this filter."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {pageQuestions.map((q) => (
                <Card
                  key={q.id}
                  className="cursor-pointer transition-colors hover:bg-accent/50"
                  onClick={() => navigate(`/questions/${q.id}`)}
                >
                  <CardContent className="flex items-start justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium line-clamp-1">{q.questionText}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {q.astrologer?.user.name ?? "Astrologer"}
                        {q.category ? ` · ${q.category}` : ""}
                        {q.lastMessage
                          ? ` · ${q.lastMessage.senderRole === "Astrologer" ? "Astrologer" : "You"}: ${q.lastMessage.body.slice(0, 60)}`
                          : ""}
                      </p>
                    </div>
                    <Badge
                      variant={
                        q.status === "Answered"
                          ? "default"
                          : q.status === "Queued"
                            ? "secondary"
                            : CLOSED_STATUSES.includes(q.status)
                              ? "destructive"
                              : "outline"
                      }
                      className="shrink-0"
                    >
                      {q.status}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}