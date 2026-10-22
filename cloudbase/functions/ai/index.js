const https = require("https");

const ACTIONS = new Set([
  "generate_farewell_task",
  "arrange_record",
  "sprite_chat"
]);

function requestJson({ hostname, path, method, headers }, body) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path, method, headers }, res => {
      let raw = "";
      res.setEncoding("utf8");
      res.on("data", chunk => { raw += chunk; });
      res.on("end", () => {
        try {
          const json = JSON.parse(raw);
          if (res.statusCode >= 200 && res.statusCode < 300) resolve(json);
          else reject(new Error(json?.error?.message || `DeepSeek 请求失败：${res.statusCode}`));
        } catch (error) {
          reject(new Error(`DeepSeek 返回解析失败：${error.message}`));
        }
      });
    });
    req.on("error", reject);
    req.setTimeout(30000, () => req.destroy(new Error("DeepSeek 请求超时")));
    if (body) req.write(body);
    req.end();
  });
}

function compactStories(stories) {
  return (Array.isArray(stories) ? stories : [])
    .filter(item => item && typeof item === "object")
    .slice(0, 20)
    .map((item, index) => ({
      title: String(item.title || `故事${index + 1}`).slice(0, 80),
      category: String(item.category || "").slice(0, 40),
      body: String(item.body || item.text || "").slice(0, 1200)
    }))
    .filter(item => item.body);
}

function compactMessages(messages) {
  return (Array.isArray(messages) ? messages : [])
    .filter(item => item && (item.role === "user" || item.role === "assistant"))
    .slice(-16)
    .map(item => ({ role: item.role, content: String(item.text || item.content || "").slice(0, 1200) }));
}

function buildMessages(action, payload = {}) {
  if (action === "generate_farewell_task") {
    const stories = compactStories(payload.stories);
    const ordinal = Math.min(Math.max(Number(payload.ordinal) || 1, 1), 7);
    return {
      system: [
        "你是「告别蒲蒲」里的温柔告别陪伴助手。",
        "你需要根据主人写下的宠物故事，生成一件具体、轻柔、可完成的告别小事。",
        "七件小事要形成递进关系：从最简单、最安全的动作开始，逐步帮助主人慢慢告别。",
        "不要使用夸张的安慰，不要假装宠物复活，不要给出医疗建议或危险行为。",
        "只输出 JSON，不要输出 Markdown 代码块。"
      ].join("\n"),
      user: [
        `当前是第 ${ordinal} 件告别小事，共 7 件。`,
        "请参考主人填写的故事，生成专属这件小事。",
        "JSON 字段必须为：title、short、body、after。",
        "short 是两行以内的手机提示语；body 是具体做法；after 是完成后可以记录什么。",
        "主人故事如下：",
        JSON.stringify(stories)
      ].join("\n")
    };
  }

  if (action === "arrange_record") {
    const text = String(payload.text || "").slice(0, 4000);
    const title = String(payload.title || "").slice(0, 80);
    return {
      system: [
        "你是「告别蒲蒲」的回忆手账排版助手。",
        "请把主人填写的故事或告别记录整理成清晰、温和、适合手机阅读的版式。",
        "如果收到图片，请先识别图片中的主要内容，再把图片说明自然融入排版。",
        "不要改写主人没有提供的事实，不要添加虚构细节。",
        "只返回整理后的正文，不要解释。"
      ].join("\n"),
      user: [
        title ? `记录主题：${title}` : "记录主题：未命名回忆",
        "原始文字：",
        text || "（这段记录暂时没有文字）"
      ].join("\n")
    };
  }

  if (action === "sprite_chat") {
    const messages = compactMessages(payload.messages);
    const stories = compactStories(payload.stories);
    return {
      system: [
        "你是「告别蒲蒲」栖所里的蒲公英精灵蒲团子。",
        "你的语气温柔、安静、尊重边界，帮助主人慢慢表达思念。",
        "你不假装成逝去的宠物，不替宠物回答，也不宣称宠物复活。",
        "如果主人情绪很重，优先陪伴，不催促解决问题。",
        "回答要短，通常一到三句话。"
      ].join("\n"),
      user: [
        "下面是主人保存在栖所里的故事背景：",
        JSON.stringify(stories),
        "下面是最近的对话：",
        JSON.stringify(messages)
      ].join("\n")
    };
  }

  throw new Error("未知的 AI 动作");
}

exports.main = async (event = {}) => {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return { code: 500, message: "云函数缺少环境变量 DEEPSEEK_API_KEY" };

  const action = event.action;
  if (!ACTIONS.has(action)) return { code: 400, message: "不允许的 AI 动作" };

  try {
    const { system, user } = buildMessages(action, event.payload || {});
    const content = [{ type: "text", text: user }];
    const images = Array.isArray(event.payload?.images) ? event.payload.images : [];
    for (const image of images.slice(0, 4)) {
      const url = String(image || "");
      if (url) content.push({ type: "image_url", image_url: { url } });
    }

    const body = JSON.stringify({
      model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
      messages: [
        { role: "system", content: system },
        { role: "user", content }
      ],
      temperature: action === "sprite_chat" ? 0.8 : 0.6,
      max_tokens: action === "sprite_chat" ? 500 : 1200,
      stream: false
    });

    const response = await requestJson({
      hostname: "api.deepseek.com",
      path: "/chat/completions",
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      }
    }, body);

    const text = response?.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error("DeepSeek 返回内容为空");
    return { code: 0, data: { text } };
  } catch (error) {
    return { code: 500, message: error.message || "AI 调用失败" };
  }
};
