/**
 * 简单的用户计数器 - 用于GitHub Pages环境
 * 使用localStorage + 定期同步的方式统计用户
 */

class SimpleUserCounter {
    constructor() {
        this.storageKey = 'textdiff_user_stats';
        this.sessionKey = 'textdiff_session_' + Date.now();
        this.heartbeatInterval = 30000; // 30秒心跳
        this.init();
    }

    init() {
        // 记录用户访问
        this.recordUserVisit();
        
        // 启动心跳
        this.startHeartbeat();
        
        // 监听页面关闭
        window.addEventListener('beforeunload', () => {
            this.recordUserLeave();
        });

        // 监听页面可见性变化
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.recordUserLeave();
            } else {
                this.recordUserVisit();
            }
        });

        console.log('👥 Simple User Counter initialized');
    }

    recordUserVisit() {
        const stats = this.getStats();
        const now = Date.now();
        
        // 记录新访问
        stats.totalVisits = (stats.totalVisits || 0) + 1;
        stats.lastVisit = now;
        
        // 添加到活跃会话
        if (!stats.activeSessions) {
            stats.activeSessions = {};
        }
        stats.activeSessions[this.sessionKey] = now;
        
        // 清理过期会话 (超过5分钟)
        this.cleanupExpiredSessions(stats);
        
        this.saveStats(stats);
        this.updateDisplay();
        
        console.log('👤 User visit recorded:', this.sessionKey);
    }

    recordUserLeave() {
        const stats = this.getStats();
        
        // 从活跃会话中移除
        if (stats.activeSessions && stats.activeSessions[this.sessionKey]) {
            delete stats.activeSessions[this.sessionKey];
            this.saveStats(stats);
            this.updateDisplay();
        }
        
        console.log('👋 User leave recorded:', this.sessionKey);
    }

    startHeartbeat() {
        setInterval(() => {
            const stats = this.getStats();
            const now = Date.now();
            
            // 更新心跳时间
            if (stats.activeSessions && stats.activeSessions[this.sessionKey]) {
                stats.activeSessions[this.sessionKey] = now;
                this.cleanupExpiredSessions(stats);
                this.saveStats(stats);
                this.updateDisplay();
            }
        }, this.heartbeatInterval);
    }

    cleanupExpiredSessions(stats) {
        if (!stats.activeSessions) return;
        
        const now = Date.now();
        const timeout = 5 * 60 * 1000; // 5分钟超时
        
        for (const [sessionId, lastActivity] of Object.entries(stats.activeSessions)) {
            if (now - lastActivity > timeout) {
                delete stats.activeSessions[sessionId];
            }
        }
    }

    getStats() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            return stored ? JSON.parse(stored) : {};
        } catch (error) {
            return {};
        }
    }

    saveStats(stats) {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(stats));
        } catch (error) {
            console.warn('Failed to save user stats:', error);
        }
    }

    getCurrentUserCount() {
        const stats = this.getStats();
        return stats.activeSessions ? Object.keys(stats.activeSessions).length : 0;
    }

    getTotalVisits() {
        const stats = this.getStats();
        return stats.totalVisits || 0;
    }

    updateDisplay() {
        // 更新页面上的用户计数显示
        const currentUsers = this.getCurrentUserCount();
        const totalVisits = this.getTotalVisits();
        
        // 查找并更新显示元素
        const userCountElements = document.querySelectorAll('.user-count');
        userCountElements.forEach(element => {
            element.textContent = currentUsers;
        });
        
        const visitCountElements = document.querySelectorAll('.visit-count');
        visitCountElements.forEach(element => {
            element.textContent = totalVisits;
        });
        
        // 在控制台显示统计
        console.log(`👥 Current users: ${currentUsers}, Total visits: ${totalVisits}`);
    }

    // 获取统计摘要
    getStatsSummary() {
        const stats = this.getStats();
        return {
            currentUsers: this.getCurrentUserCount(),
            totalVisits: this.getTotalVisits(),
            lastVisit: stats.lastVisit ? new Date(stats.lastVisit).toLocaleString() : 'Never',
            activeSessions: stats.activeSessions || {}
        };
    }

    // 清除所有统计数据
    clearStats() {
        localStorage.removeItem(this.storageKey);
        console.log('📊 User stats cleared');
    }
}

// 自动初始化 (所有环境)
window.simpleUserCounter = new SimpleUserCounter();