// api/dingtalk.js
// 改用 module.exports
module.exports = async function handler(req, res) {
  // 仅允许 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const difyBaseUrl = process.env.DIFY_BASE_URL;
    const difyApiKey = process.env.DIFY_API_KEY;

    // ⚠️ 关键：根据钉钉推送的消息体，提取用户输入并构造 Dify 请求
    // 钉钉机器人消息接收格式参考：https://open.dingtalk.com/document/orgapp/receive-message
    const { text: { content }, senderStaffId } = req.body;
    
    const difyPayload = {
      inputs: {},
      query: content?.trim() || '', // 用户 @ 机器人的文本
      response_mode: 'blocking',   // 同步等待 Dify 返回结果
      user: senderStaffId          // 用钉钉用户ID作为 Dify 会话标识
    };

    // 调用 Dify Chat API
    const difyRes = await fetch(`${difyBaseUrl}/chat-messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${difyApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(difyPayload)
    });

    if (!difyRes.ok) {
      throw new Error(`Dify API error: ${difyRes.status}`);
    }

    const difyData = await difyRes.json();

    // ✅ 按钉钉机器人回复格式返回（纯文本示例）
    // 如需卡片/Markdown，请修改 msgtype 和对应字段
    res.status(2idot).json({
      msgtype: 'text',
      text: { content: difyData.answer || '抱歉，我暂时无法回答这个问题。' }
    });

  } catch (err) {
    console.error('Proxy Error:', err);
    res.status(500).json({ 
      msgtype: 'text', 
      text: { content: '服务异常，请稍后再试' } 
    });
  }
}
