// 主题管理模块
export class ThemeManager {
  constructor() {
    this.currentTheme = 'default';
    this.themes = {
      'default': '🌞',
      'dark': '🌙',
      'high-contrast': '🔆',
      'blue': '🔵',
      'green': '🟢'
    };
  }

  init() {
    // 从本地存储加载主题
    const savedTheme = localStorage.getItem('theme') || 'default';
    this.applyTheme(savedTheme);
    
    // 绑定主题切换按钮
    this.bindThemeToggle();
    
    // 监听系统主题变化
    this.watchSystemTheme();
  }

  bindThemeToggle() {
    const themeToggle = document.getElementById('themeToggle');
    if (!themeToggle) return;

    // 创建主题选择菜单
    this.createThemeMenu(themeToggle);
    
    // 点击切换主题
    themeToggle.addEventListener('click', () => {
      this.toggleThemeMenu();
    });
  }

  createThemeMenu(toggleBtn) {
    // 创建主题菜单
    const menu = document.createElement('div');
    menu.id = 'themeMenu';
    menu.className = 'theme-menu hidden';
    
    // 菜单样式
    Object.assign(menu.style, {
      position: 'absolute',
      top: '100%',
      right: '0',
      marginTop: '8px',
      background: 'var(--bg-primary)',
      border: '1px solid var(--border-color)',
      borderRadius: 'var(--radius-md)',
      boxShadow: 'var(--shadow-lg)',
      padding: '8px',
      minWidth: '150px',
      zIndex: '1000'
    });

    // 主题选项
    const themeOptions = [
      { key: 'default', name: '默认主题', icon: '🌞' },
      { key: 'dark', name: '暗色主题', icon: '🌙' },
      { key: 'high-contrast', name: '高对比度', icon: '🔆' },
      { key: 'blue', name: '蓝色主题', icon: '🔵' },
      { key: 'green', name: '绿色主题', icon: '🟢' }
    ];

    themeOptions.forEach(theme => {
      const option = document.createElement('button');
      option.className = 'theme-option';
      option.innerHTML = `${theme.icon} ${theme.name}`;
      
      // 选项样式
      Object.assign(option.style, {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        width: '100%',
        padding: '8px 12px',
        border: 'none',
        background: 'transparent',
        color: 'var(--text-primary)',
        cursor: 'pointer',
        borderRadius: 'var(--radius-sm)',
        fontSize: '0.875rem'
      });

      // 当前主题高亮
      if (theme.key === this.currentTheme) {
        option.style.background = 'var(--primary-color)';
        option.style.color = 'white';
      }

      // 悬停效果
      option.addEventListener('mouseenter', () => {
        if (theme.key !== this.currentTheme) {
          option.style.background = 'var(--bg-tertiary)';
        }
      });

      option.addEventListener('mouseleave', () => {
        if (theme.key !== this.currentTheme) {
          option.style.background = 'transparent';
        }
      });

      // 点击切换主题
      option.addEventListener('click', (e) => {
        e.stopPropagation();
        this.applyTheme(theme.key);
        this.hideThemeMenu();
      });

      menu.appendChild(option);
    });

    // 将菜单添加到按钮容器
    const container = toggleBtn.parentElement;
    container.style.position = 'relative';
    container.appendChild(menu);

    // 点击外部关闭菜单
    document.addEventListener('click', (e) => {
      if (!container.contains(e.target)) {
        this.hideThemeMenu();
      }
    });
  }

  toggleThemeMenu() {
    const menu = document.getElementById('themeMenu');
    if (!menu) return;

    if (menu.classList.contains('hidden')) {
      this.showThemeMenu();
    } else {
      this.hideThemeMenu();
    }
  }

  showThemeMenu() {
    const menu = document.getElementById('themeMenu');
    if (menu) {
      menu.classList.remove('hidden');
      // 更新选项状态
      this.updateMenuOptions();
    }
  }

  hideThemeMenu() {
    const menu = document.getElementById('themeMenu');
    if (menu) {
      menu.classList.add('hidden');
    }
  }

  updateMenuOptions() {
    const menu = document.getElementById('themeMenu');
    if (!menu) return;

    const options = menu.querySelectorAll('.theme-option');
    options.forEach((option, index) => {
      const themeKeys = ['default', 'dark', 'high-contrast', 'blue', 'green'];
      const isActive = themeKeys[index] === this.currentTheme;
      
      if (isActive) {
        option.style.background = 'var(--primary-color)';
        option.style.color = 'white';
      } else {
        option.style.background = 'transparent';
        option.style.color = 'var(--text-primary)';
      }
    });
  }

  applyTheme(themeName) {
    // 移除旧主题
    document.documentElement.removeAttribute('data-theme');
    
    // 应用新主题
    if (themeName !== 'default') {
      document.documentElement.setAttribute('data-theme', themeName);
    }
    
    this.currentTheme = themeName;
    
    // 更新按钮图标
    this.updateToggleButton();
    
    // 保存到本地存储
    localStorage.setItem('theme', themeName);
    
    // 触发主题变化事件
    this.dispatchThemeChange(themeName);
  }

  updateToggleButton() {
    const toggleBtn = document.getElementById('themeToggle');
    if (toggleBtn) {
      toggleBtn.textContent = this.themes[this.currentTheme] || '🌞';
      toggleBtn.title = `当前主题: ${this.getThemeName(this.currentTheme)}`;
    }
  }

  getThemeName(themeKey) {
    const names = {
      'default': '默认主题',
      'dark': '暗色主题',
      'high-contrast': '高对比度',
      'blue': '蓝色主题',
      'green': '绿色主题'
    };
    return names[themeKey] || '未知主题';
  }

  watchSystemTheme() {
    // 监听系统主题变化
    if (window.matchMedia) {
      const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
      
      darkModeQuery.addEventListener('change', (e) => {
        // 只有在用户没有手动设置主题时才自动切换
        const savedTheme = localStorage.getItem('theme');
        if (!savedTheme) {
          this.applyTheme(e.matches ? 'dark' : 'default');
        }
      });
    }
  }

  dispatchThemeChange(themeName) {
    // 派发主题变化事件，供其他模块监听
    const event = new CustomEvent('themeChange', {
      detail: { theme: themeName }
    });
    document.dispatchEvent(event);
  }

  // 获取当前主题的CSS变量值
  getCSSVariable(variableName) {
    return getComputedStyle(document.documentElement)
      .getPropertyValue(variableName)
      .trim();
  }

  // 动态设置CSS变量
  setCSSVariable(variableName, value) {
    document.documentElement.style.setProperty(variableName, value);
  }

  // 重置所有自定义CSS变量
  resetCustomVariables() {
    const customVars = [
      '--fw-strong-bg',
      '--fw-weak-bg',
      '--fw-permission-bg',
      '--fw-hedging-bg',
      '--fw-intensifier-bg',
      '--diff-del-bg',
      '--diff-ins-bg'
    ];

    customVars.forEach(varName => {
      document.documentElement.style.removeProperty(varName);
    });
  }

  // 导出主题配置
  exportThemeConfig() {
    const config = {
      currentTheme: this.currentTheme,
      customVariables: {}
    };

    // 获取所有自定义CSS变量
    const style = document.documentElement.style;
    for (let i = 0; i < style.length; i++) {
      const property = style[i];
      if (property.startsWith('--')) {
        config.customVariables[property] = style.getPropertyValue(property);
      }
    }

    return config;
  }

  // 导入主题配置
  importThemeConfig(config) {
    if (config.currentTheme) {
      this.applyTheme(config.currentTheme);
    }

    if (config.customVariables) {
      Object.entries(config.customVariables).forEach(([property, value]) => {
        this.setCSSVariable(property, value);
      });
    }
  }
}