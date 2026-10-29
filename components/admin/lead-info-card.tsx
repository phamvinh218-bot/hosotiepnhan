import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import type { LeadRow } from "@/lib/supabase-admin";

const qualityMeta: Record<LeadRow["quality"], { label: string; tone: "green" | "yellow" | "red" }> = {
  good: { label: "Lead tốt", tone: "green" },
  ok: { label: "Lead tạm ổn", tone: "yellow" },
  spam: { label: "Spam", tone: "red" },
};

export function LeadQualityBadge({ quality }: { quality: LeadRow["quality"] | null }) {
  if (!quality) {
    return <StatusBadge tone="gray" label="Chưa có lead" />;
  }
  const meta = qualityMeta[quality];
  return <StatusBadge tone={meta.tone} label={meta.label} />;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value ?? <span className="text-muted-foreground">—</span>}</p>
    </div>
  );
}

export function LeadInfoCard({ lead }: { lead: LeadRow | null }) {
  if (!lead) {
    return (
      <Card className="p-4">
        <p className="text-sm text-muted-foreground">
          Chưa trích xuất được thông tin lead từ cuộc hội thoại này.
        </p>
      </Card>
    );
  }

  return (
    <Card className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Thông tin lead (AI trích xuất)</h2>
        <LeadQualityBadge quality={lead.quality} />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Field label="Họ tên" value={lead.fullName} />
        <Field label="Email" value={lead.email} />
        <Field label="Số điện thoại" value={lead.phone} />
        <Field label="Nước du học" value={lead.country} />
        <Field label="Bậc học" value={lead.educationLevel} />
        <Field label="Ngành học" value={lead.major} />
        <Field label="Availability" value={lead.availability} />
        <Field
          label="Muốn đặt lịch tư vấn"
          value={
            lead.wantsConsultation === null
              ? null
              : lead.wantsConsultation
                ? "Có"
                : "Không"
          }
        />
      </div>

      {lead.note && (
        <div>
          <p className="text-xs text-muted-foreground">Ghi chú</p>
          <p className="text-sm">{lead.note}</p>
        </div>
      )}
    </Card>
  );
}
