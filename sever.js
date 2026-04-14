// server.js - 本地推送后端
const webpush = require('web-push');
const express = require('express');
const app = express();

// 配置 VAPID（把下面的公钥和私钥替换成你自己的）
const vapidKeys = {
    publicKey: 'BBr9iwsBzNcxSPPrBssnX73C_tzxOJQYi-PQ6WoS0n8ba8v7qGyJa_jrcJkxf4ZBRdajn8apLt_aL5JbWH4eUDc',
    privateKey: 'i44B2N6nlQX-FF-H_cWKWzFijRlE_p7ZPt6VPbdl9rM'
};
webpush.setVapidDetails('mailto:your-email@example.com', vapidKeys.publicKey, vapidKeys.privateKey);

app.use(express.json());
app.use(express.static('.')); // 静态文件服务

// 存储订阅（内存中，重启丢失）
let subscriptions = [];

// 保存订阅
app.post('/api/subscribe', (req, res) => {
    const sub = req.body;
    const exists = subscriptions.find(s => s.endpoint === sub.endpoint);
    if (!exists) subscriptions.push(sub);
    console.log('订阅保存，当前订阅数:', subscriptions.length);
    res.json({ success: true });
});

// 发送测试推送
app.post('/api/send', async (req, res) => {
    const payload = JSON.stringify({
        title: '测试推送',
        body: '这是一条从本地后端发送的消息',
        icon: '/favicon.ico',
        url: '/'
    });
    const results = [];
    for (const sub of subscriptions) {
        try {
            await webpush.sendNotification(sub, payload);
            results.push({ endpoint: sub.endpoint, status: 'ok' });
        } catch (err) {
            results.push({ endpoint: sub.endpoint, status: 'error', message: err.message });
            if (err.statusCode === 410) {
                // 订阅失效，删除
                subscriptions = subscriptions.filter(s => s.endpoint !== sub.endpoint);
            }
        }
    }
    res.json({ results });
});

const PORT = 3000;
app.listen(PORT, () => console.log(`后端运行在 http://localhost:${PORT}`));