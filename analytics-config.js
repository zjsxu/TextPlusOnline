/**
 * TextDiff+ Analytics 配置管理
 * 仅供系统管理员使用
 */

class AnalyticsConfig {
    constructor() {
        this.config = this.loadConfig();
        this.init();
    }

    /**
     * 加载配置
     */
    loadConfig() {
        // 从localStorage加载管理员配置
        const saved = localStorage.getItem('analytics_admin_config');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (error) {
                console.warn('Failed to parse saved config:', error);
            }
        }

        // 默认配置
        return {
            backendUrl: 'http://localhost:3001/api/analytics',
            batchInterval: 30000,
            enabled: true,
            debugMode: false,
            autoStart: true
        };
    }

    /**
     * 保存配置
     */
    saveConfig() {
        localStorage.setItem('analytics_admin_config', JSON.stringify(this.config));
    }

    /**
     * 初始化
     */
    init() {
        // 如果是管理员环境，应用配置
        if (this.isAdminEnvironment()) {
            this.applyConfig();
        }
    }

    /**
     * 检查是否为管理员环境
     */
    isAdminEnvironment() {
        const hostname = window.location.hostname;
        return hostname === 'localhost' || hostname === '127.0.0.1';
    }

    /**
     * 应用配置到analytics系统
     */
    applyConfig() {
        if (window.textDiffAnalytics && this.config.enabled) {
            // 设置全局配置
            window.ANALYTICS_CONFIG = {
                backendUrl: this.config.backendUrl,
                batchInterval: this.config.batchInterval,
                enabled: this.config.enabled
            };

            // 如果analytics已初始化，直接配置
            if (typeof window.textDiffAnalytics.configureBackend === 'function') {
                window.textDiffAnalytics.configureBackend(window.ANALYTICS_CONFIG);
            }

            if (this.config.debugMode) {
                console.log('📊 Analytics Admin Config Applied:', this.config);
            }
        }
    }

    /**
     * 更新配置
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.saveConfig();
        this.applyConfig();
    }

    /**
     * 获取当前配置
     */
    getConfig() {
        return { ...this.config };
    }

    /**
     * 重置为默认配置
     */
    resetConfig() {
        localStorage.removeItem('analytics_admin_config');
        this.config = this.loadConfig();
        this.applyConfig();
    }

    /**
     * 显示配置界面
     */
    showConfigUI() {
        const modal = this.createConfigModal();
        document.body.appendChild(modal);
    }

    /**
     * 创建配置模态框
     */
    createConfigModal() {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.5); z-index: 10000;
            display: flex; align-items: center; justify-content: center;
        `;

        const content = document.createElement('div');
        content.style.cssText = `
            background: white; padding: 30px; border-radius: 10px;
            max-width: 500px; width: 90%; max-height: 80vh; overflow-y: auto;
        `;

        content.innerHTML = `
            <h2>🔧 Analytics 系统配置</h2>
            <p style="color: #666; margin-bottom: 20px;">仅限系统管理员使用</p>
            
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">后台服务地址:</label>
                <input type="text" id="backendUrl" value="${this.config.backendUrl}" 
                       style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
            </div>
            
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">批量发送间隔 (毫秒):</label>
                <input type="number" id="batchInterval" value="${this.config.batchInterval}" 
                       style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
            </div>
            
            <div style="margin-bottom: 15px;">
                <label style="display: flex; align-items: center;">
                    <input type="checkbox" id="enabled" ${this.config.enabled ? 'checked' : ''} 
                           style="margin-right: 8px;">
                    启用后台数据收集
                </label>
            </div>
            
            <div style="margin-bottom: 20px;">
                <label style="display: flex; align-items: center;">
                    <input type="checkbox" id="debugMode" ${this.config.debugMode ? 'checked' : ''} 
                           style="margin-right: 8px;">
                    启用调试模式
                </label>
            </div>
            
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button id="resetBtn" style="padding: 8px 16px; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer;">
                    重置默认
                </button>
                <button id="cancelBtn" style="padding: 8px 16px; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer;">
                    取消
                </button>
                <button id="saveBtn" style="padding: 8px 16px; border: none; background: #007bff; color: white; border-radius: 4px; cursor: pointer;">
                    保存配置
                </button>
            </div>
        `;

        // 绑定事件
        content.querySelector('#saveBtn').onclick = () => {
            this.updateConfig({
                backendUrl: content.querySelector('#backendUrl').value,
                batchInterval: parseInt(content.querySelector('#batchInterval').value),
                enabled: content.querySelector('#enabled').checked,
                debugMode: content.querySelector('#debugMode').checked
            });
            document.body.removeChild(modal);
            alert('配置已保存并应用');
        };

        content.querySelector('#cancelBtn').onclick = () => {
            document.body.removeChild(modal);
        };

        content.querySelector('#resetBtn').onclick = () => {
            if (confirm('确定要重置为默认配置吗？')) {
                this.resetConfig();
                document.body.removeChild(modal);
                alert('配置已重置为默认值');
            }
        };

        modal.appendChild(content);
        return modal;
    }
}

// 自动初始化 (仅在管理员环境)
if (typeof window !== 'undefined') {
    window.analyticsConfig = new AnalyticsConfig();
    
    // 提供全局配置函数
    window.configureAnalytics = () => {
        window.analyticsConfig.showConfigUI();
    };
}

// 导出供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AnalyticsConfig;
}