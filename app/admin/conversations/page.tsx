import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/page-header";
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
import { formatDateTime } from "@/lib/utils";

// Danh sách hội thoại đổi liên tục khi có khách chat mới — luôn lấy dữ liệu
// mới nhất từ Supabase thay vì dùng bản tĩnh chụp lúc build.
export const dynamic = "force-dynamic";

export default async function AdminConversationsPage() {
  const conversations = await listConversations();

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
              <TableHead className="text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {conversations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
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
                  <TableCell className="text-right">
                    <Link
                      href={`/admin/conversations/${conv.id}`}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      Xem chi tiết
                    </Link>
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
