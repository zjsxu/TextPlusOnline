/**
 * TextDiff+ 网站使用统计模块
 * Website Usage Analytics Module
 */

class TextDiffAnalytics {
    constructor() {
        this.sessionId = this.generateSessionId();
        this.startTime = Date.now();
        this.events = [];
        
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
        });

        // 监听用户活动
        this.setupActivityTracking();
        
        console.log('📊 TextDiff+ Analytics initialized');
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
        
        // 方案1: 发送到免费统计服务 (可选)
        try {
            // 使用 httpbin.org 作为示例端点 (实际使用时替换为真实的统计服务)
            await fetch('https://httpbin.org/post', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    source: 'TextDiffPlus',
                    data: data
                })
            });
        } catch (error) {
            // 静默处理错误，不影响用户体验
            console.log('Analytics data queued locally');
        }

        // 方案2: 本地存储统计数据
        this.saveToLocalStorage(data);
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