import "server-only";
import { GoogleGenAI, Type } from "@google/genai";
import {
  getConversation,
  getLead,
  upsertLead,
  type ConversationDetail,
  type ConversationMessageRow,
  type ConversationSummary,
  type LeadRow,
} from "@/lib/supabase-admin";

const MODEL = "gemini-3.1-flash-lite";

export interface ExtractedLead {
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
}

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    fullName: { type: Type.STRING, nullable: true, description: "Họ tên khách, null nếu chưa nhắc tới" },
    email: { type: Type.STRING, nullable: true, description: "Email khách, null nếu chưa nhắc tới" },
    phone: { type: Type.STRING, nullable: true, description: "Số điện thoại khách, null nếu chưa nhắc tới" },
    country: { type: Type.STRING, nullable: true, description: "Quốc gia muốn du học, null nếu chưa rõ" },
    educationLevel: {
      type: Type.STRING,
      nullable: true,
      description: "Bậc học quan tâm (THPT, Đại học, Thạc sĩ...), null nếu chưa rõ",
    },
    major: { type: Type.STRING, nullable: true, description: "Ngành học quan tâm, null nếu chưa rõ" },
    availability: {
      type: Type.STRING,
      nullable: true,
      description: "Thời gian khách rảnh để được tư vấn, null nếu chưa nhắc tới",
    },
    wantsConsultation: {
      type: Type.BOOLEAN,
      nullable: true,
      description: "Khách có đồng ý đặt lịch tư vấn miễn phí không, null nếu chưa rõ",
    },
    note: {
      type: Type.STRING,
      nullable: true,
      description: "Ghi chú ngắn gọn thêm về nhu cầu/thắc mắc đặc biệt của khách, null nếu không có gì đáng chú ý",
    },
    quality: {
      type: Type.STRING,
      enum: ["good", "ok", "spam"],
      description:
        "Đánh giá chất lượng lead: good = có nhu cầu rõ ràng + đã để lại thông tin liên hệ; ok = có quan tâm nhưng chưa đủ thông tin hoặc còn mơ hồ; spam = tin nhắn rác, thử nghiệm, troll, không liên quan đến du học",
    },
  },
  required: ["quality"],
};

const SYSTEM_INSTRUCTION = `Bạn là công cụ trích xuất dữ liệu (data extraction), không phải chatbot trò chuyện.
Nhiệm vụ: đọc đoạn hội thoại giữa khách và trợ lý tư vấn du học bên dưới, trích xuất thông tin lead theo đúng schema JSON đã cho.

QUY TẮC:
- Chỉ lấy thông tin khách (vai trò "Khách") đã THỰC SỰ nói ra trong hội thoại. Không suy đoán, không bịa thêm.
- Nếu một trường chưa được nhắc tới, trả về null cho trường đó (trừ "quality" luôn phải có giá trị).
- "wantsConsultation": chỉ true khi khách đồng ý/xác nhận muốn đặt lịch tư vấn; false khi khách từ chối rõ ràng; null nếu chưa được hỏi hoặc chưa trả lời.
- "quality": đánh giá dựa trên toàn bộ hội thoại, theo đúng mô tả trong schema.
- Trả lời đúng định dạng JSON theo schema, không thêm chữ nào khác ngoài JSON.`;

function buildTranscript(messages: ConversationMessageRow[]): string {
  return messages
    .map((m) => `${m.sender === "user" ? "Khách" : "Trợ lý"}: ${m.content}`)
    .join("\n");
}

export async function extractLead(
  messages: ConversationMessageRow[],
): Promise<ExtractedLead | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || messages.length === 0) return null;

  const transcript = buildTranscript(messages);

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [{ role: "user", parts: [{ text: transcript }] }],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
      },
    });

    const text = response.text?.trim();
    if (!text) return null;

    const parsed = JSON.parse(text) as Partial<ExtractedLead>;
    return {
      fullName: parsed.fullName ?? null,
      email: parsed.email ?? null,
      phone: parsed.phone ?? null,
      country: parsed.country ?? null,
      educationLevel: parsed.educationLevel ?? null,
      major: parsed.major ?? null,
      availability: parsed.availability ?? null,
      wantsConsultation: parsed.wantsConsultation ?? null,
      note: parsed.note ?? null,
      quality: parsed.quality === "good" || parsed.quality === "spam" ? parsed.quality : "ok",
    };
  } catch (error) {
    console.error("Lead extraction error:", error);
    return null;
  }
}

// Chỉ gọi Gemini để trích xuất lại khi hội thoại có thêm tin nhắn mới kể từ
// lần trích xuất trước — tránh gọi API không cần thiết mỗi lần admin mở trang.
export async function getOrExtractLead(conversation: ConversationDetail): Promise<LeadRow | null> {
  const existing = await getLead(conversation.id);
  if (existing && existing.messageCountAtExtraction >= conversation.messageCount) {
    return existing;
  }
  if (conversation.messages.length === 0) return existing;

  const extracted = await extractLead(conversation.messages);
  if (!extracted) return existing;

  await upsertLead(conversation.id, extracted, conversation.messageCount);
  return {
    ...extracted,
    messageCountAtExtraction: conversation.messageCount,
    updatedAt: new Date().toISOString(),
  };
}

// Dùng cho trang danh sách hội thoại: chỉ trích xuất (gọi Gemini) cho những
// hội thoại chưa có lead hoặc đã có thêm tin nhắn mới kể từ lần trích xuất
// trước, chạy song song để không làm chậm trang quá nhiều.
export async function backfillLeadQualities(
  summaries: ConversationSummary[],
): Promise<Map<string, "good" | "ok" | "spam" | null>> {
  const qualities = new Map<string, "good" | "ok" | "spam" | null>();

  const stale = summaries.filter(
    (s) => s.messageCount > 0 && s.leadMessageCountAtExtraction < s.messageCount,
  );

  await Promise.all(
    stale.map(async (summary) => {
      const conversation = await getConversation(summary.id);
      if (!conversation) return;
      const lead = await getOrExtractLead(conversation);
      qualities.set(summary.id, lead?.quality ?? null);
    }),
  );

  for (const summary of summaries) {
    if (!qualities.has(summary.id)) {
      qualities.set(summary.id, summary.leadQuality);
    }
  }

  return qualities;
}
