import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useStore } from "@/store";
import { questionsApi } from "@/lib/api";
import { connectQuestionSocket } from "@/lib/ws";
import { runCheckout, useGatewayReturn } from "@/lib/pay";
import type { ViewAs } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, ArrowLeft, ChevronDown } from "lucide-react";

const TALKABLE = ["Queued", "Answered"];
const CLOSED_STATUSES = ["Rejected", "Refunded"];

/** "1990-05-14" -> "14 May 1990"; passes anything unparseable through. */
function formatBirthDate(value: string | undefined): string | undefined {
  if (!value) return value;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return value;
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** "18:30" -> "06:30 PM"; "06:30" -> "06:30 AM"; passes garbage through. */
function formatBirthTime(value: string | undefined): string | undefined {
  if (!value) return value;
  const m = /^(\d{2}):(\d{2})$/.exec(value);
  if (!m) return value;
  const h = Number(m[1]);
  if (h > 23) return value;
  const suffix = h >= 12 ? "PM" : "AM";
  const hh = h % 12 || 12;
  return `${String(hh).padStart(2, "0")}:${m[2]} ${suffix}`;
}

/**
 * Full-page conversation window shared by both sides of the product. The side
 * decides which participant is "you", who to address in the header, and whether
 * messages are paid (clients) or free (astrologers).
 */
export function ChatWindow({ side }: { side: ViewAs }) {
  const isClient = side === "client";
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const question = useStore((s) => s.questionById[id]);
  const messages = useStore((s) => s.messagesByQuestion?.[id]) ?? [];
  const loadThread = useStore((s) => s.loadThread);
  const upsertMessage = useStore((s) => s.upsertMessage);
  const setQuestionStatus = useStore((s) => s.setQuestionStatus);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [banner, setBanner] = useState<{ ok: boolean; message: string } | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // Client only: back from the payment gateway, settle & refresh the thread.
  useGatewayReturn((_outcome, _paymentId, status) => {
    if (!isClient) return;
    setDraft("");
    setBanner({
      ok: status === "success",
      message:
        status === "success"
          ? "Payment successful!"
          : status === "failed"
            ? "Payment failed. You can try again if you'd like."
            : status === "pending"
              ? "Payment is being processed. We'll confirm shortly."
              : "Payment could not be completed.",
    });
    if (status === "success") {
      void loadThread(id, true);
        void useStore.getState().loadQuestions("all", 0, "latest", true);
    }
  });

  useEffect(() => {
    setLoading(true);
    setBanner(null);
    void loadThread(id)
      .catch((err: unknown) =>
        setBanner({ ok: false, message: err instanceof Error ? err.message : "Could not open chat." }),
      )
      .finally(() => setLoading(false));

    const disconnect = connectQuestionSocket(id, {
      onMessage: ({ message, question: q }) => {
        upsertMessage(id, message);
        setQuestionStatus(id, q.status);
      },
      onQuestionUpdate: ({ status }) => setQuestionStatus(id, status),
    });

    return () => disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const isClosed = isClient
    ? CLOSED_STATUSES.includes(question?.status ?? "")
    : question !== null &&
      question !== undefined &&
      question.status !== "PendingPayment" &&
      !TALKABLE.includes(question.status);

  const handleSend = async () => {
    if (!question || !draft.trim()) return;
    setSending(true);
    setBanner(null);
    try {
      const result = await questionsApi.sendMessage(question.id, draft.trim());
      // Astrologer replies never require payment; client replies do.
      if (result.requiresPayment) {
        setBanner({ ok: true, message: "Redirecting to secure payment…" });
        const outcome = await runCheckout(result.payment, window.location.href);
        if (outcome === "redirect") return;
        if (outcome.message) upsertMessage(question.id, outcome.message);
        if (outcome.question) setQuestionStatus(outcome.question.id, outcome.question.status);
        setDraft("");
        setBanner({ ok: true, message: "Payment successful! Your message has been sent." });
        void loadThread(question.id, true);
      void useStore.getState().loadQuestions("all", 0, "latest", true);
        return;
      }
      upsertMessage(question.id, result.message);
      setQuestionStatus(result.question.id, result.question.status);
      setDraft("");
      if (isClient) void useStore.getState().loadQuestions("all", 0, "latest", true);
    } catch (err: unknown) {
      setBanner({
        ok: false,
        message: err instanceof Error ? err.message : "Could not send your message.",
      });
    } finally {
      setSending(false);
    }
  };

  const headerName = isClient
    ? question?.astrologer?.user.name ?? "Astrologer"
    : question?.client?.name ?? "Client";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : question ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="border-b bg-muted/30">
            <div className="flex min-w-0 items-center justify-between gap-2 px-3 pt-2">
              <div className="flex min-w-0 items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-1.5 shrink-0 px-2"
                  onClick={() => navigate("/questions")}
                >
                  <ArrowLeft className="h-4 w-4 mr-1" /> Back
                </Button>
                <h1 className="min-w-0 truncate text-sm font-semibold">{headerName}</h1>
              </div>
            </div>
            <p className="truncate px-3 pb-2 text-xs text-muted-foreground">{question.questionText}</p>
          </div>

          {!isClient && (
            <div className="border-b">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-xs font-medium"
                onClick={() => setShowDetails((v) => !v)}
              >
                <span className="text-muted-foreground">Client details</span>
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform ${showDetails ? "rotate-180" : ""}`}
                />
              </button>
              {showDetails && (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 px-3 pb-3 text-xs">
                  {([
                    ["Name", question.clientDetails?.clientName ?? question.client?.name],
                    ["Birth date", formatBirthDate(question.clientDetails?.birthDate)],
                    ["Birth time", formatBirthTime(question.clientDetails?.birthTime)],
                    ["Birth place", question.clientDetails?.birthPlace],
                  ] as [string, string | undefined][]).map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-muted-foreground">{label}</dt>
                      <dd className="font-medium">{value || "—"}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          )}

          <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <p className="pt-8 text-center text-sm text-muted-foreground">
                {isClient
                  ? "No messages yet. Send a question to start (paid per message)."
                  : "No messages yet. Reply to start the conversation."}
              </p>
            ) : (
              messages.map((m) => {
                const mine = isClient
                  ? m.senderRole === "Client"
                  : m.senderRole === "Astrologer";
                return (
                  <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                        mine ? "bg-primary text-primary-foreground" : "bg-muted"
                      }`}
                    >
                      {!mine && m.sender?.name && (
                        <p className="text-xs font-medium text-muted-foreground mb-0.5">{m.sender.name}</p>
                      )}
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      <p className={`mt-1 text-[10px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                        {new Date(m.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {banner && (
            <p className={`border-t p-3 text-sm ${banner.ok ? "text-muted-foreground" : "text-destructive"}`}>
              {banner.message}
            </p>
          )}

          {question.status === "PendingPayment" && !isClient ? (
            <p className="border-t p-3 text-sm text-muted-foreground">
              This client hasn't paid for a message yet. You'll be able to reply once they do.
            </p>
          ) : isClosed ? (
            <p className={`border-t p-3 text-sm ${isClient ? "text-muted-foreground" : "text-destructive"}`}>
              {isClient ? "This conversation is closed." : "This thread is closed."}
            </p>
          ) : (
            <div className="flex items-center gap-2 border-t p-3">
              <Input
                placeholder={isClient ? "Type a question (paid per message)…" : "Type a reply…"}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
                disabled={sending}
              />
              <Button size="icon" onClick={() => void handleSend()} disabled={sending || !draft.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      ) : (
        <p className="flex flex-1 items-center justify-center text-muted-foreground">
          Conversation not found.
        </p>
      )}
    </div>
  );
}