import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/page-header";
import { DeleteConversationButton } from "@/components/admin/delete-conversation-button";
import { LeadQualityBadge } from "@/components/admin/lead-info-card";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listConversations } from "@/lib/supabase-admin";
import { backfillLeadQualities } from "@/lib/lead-extraction";
import { formatDateTime } from "@/lib/utils";

// Danh sách hội thoại đổi liên tục khi có khách chat mới — luôn lấy dữ liệu
// mới nhất từ Supabase thay vì dùng bản tĩnh chụp lúc build.
export const dynamic = "force-dynamic";

export default async function AdminConversationsPage() {
  const conversations = await listConversations();
  const leadQualities = await backfillLeadQualities(conversations);

  return (
    <>
      <AdminPageHeader
        title="Hội thoại"
        description="Lịch sử hội thoại của khách với chatbot hỏi đáp trên trang chủ."
      />

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kênh</TableHead>
              <TableHead>Số tin nhắn</TableHead>
              <TableHead>Thời gian bắt đầu</TableHead>
              <TableHead>Chất lượng lead</TableHead>
              <TableHead className="text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {conversations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Chưa có cuộc hội thoại nào.
                </TableCell>
              </TableRow>
            ) : (
              conversations.map((conv) => (
                <TableRow key={conv.id}>
                  <TableCell className="font-medium">{conv.channel}</TableCell>
                  <TableCell>{conv.messageCount} tin nhắn</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDateTime(conv.startedAt)}
                  </TableCell>
                  <TableCell>
                    <LeadQualityBadge quality={leadQualities.get(conv.id) ?? null} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Link
                        href={`/admin/conversations/${conv.id}`}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        Xem chi tiết
                      </Link>
                      <DeleteConversationButton id={conv.id} />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
