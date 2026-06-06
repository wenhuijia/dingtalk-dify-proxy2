// api/dingtalk.js

// ⚠️ 关键修改：使用 module.exports 替代 export default
module.exports = async function handler(req, res) {
  // 仅允许 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const difyBaseUrl = process.env.DIFY_BASE_URL;
    const difyApiKey = process.env.DIFY_API_KEY;

    // 检查环境变量是否配置（防止空指针报错）
    if (!difyBaseUrl || !difyApiKey) {
      console.error('Missing Environment Variables');
      return res.status(500).json({
        msgtype: 'text',
        text: { content: '服务器配置错误：缺少 DIFY 环境变量' }
      });
    }

    // 钉钉机器人消息接收格式参考
    const { text: { content }, senderStaffId } = req.body;

    const difyPayload = {
      inputs: {},
      query: content?.trim() || '',
      response_mode: 'blocking',
      user: senderStaffId || 'unknown_user'
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

    // 返回钉钉格式
    res.status(200).json({
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
