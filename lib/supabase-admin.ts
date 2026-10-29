import "server-only";
import { createAdminClient } from "@supabase/server/core";

export function getSupabaseAdmin() {
  return createAdminClient();
}

export interface ConversationSummary {
  id: string;
  channel: string;
  startedAt: string;
  messageCount: number;
}

export interface ConversationMessageRow {
  id: string;
  sender: "user" | "bot";
  content: string;
  createdAt: string;
}

export interface ConversationDetail extends ConversationSummary {
  messages: ConversationMessageRow[];
}

export async function listConversations(): Promise<ConversationSummary[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("conversations")
    .select("id, channel, started_at, conversation_messages(count)")
    .order("started_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id as string,
    channel: row.channel as string,
    startedAt: row.started_at as string,
    messageCount: (row.conversation_messages as { count: number }[] | null)?.[0]?.count ?? 0,
  }));
}

export async function getConversation(id: string): Promise<ConversationDetail | null> {
  const supabase = getSupabaseAdmin();

  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .select("id, channel, started_at")
    .eq("id", id)
    .maybeSingle();

  if (conversationError) throw conversationError;
  if (!conversation) return null;

  const { data: messages, error: messagesError } = await supabase
    .from("conversation_messages")
    .select("id, sender, content, created_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  if (messagesError) throw messagesError;

  return {
    id: conversation.id as string,
    channel: conversation.channel as string,
    startedAt: conversation.started_at as string,
    messageCount: messages?.length ?? 0,
    messages: (messages ?? []).map((m) => ({
      id: m.id as string,
      sender: m.sender as "user" | "bot",
      content: m.content as string,
      createdAt: m.created_at as string,
    })),
  };
}

export async function deleteConversation(id: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  // conversation_messages has ON DELETE CASCADE on conversation_id, nên chỉ cần xóa conversations.
  const { error } = await supabase.from("conversations").delete().eq("id", id);
  if (error) throw error;
}
