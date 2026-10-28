import { GoogleGenAI } from "@google/genai";

const MODEL = "gemini-3.5-flash-lite";

const FALLBACK_REPLY =
  "Mình chưa có thông tin để trả lời câu này. Bạn để lại câu hỏi ở đây, hoặc để lại email/số điện thoại trong form báo giá, đội ngũ tư vấn sẽ liên hệ lại nhé.";

const SYSTEM_INSTRUCTION = `Bạn là trợ lý tư vấn du học của DuHoc24, trả lời bằng tiếng Việt, ngắn gọn, thân thiện.

QUY TẮC BẮT BUỘC:
- Bạn CHỈ được trả lời dựa trên đúng nội dung bộ câu hỏi và câu trả lời bên dưới. Không được bịa thêm, suy đoán, hay dùng kiến thức ngoài phạm vi này, kể cả khi người dùng hỏi về chủ đề khác (trường học cụ thể, visa, học bổng ngoài nội dung, giá cả chi tiết hơn, v.v.).
- Nếu câu hỏi của người dùng không khớp với bất kỳ nội dung nào bên dưới, hãy trả lời đúng nguyên văn: "${FALLBACK_REPLY}"
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

interface ChatMessage {
  from: "user" | "bot";
  text: string;
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { reply: FALLBACK_REPLY, error: "missing_api_key" },
      { status: 500 },
    );
  }

  let body: { message?: unknown; history?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    return Response.json({ error: "missing_message" }, { status: 400 });
  }

  const history: ChatMessage[] = Array.isArray(body.history)
    ? body.history.filter(
        (m): m is ChatMessage =>
          !!m &&
          typeof m === "object" &&
          (m.from === "user" || m.from === "bot") &&
          typeof m.text === "string",
      )
    : [];

  const contents = [
    ...history.map((m) => ({
      role: m.from === "user" ? ("user" as const) : ("model" as const),
      parts: [{ text: m.text }],
    })),
    { role: "user" as const, parts: [{ text: message }] },
  ];

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: MODEL,
      contents,
      config: { systemInstruction: SYSTEM_INSTRUCTION },
    });

    const reply = response.text?.trim() || FALLBACK_REPLY;
    return Response.json({ reply });
  } catch (error) {
    console.error("Gemini chat error:", error);
    return Response.json(
      { reply: FALLBACK_REPLY, error: "gemini_request_failed" },
      { status: 500 },
    );
  }
}
