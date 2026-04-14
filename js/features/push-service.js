// js/features/push-service.js
// 真正的后台推送（即使网页完全关闭也能收到）

// 1. 注册 Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js');
            console.log('[Push] Service Worker 注册成功', registration);
            window.swReg = registration;

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

// 2. 请求并订阅推送
async function subscribeToPush() {
    if (!window.swReg) {
        alert('Service Worker 未就绪，请稍后再试');
        return false;
    }

    if (Notification.permission !== 'granted') {
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') {
            alert('需要通知权限才能开启后台推送');
            return false;
        }
    }

    try {
        // ⚠️ 重要：将下面的公钥替换成你自己生成的 VAPID 公钥
        const VAPID_PUBLIC_KEY = 'BBr9iwsBzNcxSPPrBssnX73C_tzxOJQYi-PQ6WoS0n8ba8v7qGyJa_jrcJkxf4ZBRdajn8apLt_aL5JbWH4eUDc'

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

// 3. 保存订阅到服务器（暂时只打印）
async function saveSubscriptionToServer(subscription) {
    console.log('订阅信息（待后端保存）:', subscription);
    // TODO: 以后替换成真实的 fetch 请求
}

// 4. 辅助函数
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

// 挂载到全局
window.subscribeToPush = subscribeToPush;