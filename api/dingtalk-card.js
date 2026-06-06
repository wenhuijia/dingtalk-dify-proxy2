// api/dingtalk-card.js

const axios = require('axios');

// ================= 配置区 (建议放入 Vercel 环境变量) =================
const APP_KEY = process.env.DING_APP_KEY;
const APP_SECRET = process.env.DING_APP_SECRET;
const CARD_TEMPLATE_ID = process.env.CARD_TEMPLATE_ID; // 你的卡片模板ID
const DIFY_API_URL = 'http://8.135.35.17/v1/chat-messages'; // 你的Dify地址
const DIFY_API_KEY = process.env.DIFY_API_KEY; // Dify应用的API Key
// ===================================================================

module.exports = async function handler(req, res) {
  // 允许跨域（如果需要）
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // ==================== 分支 A：接收钉钉卡片的回调 ====================
    // 钉钉卡片点击提交后，会 POST 到你的这个 URL
    if (req.headers['content-type'] && req.headers['content-type'].includes('application/json') && req.body?.cardPrivateData) {
      console.log('收到钉钉卡片回调:', JSON.stringify(req.body));

      // 1. 从卡片私有数据中提取我们之前存进去的 Dify 信息
      const privateData = req.body.cardPrivateData;
      const conversationId = privateData.conversation_id;
      const userId = privateData.user_id;
      const replyContent = req.body.content?.reply_content || '无内容'; // 假设卡片里有个输入框叫 reply_content

      if (!conversationId || !userId) {
        return res.status(400).json({ success: false, message: '缺少上下文信息' });
      }

      // 2. 调用 Dify API，把客服的话“注入”到对话中
      await sendToDify(conversationId, userId, replyContent);

      // 3. 更新卡片状态（可选，比如把按钮变灰，显示“已回复”）
      // 这里简单返回成功即可，钉钉会自动处理
      return res.status(200).json({ success: true });
    }

    // ==================== 分支 B：接收 Dify 的发卡指令 ====================
    // Dify 工作流调用这个接口来发卡
    if (req.method === 'POST') {
      const { conversation_id, user_id, question } = req.body;

      if (!conversation_id || !user_id) {
        return res.status(400).json({ error: 'Missing conversation_id or user_id' });
      }

      // 1. 获取 Token
      const token = await getAccessToken();

      // 2. 构建卡片参数
      // 关键点：把 conversation_id 和 user_id 放进 cardParamMap，这样回调时才能拿回来
      const cardData = {
        cardTemplateId: CARD_TEMPLATE_ID,
        outTrackId: `track_${Date.now()}`,
        callbackType: "HTTP", // 必须是 HTTP 回调
        openSpaceId: `dtv1.card//im_group.${process.env.TARGET_GROUP_ID}`, // 发送到哪个群
        imGroupOpenDeliverModel: {
          robotCode: process.env.DING_ROBOT_CODE,
        },
        cardData: {
          cardParamMap: {
            title: `用户 ${user_id} 请求人工协助`,
            question_preview: question || '请查看上下文',
            // 【核心】把 Dify 的身份证藏在这里
            hidden_conversation_id: conversation_id,
            hidden_user_id: user_id
          }
        }
      };

      // 3. 发送卡片
      const result = await axios.post('https://api.dingtalk.com/v1.0/card/instances/createAndDeliver', cardData, {
        headers: {
          'x-acs-dingtalk-access-token': token,
          'Content-Type': 'application/json'
        }
      });

      return res.status(200).json(result.data);
    }

    return res.status(405).json({ error: 'Method Not Allowed' });

  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

// ================= 辅助函数 =================

async function getAccessToken() {
  const res = await axios.get('https://oapi.dingtalk.com/gettoken', {
    params: { appkey: APP_KEY, appsecret: APP_SECRET }
  });
  return res.data.access_token;
}

async function sendToDify(conversationId, userId, content) {
  // 使用 Dify 的 Chat Messages 接口继续对话
  // 注意：这里其实是模拟用户或者系统消息插入，具体看 Dify 是否支持直接追加
  // 更稳妥的方式是调用 Dify 的 "Messages" 接口或者直接推送到前端（如果是对接IM）
  // 但如果是 Web 端，通常需要 Dify 支持“管理员介入”接口。
  // *假设* 我们用标准的 chat-messages 接口尝试续接（需 Dify 版本支持或特定逻辑）

  // ⚠️ 注意：标准 Dify API 很难直接由外部“插入”一条消息并推送到前端。
  // 通常的做法是：外部系统调用 Dify API 生成回答，然后你的前端轮询或者通过 WebSocket 接收。
  // 但如果只是为了“记录”或“继续”，可以尝试以下 Payload：

  const payload = {
    inputs: {},
    query: `[人工客服回复]: ${content}`, // 伪装成用户输入，或者作为系统提示
    response_mode: 'blocking',
    user: userId,
    conversation_id: conversationId
  };

  // 这里有个逻辑陷阱：直接调 chat-messages 会触发 LLM 再次生成。
  // 如果你只是想把客服的话展示给用户，这取决于你的前端怎么渲染。
  // 如果你的前端能识别 `[人工客服回复]` 这种标记并特殊渲染，那就没问题。

  await axios.post(DIFY_API_URL, payload, {
    headers: {
      'Authorization': `Bearer ${DIFY_API_KEY}`,
      'Content-Type': 'application/json'
    }
  });
}
