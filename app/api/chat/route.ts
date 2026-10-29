import { GoogleGenAI } from "@google/genai";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const MODEL = "gemini-3.5-flash-lite";

const ERROR_REPLY = "Xin lỗi bạn, hệ thống đang bị lỗi, chúng tôi sẽ liên lạc lại sớm nhất";

const SYSTEM_INSTRUCTION = `Persona
Bạn là Trợ lý AI Tư vấn Du học — một trợ lý ảo thân thiện, nhiệt tình, hỗ trợ học sinh/phụ huynh tìm hiểu về du học.

Core Task/Objective
💭 Nhiệm vụ của bạn là dẫn dắt cuộc trò chuyện có cấu trúc để hiểu nhu cầu du học của người dùng, thu thập thông tin liên hệ và giới thiệu dịch vụ tư vấn phù hợp. Trả lời ngắn gọn, hữu ích.
💭 Trả lời bằng đúng ngôn ngữ người dùng đang sử dụng.
💭 Mỗi lượt chỉ hỏi một câu hỏi.

Constraints/Rules
⚠️ QUY TẮC KHÁC:

* Không đề cập chi phí/học phí trừ khi người dùng chủ động hỏi

* Không tự đưa ra cam kết về tỷ lệ đậu visa hoặc học bổng

Additional Information
🧠 LUỒNG HỘI THOẠI:

1. Hỏi người dùng đang quan tâm du học nước nào (hoặc đang phân vân giữa các nước)

2. Hỏi về mục tiêu/bậc học (THPT, Đại học, Thạc sĩ...) và ngành học quan tâm

3. Dựa trên nhu cầu, giới thiệu dịch vụ tư vấn phù hợp (chọn trường, hồ sơ, xin visa, học bổng...)

4. Hỏi họ có muốn tìm hiểu thêm chi tiết không

5. Nếu có, thu thập lần lượt: họ tên → email → số điện thoại

6. Sau đó, cung cấp thông tin chi tiết hơn về quy trình tư vấn và mời đặt lịch tư vấn miễn phí

7. Hỏi họ có ghi chú/câu hỏi nào khác trước khi kết thúc

Dịch vụ
Tư vấn chọn trường & ngành học, hỗ trợ hồ sơ apply, tư vấn xin visa, tìm học bổng, đào tạo kỹ năng trước khi du học (ngôn ngữ, phỏng vấn).
Trụ sở: Số 1 Hai Bà Trưng, Hà Nội
Liên hệ: 0912 345 6789

Configuration

* Mục tiêu: Thu thập lead và đặt lịch tư vấn

* Phong cách trả lời: Cân bằng, đi thẳng vào trọng tâm, tối đa 2-3 câu mỗi lượt trừ khi cần chi tiết hơn`;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { reply: ERROR_REPLY, error: "missing_api_key" },
      { status: 500 },
    );
  }

  let body: { message?: unknown; conversationId?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    return Response.json({ error: "missing_message" }, { status: 400 });
  }

  const requestedConversationId =
    typeof body.conversationId === "string" && UUID_RE.test(body.conversationId)
      ? body.conversationId
      : null;

  const supabase = getSupabaseAdmin();

  // Lịch sử hội thoại sống ở Supabase, chỉ server (secret key, bypass RLS) đọc/ghi được —
  // trình duyệt không bao giờ truy vấn trực tiếp hai bảng này.
  let conversationId = requestedConversationId;
  if (conversationId) {
    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .eq("id", conversationId)
      .maybeSingle();
    if (!existing) conversationId = null;
  }
  if (!conversationId) {
    const { data: created, error: createError } = await supabase
      .from("conversations")
      .insert({ channel: "Web" })
      .select("id")
      .single();
    if (createError || !created) {
      console.error("Supabase create conversation error:", createError);
      return Response.json(
        { reply: ERROR_REPLY, error: "conversation_create_failed" },
        { status: 500 },
      );
    }
    conversationId = created.id as string;
  }

  const { data: pastMessages, error: historyError } = await supabase
    .from("conversation_messages")
    .select("sender, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (historyError) {
    console.error("Supabase fetch history error:", historyError);
    return Response.json(
      { reply: ERROR_REPLY, error: "history_fetch_failed" },
      { status: 500 },
    );
  }

  const contents = [
    ...(pastMessages ?? []).map((m) => ({
      role: m.sender === "user" ? ("user" as const) : ("model" as const),
      parts: [{ text: m.content as string }],
    })),
    { role: "user" as const, parts: [{ text: message }] },
  ];

  const { error: insertUserError } = await supabase
    .from("conversation_messages")
    .insert({ conversation_id: conversationId, sender: "user", content: message });
  if (insertUserError) {
    console.error("Supabase insert user message error:", insertUserError);
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: MODEL,
      contents,
      config: { systemInstruction: SYSTEM_INSTRUCTION },
    });

    const reply = response.text?.trim() || ERROR_REPLY;

    const { error: insertBotError } = await supabase
      .from("conversation_messages")
      .insert({ conversation_id: conversationId, sender: "bot", content: reply });
    if (insertBotError) {
      console.error("Supabase insert bot message error:", insertBotError);
    }

    return Response.json({ reply, conversationId });
  } catch (error) {
    console.error("Gemini chat error:", error);
    return Response.json(
      { reply: ERROR_REPLY, error: "gemini_request_failed", conversationId },
      { status: 500 },
    );
  }
}
