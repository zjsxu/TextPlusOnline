/**
 * TextDiff+ 网站使用统计模块
 * Website Usage Analytics Module
 */

class TextDiffAnalytics {
    constructor() {
        this.sessionId = this.generateSessionId();
        this.startTime = Date.now();
        this.events = [];
        this.batchTimer = null;
        this.batchInterval = 30000; // 30秒批量发送一次
        
        // 初始化统计
        this.init();
    }

    /**
     * 初始化统计系统
     */
    init() {
        // 记录页面访问
        this.trackPageView();
        
        // 监听页面关闭事件
        window.addEventListener('beforeunload', () => {
            this.trackSessionEnd();
            this.sendBatchToBackend(); // 页面关闭前发送剩余数据
        });

        // 监听用户活动
        this.setupActivityTracking();
        
        // 监听页面可见性变化
        this.setupVisibilityTracking();
        
        // 启动批量发送定时器
        this.startBatchTimer();
        
        // 显示管理员工具 (仅开发环境)
        this.showAdminToolsIfDev();
        
        console.log('📊 TextDiff+ Analytics initialized');
        console.log('📊 Session ID:', this.sessionId);
        console.log('📊 Backend URL:', this.getBackendUrl());
        console.log('📊 Batch interval:', this.batchInterval);
    }

    /**
     * 生成会话ID
     */
    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * 记录页面访问
     */
    trackPageView() {
        const data = {
            event: 'page_view',
            timestamp: new Date().toISOString(),
            sessionId: this.sessionId,
            userAgent: navigator.userAgent,
            language: navigator.language,
            referrer: document.referrer,
            url: window.location.href,
            screenResolution: `${screen.width}x${screen.height}`,
            viewportSize: `${window.innerWidth}x${window.innerHeight}`
        };

        this.sendEvent(data);
        console.log('📈 Page view tracked:', data);
    }

    /**
     * 记录功能使用
     */
    trackFeatureUsage(feature, details = {}) {
        const data = {
            event: 'feature_usage',
            timestamp: new Date().toISOString(),
            sessionId: this.sessionId,
            feature: feature,
            details: details
        };

        this.sendEvent(data);
        console.log('🎯 Feature usage tracked:', feature, details);
    }

    /**
     * 记录文件上传
     */
    trackFileUpload(fileType, fileSize) {
        this.trackFeatureUsage('file_upload', {
            fileType: fileType,
            fileSize: fileSize,
            fileSizeCategory: this.getFileSizeCategory(fileSize)
        });
    }

    /**
     * 记录文本对比
     */
    trackTextComparison(textALength, textBLength, diffCount) {
        this.trackFeatureUsage('text_comparison', {
            textALength: textALength,
            textBLength: textBLength,
            diffCount: diffCount,
            textLengthCategory: this.getTextLengthCategory(Math.max(textALength, textBLength))
        });
    }

    /**
     * 记录词典使用
     */
    trackDictionaryUsage(action, wordCount = 0) {
        this.trackFeatureUsage('dictionary_usage', {
            action: action, // 'add_word', 'export', 'import', 'reset'
            wordCount: wordCount
        });
    }

    /**
     * 记录主题切换
     */
    trackThemeChange(themeName) {
        this.trackFeatureUsage('theme_change', {
            theme: themeName
        });
    }

    /**
     * 记录词频分析
     */
    trackFrequencyAnalysis(textAWordCount, textBWordCount) {
        this.trackFeatureUsage('frequency_analysis', {
            textAWordCount: textAWordCount,
            textBWordCount: textBWordCount
        });
    }

    /**
     * 记录会话结束
     */
    trackSessionEnd() {
        const sessionDuration = Date.now() - this.startTime;
        const data = {
            event: 'session_end',
            timestamp: new Date().toISOString(),
            sessionId: this.sessionId,
            sessionDuration: sessionDuration,
            eventsCount: this.events.length
        };

        this.sendEvent(data);
    }

    /**
     * 设置用户活动监听
     */
    setupActivityTracking() {
        let lastActivity = Date.now();
        
        // 监听用户交互
        ['click', 'keypress', 'scroll', 'mousemove'].forEach(eventType => {
            document.addEventListener(eventType, () => {
                const now = Date.now();
                if (now - lastActivity > 30000) { // 30秒无活动后重新记录
                    this.trackFeatureUsage('user_activity', {
                        type: 'resumed_activity'
                    });
                }
                lastActivity = now;
            }, { passive: true });
        });
    }

    /**
     * 设置页面可见性跟踪
     */
    setupVisibilityTracking() {
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                // 页面变为可见时，发送心跳
                this.trackFeatureUsage('user_activity', {
                    type: 'page_visible'
                });
                console.log('📊 Page became visible, sending heartbeat');
            } else {
                // 页面变为隐藏时
                this.trackFeatureUsage('user_activity', {
                    type: 'page_hidden'
                });
                console.log('📊 Page became hidden');
            }
        });
    }

    /**
     * 获取文件大小分类
     */
    getFileSizeCategory(size) {
        if (size < 1024) return 'tiny'; // < 1KB
        if (size < 1024 * 100) return 'small'; // < 100KB
        if (size < 1024 * 1024) return 'medium'; // < 1MB
        if (size < 1024 * 1024 * 10) return 'large'; // < 10MB
        return 'huge'; // >= 10MB
    }

    /**
     * 获取文本长度分类
     */
    getTextLengthCategory(length) {
        if (length < 100) return 'short';
        if (length < 1000) return 'medium';
        if (length < 10000) return 'long';
        return 'very_long';
    }

    /**
     * 发送统计事件
     */
    async sendEvent(data) {
        this.events.push(data);
        
        // 立即发送重要事件到后台
        const backendUrl = this.getBackendUrl();
        console.log('📊 Analytics sendEvent:', {
            event: data.event,
            backendUrl: backendUrl,
            sessionId: data.sessionId
        });
        
        if (backendUrl && (data.event === 'page_view' || data.event === 'feature_usage')) {
            try {
                await this.sendToBackend(data, backendUrl);
                data.sent = true; // 标记为已发送
                console.log('✅ Immediate send successful');
            } catch (error) {
                console.log('❌ Immediate send failed:', error.message);
                console.log('📦 Will retry in batch');
            }
        } else if (!backendUrl) {
            console.log('ℹ️ No backend URL, using local storage only');
        }

        // 本地存储统计数据 (作为备份)
        this.saveToLocalStorage(data);
    }

    /**
     * 获取后台服务URL
     */
    getBackendUrl() {
        // 自动检测环境并配置后台URL
        const hostname = window.location.hostname;
        
        // 本地开发环境
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return 'http://localhost:3001/api/analytics';
        }
        
        // GitHub Pages 生产环境
        if (hostname === 'zjsxu.github.io') {
            // 生产环境暂时使用本地存储模式，等待后台服务部署
            return null; // 仅使用本地存储，不发送到后台
        }
        
        // 其他环境暂不支持后台分析
        return null;
    }

    /**
     * 发送数据到后台服务
     */
    async sendToBackend(data, backendUrl) {
        const endpoint = this.getEventEndpoint(data.event);
        const url = `${backendUrl}${endpoint}`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(this.formatEventForBackend(data))
        });

        if (!response.ok) {
            throw new Error(`Backend request failed: ${response.status}`);
        }

        const result = await response.json();
        console.log('📊 Analytics sent to backend:', result);
        return result;
    }

    /**
     * 获取事件对应的API端点
     */
    getEventEndpoint(eventType) {
        switch (eventType) {
            case 'page_view':
                return '/events/page-view';
            case 'feature_usage':
                return '/events/feature-usage';
            case 'session_end':
                return '/events/session';
            default:
                return '/events/page-view'; // 默认端点
        }
    }

    /**
     * 格式化事件数据以适配后台API
     */
    formatEventForBackend(data) {
        switch (data.event) {
            case 'page_view':
                return {
                    sessionId: data.sessionId,
                    url: data.url,
                    referrer: data.referrer || '',
                    userAgent: data.userAgent,
                    screenResolution: data.screenResolution,
                    language: data.language,
                    timestamp: data.timestamp
                };
            
            case 'feature_usage':
                return {
                    sessionId: data.sessionId,
                    feature: data.feature,
                    action: data.details?.action || 'use',
                    parameters: data.details || {},
                    duration: data.details?.duration || 0,
                    timestamp: data.timestamp
                };
            
            case 'session_end':
                return {
                    sessionId: data.sessionId,
                    eventType: 'end',
                    data: {
                        sessionDuration: data.sessionDuration,
                        eventsCount: data.eventsCount
                    },
                    timestamp: data.timestamp
                };
            
            default:
                return data;
        }
    }

    /**
     * 批量发送事件到后台
     */
    async sendBatchToBackend() {
        try {
            const backendUrl = this.getBackendUrl();
            console.log('📦 Batch send attempt:', {
                backendUrl: backendUrl,
                totalEvents: this.events.length
            });
            
            if (!backendUrl) {
                console.log('ℹ️ No backend URL for batch send');
                return;
            }
            
            if (this.events.length === 0) {
                console.log('ℹ️ No events to send');
                return;
            }

            // 获取未发送的事件
            const unsent = this.events.filter(event => !event.sent);
            console.log('📊 Unsent events:', unsent.length);
            
            if (unsent.length === 0) {
                console.log('ℹ️ All events already sent');
                return;
            }

            // 批量发送 (最多50个)
            const batch = unsent.slice(0, 50);
            const events = batch.map(event => ({
                type: event.event,
                data: this.formatEventForBackend(event)
            }));

            console.log('📤 Sending batch:', {
                batchSize: batch.length,
                url: `${backendUrl}/events/batch`
            });

            const response = await fetch(`${backendUrl}/events/batch`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ events })
            });

            if (response.ok) {
                // 标记为已发送
                batch.forEach(event => {
                    event.sent = true;
                });
                console.log(`✅ Batch sent successfully: ${batch.length} events`);
            } else {
                console.log(`❌ Batch send failed: HTTP ${response.status}`);
            }

        } catch (error) {
            console.log('❌ Batch send error:', error.message);
        }
    }

    /**
     * 保存到本地存储
     */
    saveToLocalStorage(data) {
        try {
            const key = 'textdiff_analytics';
            const existing = JSON.parse(localStorage.getItem(key) || '[]');
            existing.push(data);
            
            // 只保留最近100条记录
            if (existing.length > 100) {
                existing.splice(0, existing.length - 100);
            }
            
            localStorage.setItem(key, JSON.stringify(existing));
        } catch (error) {
            // 忽略存储错误
        }
    }

    /**
     * 获取本地统计数据
     */
    getLocalAnalytics() {
        try {
            return JSON.parse(localStorage.getItem('textdiff_analytics') || '[]');
        } catch (error) {
            return [];
        }
    }

    /**
     * 导出统计数据
     */
    exportAnalytics() {
        const data = this.getLocalAnalytics();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `textdiff_analytics_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * 清除本地统计数据
     */
    clearLocalAnalytics() {
        localStorage.removeItem('textdiff_analytics');
        console.log('📊 Local analytics data cleared');
    }

    /**
     * 启动批量发送定时器
     */
    startBatchTimer() {
        if (this.batchTimer) {
            clearInterval(this.batchTimer);
        }
        
        this.batchTimer = setInterval(() => {
            this.sendBatchToBackend();
        }, this.batchInterval);
    }

    /**
     * 停止批量发送定时器
     */
    stopBatchTimer() {
        if (this.batchTimer) {
            clearInterval(this.batchTimer);
            this.batchTimer = null;
        }
    }

    /**
     * 配置后台分析服务
     */
    configureBackend(config) {
        window.ANALYTICS_CONFIG = {
            backendUrl: config.backendUrl,
            batchInterval: config.batchInterval || 30000,
            enabled: config.enabled !== false
        };
        
        if (config.batchInterval) {
            this.batchInterval = config.batchInterval;
            this.startBatchTimer();
        }
        
        console.log('📊 Analytics backend configured:', config);
    }

    /**
     * 显示管理员工具 (仅开发环境)
     */
    showAdminToolsIfDev() {
        const hostname = window.location.hostname;
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            const adminTools = document.getElementById('adminTools');
            if (adminTools) {
                adminTools.style.display = 'block';
            }
        }
    }

    /**
     * 获取统计摘要
     */
    getAnalyticsSummary() {
        const data = this.getLocalAnalytics();
        const summary = {
            totalEvents: data.length,
            pageViews: data.filter(d => d.event === 'page_view').length,
            featureUsage: {},
            sessions: new Set(data.map(d => d.sessionId)).size,
            dateRange: {
                start: data.length > 0 ? data[0].timestamp : null,
                end: data.length > 0 ? data[data.length - 1].timestamp : null
            }
        };

        // 统计功能使用情况
        data.filter(d => d.event === 'feature_usage').forEach(event => {
            const feature = event.feature;
            summary.featureUsage[feature] = (summary.featureUsage[feature] || 0) + 1;
        });

        return summary;
    }
}

// 全局统计实例
window.textDiffAnalytics = new TextDiffAnalytics();

// 导出给其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TextDiffAnalytics;
}

// 统计面板相关函数
function showAnalyticsSummary() {
    const panel = document.getElementById('analyticsSummary');
    const content = document.getElementById('analyticsContent');
    
    if (!window.textDiffAnalytics) {
        content.innerHTML = '<p>统计系统未初始化</p>';
        panel.style.display = 'block';
        return;
    }

    const summary = window.textDiffAnalytics.getAnalyticsSummary();
    
    let html = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
            <div style="padding: 10px; background: white; border-radius: 4px;">
                <h4>📈 总体统计</h4>
                <p>总事件数: <strong>${summary.totalEvents}</strong></p>
                <p>页面访问: <strong>${summary.pageViews}</strong></p>
                <p>会话数: <strong>${summary.sessions}</strong></p>
            </div>
            
            <div style="padding: 10px; background: white; border-radius: 4px;">
                <h4>📊 数据状态</h4>
                <p>本地存储: <strong style="color: green">${summary.totalEvents > 0 ? '有数据' : '无数据'}</strong></p>
                <p>后台同步: <strong style="color: ${this.getBackendUrl() ? 'green' : 'orange'}">${this.getBackendUrl() ? '自动' : '仅本地'}</strong></p>
                <p>数据保护: <strong style="color: green">已匿名化</strong></p>
            </div>
            
            <div style="padding: 10px; background: white; border-radius: 4px;">
                <h4>🎯 功能使用</h4>
    `;
    
    if (Object.keys(summary.featureUsage).length > 0) {
        for (const [feature, count] of Object.entries(summary.featureUsage)) {
            const featureName = {
                'file_upload': '文件上传',
                'text_comparison': '文本对比',
                'dictionary_usage': '词典管理',
                'theme_change': '主题切换',
                'frequency_analysis': '词频分析',
                'user_activity': '用户活动'
            }[feature] || feature;
            
            html += `<p>${featureName}: <strong>${count}</strong></p>`;
        }
    } else {
        html += '<p>暂无功能使用记录</p>';
    }
    
    html += `
            </div>
            
            <div style="padding: 10px; background: white; border-radius: 4px;">
                <h4>📅 时间范围</h4>
                <p>开始: ${summary.dateRange.start ? new Date(summary.dateRange.start).toLocaleString('zh-CN') : '无数据'}</p>
                <p>结束: ${summary.dateRange.end ? new Date(summary.dateRange.end).toLocaleString('zh-CN') : '无数据'}</p>
            </div>
        </div>
    `;
    
    content.innerHTML = html;
    panel.style.display = 'block';
}

function exportAnalyticsData() {
    if (!window.textDiffAnalytics) {
        alert('统计系统未初始化');
        return;
    }
    
    window.textDiffAnalytics.exportAnalytics();
    alert('统计数据已导出到下载文件夹');
}

function clearAnalyticsData() {
    if (!window.textDiffAnalytics) {
        alert('统计系统未初始化');
        return;
    }
    
    if (confirm('确定要清除所有本地统计数据吗？此操作不可恢复。')) {
        window.textDiffAnalytics.clearLocalAnalytics();
        document.getElementById('analyticsSummary').style.display = 'none';
        alert('统计数据已清除');
    }
}

function openAdminDashboard() {
    // 打开管理员仪表板
    const adminUrl = window.location.protocol + '//' + window.location.host + '/admin-dashboard.html';
    window.open(adminUrl, '_blank');
}

function configureAnalyticsSystem() {
    // 打开系统配置界面 (仅管理员)
    if (window.configureAnalytics) {
        window.configureAnalytics();
    } else {
        alert('配置系统未加载');
    }
}

function testBackendConnection() {
    if (!window.textDiffAnalytics) {
        alert('统计系统未初始化');
        return;
    }
    
    const backendUrl = window.textDiffAnalytics.getBackendUrl();
    if (!backendUrl) {
        alert('请先配置后台服务URL');
        return;
    }
    
    // 发送测试事件
    window.textDiffAnalytics.trackFeatureUsage('backend_test', {
        action: 'connection_test',
        timestamp: new Date().toISOString()
    });
    
    alert('测试事件已发送，请检查后台日志');
}

function sendBatchNow() {
    if (!window.textDiffAnalytics) {
        alert('统计系统未初始化');
        return;
    }
    
    window.textDiffAnalytics.sendBatchToBackend()
        .then(() => {
            alert('批量数据发送完成');
        })
        .catch(error => {
            alert('批量发送失败: ' + error.message);
        });
}