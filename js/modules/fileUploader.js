// 文件上传处理模块
export class FileUploader {
  constructor() {
    this.onFileProcessed = null;
  }

  init() {
    this.setupUploadAreas();
    this.setupFileInputs();
  }

  setupUploadAreas() {
    const uploadAreas = ['uploadAreaA', 'uploadAreaB'];
    
    uploadAreas.forEach(areaId => {
      const area = document.getElementById(areaId);
      const target = areaId.slice(-1); // 获取 A 或 B
      
      if (!area) return;

      // 点击上传区域
      area.addEventListener('click', () => {
        const fileInput = document.getElementById(`file${target}`);
        if (fileInput) fileInput.click();
      });

      // 拖拽事件
      area.addEventListener('dragover', (e) => {
        e.preventDefault();
        area.classList.add('dragover');
      });

      area.addEventListener('dragleave', (e) => {
        e.preventDefault();
        area.classList.remove('dragover');
      });

      area.addEventListener('drop', (e) => {
        e.preventDefault();
        area.classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
          this.processFile(files[0], target);
        }
      });
    });
  }

  setupFileInputs() {
    const fileInputs = ['fileA', 'fileB'];
    
    fileInputs.forEach(inputId => {
      const input = document.getElementById(inputId);
      const target = inputId.slice(-1);
      
      if (!input) return;

      input.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          this.processFile(file, target);
        }
      });
    });
  }

  async processFile(file, target) {
    const textarea = document.getElementById(`text${target}`);
    if (!textarea) return;

    // 检查文件类型
    const allowedTypes = ['.pdf', '.txt', '.docx'];
    const fileExt = '.' + file.name.split('.').pop().toLowerCase();
    
    if (!allowedTypes.includes(fileExt)) {
      this.showError(`不支持的文件类型: ${fileExt}`);
      return;
    }

    // 检查文件大小 (10MB)
    if (file.size > 10 * 1024 * 1024) {
      this.showError('文件大小超过 10MB 限制');
      return;
    }

    try {
      textarea.value = `正在处理文件 "${file.name}"，请稍候...`;
      
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/extract-text', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '文件处理失败');
      }

      const data = await response.json();
      textarea.value = data.text;
      
      // 触发回调
      if (this.onFileProcessed) {
        this.onFileProcessed(target, data.text);
      }

      this.showSuccess(`文件 "${file.name}" 处理完成`);
      
    } catch (error) {
      console.error('文件处理错误:', error);
      textarea.value = `文件处理失败: ${error.message}`;
      this.showError(error.message);
    }
  }

  showError(message) {
    this.showNotification(message, 'error');
  }

  showSuccess(message) {
    this.showNotification(message, 'success');
  }

  showNotification(message, type = 'info') {
    // 创建通知元素
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // 添加样式
    Object.assign(notification.style, {
      position: 'fixed',
      top: '20px',
      right: '20px',
      padding: '12px 20px',
      borderRadius: '6px',
      color: 'white',
      fontWeight: '500',
      zIndex: '10000',
      maxWidth: '400px',
      wordWrap: 'break-word',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      transform: 'translateX(100%)',
      transition: 'transform 0.3s ease'
    });

    // 设置背景色
    const colors = {
      success: '#10b981',
      error: '#ef4444',
      info: '#3b82f6'
    };
    notification.style.backgroundColor = colors[type] || colors.info;

    document.body.appendChild(notification);

    // 动画显示
    setTimeout(() => {
      notification.style.transform = 'translateX(0)';
    }, 100);

    // 自动隐藏
    setTimeout(() => {
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }
}