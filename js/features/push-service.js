// js/push-service.js
// 真正的后台推送（即使网页完全关闭也能收到）

// 1. 注册 Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js');
            console.log('[Push] Service Worker 注册成功', registration);
            window.swReg = registration;

            // 检查是否已经有推送订阅
            const subscription = await registration.pushManager.getSubscription();
            if (subscription) {
                console.log('[Push] 已有订阅，更新到服务器');
                await saveSubscriptionToServer(subscription);
            }
        } catch (err) {
            console.error('[Push] Service Worker 注册失败', err);
        }
    });
}

// 2. 请求并订阅推送（需要在 UI 上绑定一个按钮或集成到现有开关）
async function subscribeToPush() {
    if (!window.swReg) {
        alert('Service Worker 未就绪，请稍后再试');
        return false;
    }

    // 请求通知权限（如果还没有）
    if (Notification.permission !== 'granted') {
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') {
            alert('需要通知权限才能开启后台推送');
            return false;
        }
    }

    try {
        // TODO: 这里填入你生成的 VAPID 公钥（下一步会得到）
        const VAPID_PUBLIC_KEY = 'BBr9iwsBzNcxSPPrBssnX73C_tzxOJQYi-PQ6WoS0n8ba8v7qGyJa_jrcJkxf4ZBRdajn8apLt_aL5JbWH4eUDc';

        const subscription = await window.swReg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });

        await saveSubscriptionToServer(subscription);
        alert('后台推送已开启！即使关闭浏览器也能收到消息');
        return true;
    } catch (err) {
        console.error('订阅失败', err);
        alert('开启失败：' + err.message);
        return false;
    }
}

// 3. 保存订阅到你的服务器（你需要后端 API）
async function saveSubscriptionToServer(subscription) {
    const res = await fetch('/api/save-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription)
    });
    if (!res.ok) throw new Error('保存失败');
}

// 4. 辅助函数：base64 转 Uint8Array
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

// 导出函数供全局调用（比如在你的设置按钮里调用）
window.subscribeToPush = subscribeToPush;