function formatHistory(messages, maxTurns = 8) {
  if (!messages || messages.length === 0) return "无";

  const recent = messages.slice(-maxTurns);
  return recent
    .map((msg) => {
      const role = msg.role === "user" ? "用户" : "助手";
      return `${role}：${msg.content}`;
    })
    .join("\n");
}

function buildPrompt(req) {
  const historyText = formatHistory(req.conversationHistory);

  let fullMessageSection = "";
  if (req.fullMessageText && req.fullMessageText.trim()) {
    fullMessageSection = `

选中文本所在的完整回答：
${req.fullMessageText}`;
  }

  let mainConversationSection = "";
  if (req.mainConversation && req.mainConversation.length > 0) {
    mainConversationSection = `

主对话最近内容（选中消息之前的几轮）：
${formatHistory(req.mainConversation)}`;
  }

  return `你是一个阅读旁注助手。用户正在阅读一段 AI 对话中的回答内容（来源：${req.siteName || "AI 助手"}）。
用户选中了其中一小段，并在旁注窗口中围绕这段内容进行多轮追问。

你的任务：
1. 围绕选中文本、上下文和旁注窗口历史回答。
2. 不要把回答扩展成新的长篇主回答。
3. 如果用户的当前问题依赖前文，请结合旁注历史回答。
4. 如果历史与当前问题无关，以当前问题为准。

选中的原文：
${req.selectedText}

附近上下文：
${req.surroundingText || ""}${fullMessageSection}${mainConversationSection}

当前旁注窗口历史：
${historyText}

用户当前问题：
${req.userQuestion}

回答要求：
1. 用中文回答。
2. 先直接回答用户当前问题。
3. 必要时引用前面旁注里的上下文。
4. 如果涉及术语，先给直观解释，再给技术解释。
5. 控制篇幅，不要生成过长回答。`.trim();
}
