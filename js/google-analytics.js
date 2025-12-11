/**
 * Google Analytics 4 集成模块（可选）
 * 如需启用Google Analytics，请按以下步骤操作：
 * 
 * 1. 在 https://analytics.google.com 创建GA4账户
 * 2. 获取测量ID（格式：G-XXXXXXXXXX）
 * 3. 将下面的 'YOUR_GA4_MEASUREMENT_ID' 替换为您的测量ID
 * 4. 在 index.html 中取消注释相关代码
 */

// 配置您的Google Analytics测量ID
const GA4_MEASUREMENT_ID = 'YOUR_GA4_MEASUREMENT_ID'; // 替换为您的实际测量ID

/**
 * 初始化Google Analytics 4
 */
function initGoogleAnalytics() {
    // 检查是否配置了有效的测量ID
    if (GA4_MEASUREMENT_ID === 'YOUR_GA4_MEASUREMENT_ID') {
        console.log('📊 Google Analytics未配置，跳过初始化');
        return;
    }

    // 加载gtag脚本
    const script1 = document.createElement('script');
    script1.async = true;
    script1.src = `https://www.googletagmanager.com/gtag/js?id=${GA4_MEASUREMENT_ID}`;
    document.head.appendChild(script1);

    // 初始化gtag
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', GA4_MEASUREMENT_ID, {
        // 隐私友好配置
        anonymize_ip: true,
        allow_google_signals: false,
        allow_ad_personalization_signals: false
    });

    // 将gtag函数暴露给全局
    window.gtag = gtag;
    
    console.log('📊 Google Analytics 4 已初始化');
}

/**
 * 发送自定义事件到Google Analytics
 */
function sendGAEvent(eventName, parameters = {}) {
    if (typeof window.gtag === 'function') {
        window.gtag('event', eventName, parameters);
        console.log('📊 GA事件已发送:', eventName, parameters);
    }
}

/**
 * 扩展TextDiffAnalytics以支持Google Analytics
 */
if (window.textDiffAnalytics) {
    const originalSendEvent = window.textDiffAnalytics.sendEvent;
    
    window.textDiffAnalytics.sendEvent = function(data) {
        // 调用原始方法
        originalSendEvent.call(this, data);
        
        // 发送到Google Analytics
        if (data.event === 'page_view') {
            sendGAEvent('page_view', {
                page_title: document.title,
                page_location: window.location.href
            });
        } else if (data.event === 'feature_usage') {
            sendGAEvent('feature_usage', {
                feature_name: data.feature,
                custom_parameter_1: JSON.stringify(data.details)
            });
        } else if (data.event === 'session_end') {
            sendGAEvent('session_end', {
                session_duration: Math.round(data.sessionDuration / 1000), // 转换为秒
                events_count: data.eventsCount
            });
        }
    };
}

// 页面加载时初始化（如果需要）
// 取消下面的注释以启用Google Analytics
// window.addEventListener('DOMContentLoaded', initGoogleAnalytics);

/* 
使用说明：

1. 获取Google Analytics测量ID：
   - 访问 https://analytics.google.com
   - 创建新的GA4属性
   - 复制测量ID（G-XXXXXXXXXX格式）

2. 配置测量ID：
   - 将上面的 GA4_MEASUREMENT_ID 替换为您的实际测量ID

3. 启用Google Analytics：
   - 取消最后一行的注释
   - 或者在index.html中添加：
     <script>
       window.addEventListener('DOMContentLoaded', initGoogleAnalytics);
     </script>

4. 隐私说明：
   - 此配置已启用IP匿名化
   - 禁用了广告个性化信号
   - 符合GDPR等隐私法规要求

5. 自定义事件：
   - 页面访问 (page_view)
   - 功能使用 (feature_usage)
   - 会话结束 (session_end)
   - 所有事件都会自动发送到GA4
*/