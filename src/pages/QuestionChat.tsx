import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useStore } from "@/store";
import { questionsApi } from "@/lib/api";
import { connectQuestionSocket } from "@/lib/ws";
import type { Question, QuestionMessage as ChatMessage } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Send, ArrowLeft } from "lucide-react";

// Astrologers can only reply once the client has paid for a message.
const TALKABLE = ["Queued", "Answered"];

export default function QuestionChatPage() {
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
  const listRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    try {
      await loadThread(id);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to load conversation");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    void load();

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

  const canSend = question ? TALKABLE.includes(question.status) : false;

  const handleSend = async () => {
    if (!question || !draft.trim() || !canSend) return;
    setSending(true);
    try {
      const { message, question: updated } = await questionsApi.sendMessage(question.id, draft.trim());
      upsertMessage(question.id, message);
      setQuestionStatus(question.id, updated.status);
      setDraft("");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  };

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
                <h1 className="min-w-0 truncate text-sm font-semibold">
                  {question.client?.name ?? "Client"}
                </h1>
                {/* {question.category && (
                  <Badge variant="outline" className="shrink-0 text-[10px]">
                    {question.category}
                  </Badge>
                )} */}
              </div>
              {/* <Badge variant={question.status === "Answered" ? "default" : "secondary"} className="shrink-0">
                {question.status}
              </Badge> */}
            </div>
            <p className="truncate px-3 pb-2 text-xs text-muted-foreground">{question.questionText}</p>
          </div>

          <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <p className="pt-8 text-center text-sm text-muted-foreground">
                No messages yet. Reply to start the conversation.
              </p>
            ) : (
              messages.map((m) => {
                const mine = m.senderRole === "Astrologer";
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

            {question.status === "PendingPayment" ? (
              <p className="border-t p-3 text-sm text-muted-foreground">
                This client hasn't paid for a message yet. You'll be able to reply once they do.
              </p>
            ) : !canSend ? (
              <p className="border-t p-3 text-sm text-destructive">This thread is closed.</p>
            ) : (
              <div className="flex items-center gap-2 border-t p-3">
                <Input
                  placeholder="Type a reply…"
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