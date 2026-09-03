import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
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

export default function QuestionsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<QuestionCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [answerDialog, setAnswerDialog] = useState<Question | null>(null);
  const [rejectDialog, setRejectDialog] = useState<Question | null>(null);
  const [answerText, setAnswerText] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async (targetPage: number) => {
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
          setAnswerDialog(match);
          setAnswerText("");
          setSearchParams({}, { replace: true });
        }
      }
    } catch {
      toast.error("Failed to load questions");
    } finally {
      setLoading(false);
    }
  }, [filter, searchParams, setSearchParams]);

  useEffect(() => {
    load(page);
    // reset page on filter change only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleAnswer = async () => {
    if (!answerDialog || !answerText.trim()) return;
    setSubmitting(true);
    try {
      await questionsApi.answer(answerDialog.id, answerText.trim());
      toast.success("Question answered");
      setAnswerDialog(null);
      setAnswerText("");
      setPage(0);
      load(0);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to answer");
    } finally {
      setSubmitting(false);
    }
  };

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Questions</h1>
        <p className="text-muted-foreground">Answer or reject client questions</p>
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
                    {q.answerText && (
                      <div className="rounded-md bg-muted p-3">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Your Answer</p>
                        <p className="text-sm">{q.answerText}</p>
                      </div>
                    )}
                    {q.rejectionReason && (
                      <div className="rounded-md bg-destructive/10 p-3">
                        <p className="text-xs font-medium text-destructive mb-1">Rejection Reason</p>
                        <p className="text-sm">{q.rejectionReason}</p>
                      </div>
                    )}
                    {q.status === "Queued" && (
                      <div className="flex gap-2 pt-2">
                        <Button size="sm" onClick={() => { setAnswerDialog(q); setAnswerText(""); }}>
                          Answer
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => { setRejectDialog(q); setRejectReason(""); }}
                        >
                          Reject
                        </Button>
                      </div>
                    )}
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

      {/* Answer Dialog */}
      <Dialog open={!!answerDialog} onOpenChange={(open) => !open && setAnswerDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Answer Question</DialogTitle>
            <DialogDescription>From {answerDialog?.client?.name ?? "Client"}</DialogDescription>
          </DialogHeader>
          {answerDialog && (
            <div className="space-y-4">
              <p className="text-sm rounded-md bg-muted p-3">{answerDialog.questionText}</p>
              <div className="space-y-2">
                <Label htmlFor="answer">Your Answer</Label>
                <Textarea
                  id="answer"
                  placeholder="Type your answer here..."
                  value={answerText}
                  onChange={(e) => setAnswerText(e.target.value)}
                  rows={5}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAnswerDialog(null)}>
              Cancel
            </Button>
            <Button onClick={handleAnswer} disabled={submitting || !answerText.trim()}>
              {submitting ? "Submitting..." : "Submit Answer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
