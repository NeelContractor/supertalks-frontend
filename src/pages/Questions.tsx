import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { questionsApi } from "@/lib/api";
import type { Question, QuestionCounts } from "@/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
} from "@/components/ui/pagination";
import { toast } from "sonner";
import { MessageSquare, ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE = 10;

// Astrologers only see paid questions; only queued (unanswered-paid) ones can be rejected.
const REJECTABLE_STATUSES = ["Queued"];

export default function QuestionsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<QuestionCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [rejectDialog, setRejectDialog] = useState<Question | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async (targetPage: number) => {
    setLoading(true);
    try {
      const status = filter === "all" ? undefined : filter;
      const offset = targetPage * PAGE_SIZE;
      const data = await questionsApi.list(status, PAGE_SIZE, offset);
      setQuestions(data.questions);
      setTotal(data.total);
      setCounts(data.counts);

      const highlightId = searchParams.get("id");
      if (highlightId && targetPage === 0) {
        const match = data.questions.find((q) => q.id === highlightId);
        if (match) {
          navigate(`/questions/${match.id}`, { replace: true });
        } else {
          setSearchParams({}, { replace: true });
        }
      }
    } catch {
      toast.error("Failed to load questions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleReject = async () => {
    if (!rejectDialog) return;
    setSubmitting(true);
    try {
      await questionsApi.reject(rejectDialog.id, rejectReason.trim() || undefined);
      toast.success("Question rejected");
      setRejectDialog(null);
      setRejectReason("");
      setPage(0);
      load(0);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to reject");
    } finally {
      setSubmitting(false);
    }
  };

  const statusCounts = {
    all: counts?.all ?? total,
    Queued: counts?.Queued ?? questions.filter((q) => q.status === "Queued").length,
    Answered: counts?.Answered ?? questions.filter((q) => q.status === "Answered").length,
    Rejected: counts?.Rejected ?? questions.filter((q) => q.status === "Rejected").length,
    Refunded: counts?.Refunded ?? questions.filter((q) => q.status === "Refunded").length,
  };

  const openChat = (q: Question) => {
    navigate(`/questions/${q.id}`);
  };

  const messagePreview = (q: Question) => {
    if (q.lastMessage) {
      const who = q.lastMessage.senderRole === "Astrologer" ? "You" : q.client?.name ?? "Client";
      return `${who}: ${q.lastMessage.body}`;
    }
    if (q.answerText) return `You: ${q.answerText}`;
    return null;
  };

  const canReply = (q: Question) => q.status === "Queued" || q.status === "Answered";

  const handleUnreject = async (q: Question) => {
    setSubmitting(true);
    try {
      await questionsApi.unreject(q.id);
      toast.success("Question restored to the queue");
      setPage(0);
      load(0);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to unreject");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Questions</h1>
        <p className="text-muted-foreground">Chat with clients about their questions</p>
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
          <TabsTrigger value="Queued">Pending ({statusCounts.Queued})</TabsTrigger>
          <TabsTrigger value="Answered">Answered ({statusCounts.Answered})</TabsTrigger>
          <TabsTrigger value="Rejected">Rejected ({statusCounts.Rejected})</TabsTrigger>
        </TabsList>

        <TabsContent value={filter}>
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : questions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mb-4" />
              <p>No questions found.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {questions.map((q) => (
                <Card key={q.id}>
                  <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
                    <div className="space-y-1">
                      <CardTitle className="text-base">{q.client?.name ?? "Client"}</CardTitle>
                      {q.category && (
                        <Badge variant="outline" className="text-xs">
                          {q.category}
                        </Badge>
                      )}
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
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm">{q.questionText}</p>
                    {messagePreview(q) && (
                      <div className="rounded-md bg-muted p-3">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Last message</p>
                        <p className="text-sm">{messagePreview(q)}</p>
                      </div>
                    )}
                    {q.rejectionReason && (
                      <div className="rounded-md bg-destructive/10 p-3">
                        <p className="text-xs font-medium text-destructive mb-1">Rejection Reason</p>
                        <p className="text-sm">{q.rejectionReason}</p>
                      </div>
                    )}
                    <div className="flex gap-2 pt-2">
                      {canReply(q) ? (
                        <Button size="sm" onClick={() => openChat(q)}>
                          Chat
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => openChat(q)}>
                          View
                        </Button>
                      )}
                      {REJECTABLE_STATUSES.includes(q.status) && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => { setRejectDialog(q); setRejectReason(""); }}
                        >
                          Reject
                        </Button>
                      )}
                      {q.status === "Rejected" && (
                        <Button size="sm" variant="outline" onClick={() => void handleUnreject(q)}>
                          Unreject
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(q.createdAt).toLocaleString()}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          {questions.length > 0 && totalPages > 1 && (
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
                        load(page - 1);
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
                        load(i);
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
                        load(page + 1);
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

      {/* Reject Dialog */}
      <Dialog open={!!rejectDialog} onOpenChange={(open) => !open && setRejectDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Question</DialogTitle>
            <DialogDescription>Optionally provide a reason</DialogDescription>
          </DialogHeader>
          {rejectDialog && (
            <div className="space-y-4">
              <p className="text-sm rounded-md bg-muted p-3">{rejectDialog.questionText}</p>
              <div className="space-y-2">
                <Label htmlFor="reason">Reason (optional)</Label>
                <Textarea
                  id="reason"
                  placeholder="Why are you rejecting this question?"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={submitting}>
              {submitting ? "Submitting..." : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}