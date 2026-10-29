import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { DeleteConversationButton } from "@/components/admin/delete-conversation-button";
import { Card } from "@/components/ui/card";
import { getConversation } from "@/lib/supabase-admin";
import { cn, formatDateTime, formatTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminConversationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const conversation = await getConversation(id);

  if (!conversation) {
    notFound();
  }

  return (
    <>
      <Link
        href="/admin/conversations"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Quay lại danh sách hội thoại
      </Link>

      <AdminPageHeader
        title={`Hội thoại kênh ${conversation.channel}`}
        description={`Bắt đầu lúc ${formatDateTime(conversation.startedAt)} · ${conversation.messageCount} tin nhắn`}
        action={
          <DeleteConversationButton
            id={conversation.id}
            redirectTo="/admin/conversations"
            label="Xóa hội thoại"
          />
        }
      />

      <Card className="space-y-3 p-4">
        {conversation.messages.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">
            Cuộc hội thoại này chưa có tin nhắn nào.
          </p>
        ) : (
          conversation.messages.map((m) => (
            <div
              key={m.id}
              className={cn("flex", m.sender === "user" ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "max-w-[75%] rounded-2xl px-3.5 py-2 text-sm",
                  m.sender === "user"
                    ? "rounded-br-sm bg-primary text-primary-foreground"
                    : "rounded-bl-sm bg-muted text-foreground",
                )}
              >
                <p>{m.content}</p>
                <p
                  className={cn(
                    "mt-1 text-right text-xs",
                    m.sender === "user" ? "text-primary-foreground/70" : "text-muted-foreground",
                  )}
                >
                  {formatTime(m.createdAt)}
                </p>
              </div>
            </div>
          ))
        )}
      </Card>
    </>
  );
}
