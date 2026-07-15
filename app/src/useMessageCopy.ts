import { useState } from "react";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";

import type { ChatMessage } from "./chatConversation";

export function useMessageCopy() {
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const copyMessage = async (message: ChatMessage) => {
    await writeText(message.text);
    setCopiedMessageId(message.id);
    window.setTimeout(() => setCopiedMessageId((current) => current === message.id ? null : current), 1500);
  };
  return { copiedMessageId, copyMessage };
}
