// UI管理模块
export class UIManager {
  constructor() {
    this.loadingOverlay = null;
    this.notifications = [];
  }

  init() {
    this.createLoadingOverlay();
    this.setupGlobalErrorHandler();
  }

  createLoadingOverlay() {
    this.loadingOverlay = document.getElementById('loadingOverlay');
    if (!this.loadingOverlay) {
      // 如果不存在，创建加载遮罩
      this.loadingOverlay = document.createElement('div');
      this.loadingOverlay.id = 'loadingOverlay';
      this.loadingOverlay.className = 'loading-overlay hidden';
      this.loadingOverlay.innerHTML = `
        <div class="loading-spinner"></div>
        <p>正在处理中...</p>
      `;
      document.body.appendChild(this.loadingOverlay);
    }
  }

  showLoading(message = '正在处理中...') {
    if (this.loadingOverlay) {
      const messageEl = this.loadingOverlay.querySelector('p');
      if (messageEl) {
        messageEl.textContent = message;
      }
      this.loadingOverlay.classList.remove('hidden');
    }
  }

  hideLoading() {
    if (this.loadingOverlay) {
      this.loadingOverlay.classList.add('hidden');
    }
  }

  showError(message, duration = 5000) {
    this.showNotification(message, 'error', duration);
  }

  showSuccess(message, duration = 3000) {
    this.showNotification(message, 'success', duration);
  }

  showWarning(message, duration = 4000) {
    this.showNotification(message, 'warning', duration);
  }

  showInfo(message, duration = 3000) {
    this.showNotification(message, 'info', duration);
  }

  showNotification(message, type = 'info', duration = 3000) {
    const notification = this.createNotification(message, type);
    
    // 添加到页面
    document.body.appendChild(notification);
    this.notifications.push(notification);

    // 显示动画
    setTimeout(() => {
      notification.classList.add('show');
    }, 100);

    // 自动隐藏
    setTimeout(() => {
      this.hideNotification(notification);
    }, duration);

    // 点击关闭
    const closeBtn = notification.querySelector('.notification-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.hideNotification(notification);
      });
    }

    return notification;
  }

  createNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    // 图标映射
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };

    notification.innerHTML = `
      <div class="notification-content">
        <span class="notification-icon">${icons[type] || icons.info}</span>
        <span class="notification-message">${message}</span>
        <button class="notification-close" title="关闭">×</button>
      </div>
    `;

    // 样式
    Object.assign(notification.style, {
      position: 'fixed',
      top: '20px',
      right: '20px',
      minWidth: '300px',
      maxWidth: '500px',
      padding: '16px',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      zIndex: '10000',
      transform: 'translateX(100%)',
      transition: 'all 0.3s ease',
      fontFamily: 'inherit',
      fontSize: '14px'
    });

    // 类型样式
    const typeStyles = {
      success: {
        backgroundColor: '#10b981',
        color: 'white',
        borderLeft: '4px solid #059669'
      },
      error: {
        backgroundColor: '#ef4444',
        color: 'white',
        borderLeft: '4px solid #dc2626'
      },
      warning: {
        backgroundColor: '#f59e0b',
        color: 'white',
        borderLeft: '4px solid #d97706'
      },
      info: {
        backgroundColor: '#3b82f6',
        color: 'white',
        borderLeft: '4px solid #2563eb'
      }
    };

    Object.assign(notification.style, typeStyles[type] || typeStyles.info);

    // 内容样式
    const content = notification.querySelector('.notification-content');
    Object.assign(content.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '12px'
    });

    // 图标样式
    const icon = notification.querySelector('.notification-icon');
    Object.assign(icon.style, {
      fontSize: '16px',
      flexShrink: '0'
    });

    // 消息样式
    const messageEl = notification.querySelector('.notification-message');
    Object.assign(messageEl.style, {
      flex: '1',
      wordWrap: 'break-word'
    });

    // 关闭按钮样式
    const closeBtn = notification.querySelector('.notification-close');
    Object.assign(closeBtn.style, {
      background: 'none',
      border: 'none',
      color: 'inherit',
      fontSize: '18px',
      cursor: 'pointer',
      padding: '0',
      width: '20px',
      height: '20px',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      opacity: '0.8'
    });

    closeBtn.addEventListener('mouseenter', () => {
      closeBtn.style.opacity = '1';
      closeBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
    });

    closeBtn.addEventListener('mouseleave', () => {
      closeBtn.style.opacity = '0.8';
      closeBtn.style.backgroundColor = 'transparent';
    });

    // 显示类
    notification.classList.add('show');
    notification.style.transform = 'translateX(0)';

    return notification;
  }

  hideNotification(notification) {
    if (!notification || !notification.parentNode) return;

    notification.style.transform = 'translateX(100%)';
    notification.style.opacity = '0';

    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
      
      // 从数组中移除
      const index = this.notifications.indexOf(notification);
      if (index > -1) {
        this.notifications.splice(index, 1);
      }
    }, 300);
  }

  clearAllNotifications() {
    this.notifications.forEach(notification => {
      this.hideNotification(notification);
    });
  }

  setupGlobalErrorHandler() {
    // 全局错误处理
    window.addEventListener('error', (event) => {
      console.error('全局错误:', event.error);
      this.showError('发生了一个错误，请查看控制台获取详细信息');
    });

    // Promise 错误处理
    window.addEventListener('unhandledrejection', (event) => {
      console.error('未处理的 Promise 错误:', event.reason);
      this.showError('操作失败，请重试');
    });
  }

  // 确认对话框
  confirm(message, title = '确认') {
    return new Promise((resolve) => {
      const modal = this.createConfirmModal(message, title, resolve);
      document.body.appendChild(modal);
    });
  }

  createConfirmModal(message, title, callback) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>${title}</h3>
        </div>
        <div class="modal-body">
          <p>${message}</p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" data-action="cancel">取消</button>
          <button class="btn btn-primary" data-action="confirm">确认</button>
        </div>
      </div>
    `;

    // 添加底部样式
    const footer = modal.querySelector('.modal-footer');
    Object.assign(footer.style, {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: '12px',
      padding: '16px 24px',
      borderTop: '1px solid var(--border-color)'
    });

    // 事件处理
    modal.addEventListener('click', (e) => {
      const action = e.target.dataset.action;
      if (action === 'confirm') {
        callback(true);
        this.removeModal(modal);
      } else if (action === 'cancel' || e.target === modal) {
        callback(false);
        this.removeModal(modal);
      }
    });

    // ESC 键关闭
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        callback(false);
        this.removeModal(modal);
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);

    return modal;
  }

  removeModal(modal) {
    if (modal && modal.parentNode) {
      modal.style.opacity = '0';
      setTimeout(() => {
        if (modal.parentNode) {
          modal.parentNode.removeChild(modal);
        }
      }, 200);
    }
  }

  // 进度条
  createProgressBar(container, options = {}) {
    const {
      max = 100,
      value = 0,
      showText = true,
      animated = true
    } = options;

    const progressBar = document.createElement('div');
    progressBar.className = 'progress-bar';
    
    progressBar.innerHTML = `
      <div class="progress-track">
        <div class="progress-fill"></div>
      </div>
      ${showText ? '<div class="progress-text">0%</div>' : ''}
    `;

    // 样式
    Object.assign(progressBar.style, {
      width: '100%',
      marginBottom: '16px'
    });

    const track = progressBar.querySelector('.progress-track');
    Object.assign(track.style, {
      width: '100%',
      height: '8px',
      backgroundColor: 'var(--bg-tertiary)',
      borderRadius: '4px',
      overflow: 'hidden'
    });

    const fill = progressBar.querySelector('.progress-fill');
    Object.assign(fill.style, {
      height: '100%',
      backgroundColor: 'var(--primary-color)',
      borderRadius: '4px',
      transition: animated ? 'width 0.3s ease' : 'none',
      width: '0%'
    });

    if (showText) {
      const text = progressBar.querySelector('.progress-text');
      Object.assign(text.style, {
        textAlign: 'center',
        fontSize: '12px',
        color: 'var(--text-secondary)',
        marginTop: '4px'
      });
    }

    // 更新方法
    progressBar.update = (newValue) => {
      const percentage = Math.min(100, Math.max(0, (newValue / max) * 100));
      fill.style.width = percentage + '%';
      
      if (showText) {
        const text = progressBar.querySelector('.progress-text');
        text.textContent = Math.round(percentage) + '%';
      }
    };

    // 设置初始值
    progressBar.update(value);

    if (container) {
      container.appendChild(progressBar);
    }

    return progressBar;
  }

  // 工具提示
  createTooltip(element, text, position = 'top') {
    if (!element) return;

    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    tooltip.textContent = text;
    
    Object.assign(tooltip.style, {
      position: 'absolute',
      background: 'rgba(0, 0, 0, 0.8)',
      color: 'white',
      padding: '6px 12px',
      borderRadius: '4px',
      fontSize: '12px',
      whiteSpace: 'nowrap',
      zIndex: '10001',
      opacity: '0',
      transition: 'opacity 0.2s ease',
      pointerEvents: 'none'
    });

    document.body.appendChild(tooltip);

    const showTooltip = (e) => {
      const rect = element.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();
      
      let left, top;
      
      switch (position) {
        case 'top':
          left = rect.left + (rect.width - tooltipRect.width) / 2;
          top = rect.top - tooltipRect.height - 8;
          break;
        case 'bottom':
          left = rect.left + (rect.width - tooltipRect.width) / 2;
          top = rect.bottom + 8;
          break;
        case 'left':
          left = rect.left - tooltipRect.width - 8;
          top = rect.top + (rect.height - tooltipRect.height) / 2;
          break;
        case 'right':
          left = rect.right + 8;
          top = rect.top + (rect.height - tooltipRect.height) / 2;
          break;
      }
      
      tooltip.style.left = left + 'px';
      tooltip.style.top = top + 'px';
      tooltip.style.opacity = '1';
    };

    const hideTooltip = () => {
      tooltip.style.opacity = '0';
    };

    element.addEventListener('mouseenter', showTooltip);
    element.addEventListener('mouseleave', hideTooltip);

    // 返回清理函数
    return () => {
      element.removeEventListener('mouseenter', showTooltip);
      element.removeEventListener('mouseleave', hideTooltip);
      if (tooltip.parentNode) {
        tooltip.parentNode.removeChild(tooltip);
      }
    };
  }
}