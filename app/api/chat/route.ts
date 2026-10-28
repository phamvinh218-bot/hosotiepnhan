import { GoogleGenAI } from "@google/genai";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const MODEL = "gemini-3.5-flash-lite";

const FALLBACK_REPLY =
  "Mình chưa có thông tin để trả lời câu này. Bạn để lại câu hỏi ở đây, hoặc để lại email/số điện thoại trong form báo giá, đội ngũ tư vấn sẽ liên hệ lại nhé.";

const ERROR_REPLY = "Xin lỗi bạn, hệ thống đang bị lỗi, chúng tôi sẽ liên lạc lại sớm nhất";

const SYSTEM_INSTRUCTION = `Bạn là trợ lý tư vấn du học của DuHoc24, ngắn gọn, thân thiện.

QUY TẮC BẮT BUỘC:
- Với lời chào hỏi, cảm ơn, tạm biệt hoặc xã giao thông thường (không hỏi thông tin gì cụ thể), hãy đáp lại tự nhiên, thân thiện, ngắn gọn (ví dụ có thể hỏi lại bạn cần hỗ trợ gì về hồ sơ du học) — không cần áp dụng quy tắc phạm vi bên dưới cho các câu này.
- Với MỌI câu hỏi tìm kiếm thông tin, bạn CHỈ được trả lời dựa trên đúng nội dung bộ câu hỏi và câu trả lời bên dưới. Không được bịa thêm, suy đoán, hay dùng kiến thức ngoài phạm vi này, kể cả khi người dùng hỏi về chủ đề khác (trường học cụ thể, visa, học bổng ngoài nội dung, giá cả chi tiết hơn, v.v.).
- Khi câu hỏi mới dùng đại từ hoặc ý ngầm tham chiếu tới nội dung đã nói trước đó trong cuộc hội thoại (ví dụ "cái đó", "gói kia", "còn...thì sao"), hãy dùng lịch sử hội thoại để hiểu người dùng đang hỏi về điều gì, rồi mới đối chiếu với bộ câu hỏi và câu trả lời bên dưới. Chỉ dùng câu trả lời dự phòng khi thực sự không suy luận được ý người dùng đang hỏi về chủ đề nào trong bộ Q&A.
- Luôn trả lời bằng đúng ngôn ngữ mà người dùng vừa dùng để hỏi (nếu họ hỏi bằng tiếng Anh thì trả lời bằng tiếng Anh, hỏi bằng tiếng Việt thì trả lời bằng tiếng Việt, v.v.), kể cả câu trả lời dự phòng.
- Nếu câu hỏi tìm kiếm thông tin của người dùng không khớp với bất kỳ nội dung nào bên dưới, hãy trả lời với đúng ý nghĩa của câu sau, dịch sang ngôn ngữ người dùng đang dùng: "${FALLBACK_REPLY}"
- Bạn có thể diễn đạt lại câu trả lời cho tự nhiên, nhưng không được thay đổi thông tin (số liệu, thời gian, điều kiện).

BỘ CÂU HỎI VÀ CÂU TRẢ LỜI:

Hỏi: Dịch vụ này gồm những gì?
Đáp: Có 2 gói: gói Cơ bản chỉ hỗ trợ chuẩn bị và nộp hồ sơ, gói Toàn diện thêm cả tư vấn xin học bổng và phỏng vấn.

Hỏi: Mất bao lâu để có kết quả?
Đáp: Sau khi nộp đủ hồ sơ, hệ thống đối chiếu và báo kết quả sơ bộ trong vài phút. Kết quả chính thức từ trường thường mất 2-6 tuần tùy trường.

Hỏi: Cần chuẩn bị giấy tờ gì?
Đáp: 3 loại: bảng điểm học tập (định dạng PDF), ảnh chứng chỉ IELTS, và ảnh CMND/CCCD hoặc hộ chiếu.

Hỏi: Chi phí dịch vụ là bao nhiêu?
Đáp: Tùy gói và bậc học, xem báo giá ngay trên trang chủ sau khi điền form, không mất phí xem báo giá.

Hỏi: Tôi chưa có bằng IELTS thì có đăng ký được không?
Đáp: Vẫn đăng ký được, nhưng cần bổ sung chứng chỉ IELTS trước khi nộp hồ sơ chính thức cho trường.

Hỏi: Làm sao biết mình đủ điều kiện vào trường nào?
Đáp: Sau khi nộp đủ hồ sơ trong cổng hồ sơ, hệ thống tự so sánh điểm học tập và điểm IELTS với điểm chuẩn từng trường, báo ngay trường nào đủ điều kiện.

Hỏi: Sau khi điền form báo giá, bước tiếp theo là gì?
Đáp: Đội ngũ tư vấn sẽ xem xét và duyệt yêu cầu, sau đó gửi email mời bạn vào cổng hồ sơ để nộp giấy tờ.

Hỏi: Hồ sơ của tôi có được bảo mật không?
Đáp: Có, hồ sơ chỉ hiển thị cho bạn và đội ngũ tư vấn sau khi đăng nhập, không công khai.

Hỏi: Tôi cần liên hệ ai nếu có thắc mắc khác?
Đáp: Bạn có thể để lại câu hỏi ngay trong khung chat này, hoặc để lại email/số điện thoại trong form báo giá, đội ngũ sẽ liên hệ lại.`;

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

    const reply = response.text?.trim() || FALLBACK_REPLY;

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
