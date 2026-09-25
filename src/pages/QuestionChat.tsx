import { ChatWindow } from "@/components/ChatWindow";
import { useStore } from "@/store";

export default function QuestionChatPage() {
  const viewAs = useStore((s) => s.viewAs);
  return <ChatWindow side={viewAs === "client" ? "client" : "astrologer"} />;
}