/* =========================================
   theme.js —— 主题系统（默认 / 高对比 / 自定义）
   ========================================= */

// ---- CSS变量默认值（供恢复默认使用） ----
const DEFAULT_THEME = {
    '--fw-strong-bg': 'rgba(255, 0, 0, 0.12)',
    '--fw-weak-bg': 'rgba(255, 165, 0, 0.12)',
    '--fw-permission-bg': 'rgba(0, 128, 255, 0.12)',
    '--fw-hedging-bg': 'rgba(0, 0, 255, 0.12)',
    '--fw-intensifier-bg': 'rgba(128, 0, 128, 0.12)',
    '--diff-del-bg': 'rgba(255, 200, 200, 0.35)',
    '--diff-ins-bg': 'rgba(200, 255, 200, 0.35)'
};

// ---- 高对比主题 ----
const HIGH_CONTRAST_THEME = {
    '--fw-strong-bg': '#ff4d4d',
    '--fw-weak-bg': '#ffa64d',
    '--fw-permission-bg': '#4da6ff',
    '--fw-hedging-bg': '#4d4dff',
    '--fw-intensifier-bg': '#b84dff',
    '--diff-del-bg': '#ffcccc',
    '--diff-ins-bg': '#ccffcc'
};

// ---- 应用主题函数 ----
function applyTheme(themeName) {
    const customSection = document.getElementById('customColorSection');

    // 统计主题切换
    if (window.textDiffAnalytics) {
        window.textDiffAnalytics.trackThemeChange(themeName);
    }

    if (themeName === 'default') {
        for (const key in DEFAULT_THEME) {
            document.documentElement.style.setProperty(key, DEFAULT_THEME[key]);
        }
        localStorage.setItem('themeMode', 'default');
        if (customSection) customSection.style.display = 'none';
        return;
    }

    if (themeName === 'highContrast') {
        for (const key in HIGH_CONTRAST_THEME) {
            document.documentElement.style.setProperty(key, HIGH_CONTRAST_THEME[key]);
        }
        localStorage.setItem('themeMode', 'highContrast');
        if (customSection) customSection.style.display = 'none';
        return;
    }

    if (themeName === 'custom') {
        if (customSection) customSection.style.display = 'block';
        localStorage.setItem('themeMode', 'custom');
        loadCustomFromStorage();
    }
}

// ---- 实时更新用户自定义颜色 ----
function updateCustomColor(varName, value) {
    document.documentElement.style.setProperty(varName, value);
    localStorage.setItem(varName, value);
}

// ---- 从 localStorage 加载自定义颜色 ----
function loadCustomFromStorage() {
    for (const key in DEFAULT_THEME) {
        const saved = localStorage.getItem(key);
        if (saved) {
            document.documentElement.style.setProperty(key, saved);
        }
    }
}

// ---- 恢复默认颜色 ----
function resetCustomColors() {
    for (const key in DEFAULT_THEME) {
        document.documentElement.style.setProperty(key, DEFAULT_THEME[key]);
        localStorage.removeItem(key);
    }
    alert("已恢复默认颜色！");
}

// ---- 页面加载时自动应用主题 ----
window.addEventListener('DOMContentLoaded', () => {
    const mode = localStorage.getItem('themeMode') || 'default';
    applyTheme(mode);
});