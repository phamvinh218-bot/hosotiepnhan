import "server-only";
import { createAdminClient } from "@supabase/server/core";

export function getSupabaseAdmin() {
  return createAdminClient();
}

export interface ConversationBase {
  id: string;
  channel: string;
  startedAt: string;
  messageCount: number;
}

export interface ConversationSummary extends ConversationBase {
  leadQuality: "good" | "ok" | "spam" | null;
  leadMessageCountAtExtraction: number;
}

export interface ConversationMessageRow {
  id: string;
  sender: "user" | "bot";
  content: string;
  createdAt: string;
}

export interface ConversationDetail extends ConversationBase {
  messages: ConversationMessageRow[];
}

export async function listConversations(): Promise<ConversationSummary[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("conversations")
    .select(
      "id, channel, started_at, conversation_messages(count), leads(quality, message_count_at_extraction)",
    )
    .order("started_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => {
    const lead = (
      row.leads as { quality: "good" | "ok" | "spam"; message_count_at_extraction: number }[] | null
    )?.[0];
    return {
      id: row.id as string,
      channel: row.channel as string,
      startedAt: row.started_at as string,
      messageCount: (row.conversation_messages as { count: number }[] | null)?.[0]?.count ?? 0,
      leadQuality: lead?.quality ?? null,
      leadMessageCountAtExtraction: lead?.message_count_at_extraction ?? 0,
    };
  });
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

export interface LeadRow {
  fullName: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  educationLevel: string | null;
  major: string | null;
  availability: string | null;
  wantsConsultation: boolean | null;
  note: string | null;
  quality: "good" | "ok" | "spam";
  messageCountAtExtraction: number;
  updatedAt: string;
}

export async function getLead(conversationId: string): Promise<LeadRow | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("leads")
    .select(
      "full_name, email, phone, country, education_level, major, availability, wants_consultation, note, quality, message_count_at_extraction, updated_at",
    )
    .eq("conversation_id", conversationId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    fullName: data.full_name as string | null,
    email: data.email as string | null,
    phone: data.phone as string | null,
    country: data.country as string | null,
    educationLevel: data.education_level as string | null,
    major: data.major as string | null,
    availability: data.availability as string | null,
    wantsConsultation: data.wants_consultation as boolean | null,
    note: data.note as string | null,
    quality: data.quality as "good" | "ok" | "spam",
    messageCountAtExtraction: data.message_count_at_extraction as number,
    updatedAt: data.updated_at as string,
  };
}

export async function upsertLead(
  conversationId: string,
  lead: {
    fullName: string | null;
    email: string | null;
    phone: string | null;
    country: string | null;
    educationLevel: string | null;
    major: string | null;
    availability: string | null;
    wantsConsultation: boolean | null;
    note: string | null;
    quality: "good" | "ok" | "spam";
  },
  messageCountAtExtraction: number,
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("leads").upsert(
    {
      conversation_id: conversationId,
      full_name: lead.fullName,
      email: lead.email,
      phone: lead.phone,
      country: lead.country,
      education_level: lead.educationLevel,
      major: lead.major,
      availability: lead.availability,
      wants_consultation: lead.wantsConsultation,
      note: lead.note,
      quality: lead.quality,
      message_count_at_extraction: messageCountAtExtraction,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "conversation_id" },
  );
  if (error) throw error;
}
