// 词典管理模块
export class DictionaryManager {
  constructor() {
    this.dictionary = {};
    this.onDictionaryUpdate = null;
    
    this.categoryNames = {
      'AUX_MODAL_STRONG': '强制性情态词',
      'AUX_MODAL_WEAK': '弱情态词',
      'AUX_MODAL_PERMISSION': '许可性情态词',
      'ADV_HEDGING': '模糊副词',
      'ADV_INTENSIFIER': '加强副词'
    };
  }

  init(initialDictionary = {}) {
    this.dictionary = { ...initialDictionary };
    this.bindEvents();
    this.renderDictionary();
  }

  bindEvents() {
    // 添加词汇按钮
    const addBtn = document.getElementById('addWordBtn');
    if (addBtn) {
      addBtn.addEventListener('click', () => this.addWord());
    }

    // 回车键添加词汇
    const wordInput = document.getElementById('newWordInput');
    if (wordInput) {
      wordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.addWord();
        }
      });
    }

    // 导出词典
    const exportBtn = document.getElementById('exportDictBtn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportDictionary());
    }

    // 导入词典
    const importFile = document.getElementById('importDictFile');
    if (importFile) {
      importFile.addEventListener('change', (e) => this.importDictionary(e));
    }

    // 重置词典
    const resetBtn = document.getElementById('resetDictBtn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => this.resetDictionary());
    }
  }

  addWord() {
    const wordInput = document.getElementById('newWordInput');
    const categorySelect = document.getElementById('wordCategorySelect');
    
    if (!wordInput || !categorySelect) return;

    const word = wordInput.value.trim();
    const category = categorySelect.value;

    if (!word) {
      this.showMessage('请输入词汇', 'error');
      return;
    }

    if (this.dictionary[word]) {
      this.showMessage(`词汇 "${word}" 已存在`, 'warning');
      return;
    }

    // 添加到词典
    this.dictionary[word] = category;
    
    // 清空输入框
    wordInput.value = '';
    
    // 重新渲染
    this.renderDictionary();
    
    // 触发更新回调
    if (this.onDictionaryUpdate) {
      this.onDictionaryUpdate(this.dictionary);
    }

    this.showMessage(`成功添加词汇 "${word}"`, 'success');
  }

  removeWord(word) {
    if (confirm(`确定要删除词汇 "${word}" 吗？`)) {
      delete this.dictionary[word];
      this.renderDictionary();
      
      if (this.onDictionaryUpdate) {
        this.onDictionaryUpdate(this.dictionary);
      }

      this.showMessage(`已删除词汇 "${word}"`, 'success');
    }
  }

  renderDictionary() {
    const container = document.getElementById('dictionaryView');
    if (!container) return;

    // 按类别分组
    const grouped = {};
    for (const [word, category] of Object.entries(this.dictionary)) {
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(word);
    }

    // 生成HTML
    let html = '';
    
    if (Object.keys(grouped).length === 0) {
      html = '<p class="empty-message">词典为空，请添加词汇</p>';
    } else {
      for (const [category, words] of Object.entries(grouped)) {
        const categoryName = this.categoryNames[category] || category;
        html += `
          <div class="dict-category">
            <h4>${categoryName} (${words.length}个)</h4>
            <div class="dict-words">
              ${words.map(word => `
                <div class="dict-word">
                  <span>${word}</span>
                  <button class="dict-word-remove" onclick="window.textDiffApp.dictionaryManager.removeWord('${word}')" title="删除">
                    ×
                  </button>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }
    }

    container.innerHTML = html;
  }

  exportDictionary() {
    const dataStr = JSON.stringify(this.dictionary, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `function-words-dictionary-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.showMessage('词典导出成功', 'success');
  }

  async importDictionary(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const text = await this.readFileAsText(file);
      const importedDict = JSON.parse(text);
      
      if (typeof importedDict !== 'object' || importedDict === null) {
        throw new Error('无效的词典格式');
      }

      // 验证词典格式
      for (const [word, category] of Object.entries(importedDict)) {
        if (typeof word !== 'string' || typeof category !== 'string') {
          throw new Error('词典格式错误：词汇和类别必须是字符串');
        }
      }

      // 询问是否覆盖现有词典
      const shouldMerge = confirm('是否与现有词典合并？点击"取消"将完全替换现有词典。');
      
      if (shouldMerge) {
        Object.assign(this.dictionary, importedDict);
      } else {
        this.dictionary = importedDict;
      }

      this.renderDictionary();
      
      if (this.onDictionaryUpdate) {
        this.onDictionaryUpdate(this.dictionary);
      }

      this.showMessage(`词典导入成功，共 ${Object.keys(importedDict).length} 个词条`, 'success');
      
    } catch (error) {
      console.error('词典导入失败:', error);
      this.showMessage('词典导入失败: ' + error.message, 'error');
    }

    // 清空文件输入
    event.target.value = '';
  }

  readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = e => reject(new Error('文件读取失败'));
      reader.readAsText(file, 'utf-8');
    });
  }

  resetDictionary() {
    if (confirm('确定要重置词典吗？这将删除所有自定义词汇。')) {
      // 重置为默认词典
      this.dictionary = this.getDefaultDictionary();
      this.renderDictionary();
      
      if (this.onDictionaryUpdate) {
        this.onDictionaryUpdate(this.dictionary);
      }

      this.showMessage('词典已重置为默认设置', 'success');
    }
  }

  getDefaultDictionary() {
    // 返回默认的功能词词典
    return {
      // 英文强制性情态词
      'must': 'AUX_MODAL_STRONG',
      'shall': 'AUX_MODAL_STRONG',
      'have to': 'AUX_MODAL_STRONG',
      'need to': 'AUX_MODAL_STRONG',
      'required': 'AUX_MODAL_STRONG',
      'mandatory': 'AUX_MODAL_STRONG',
      
      // 英文弱情态词
      'should': 'AUX_MODAL_WEAK',
      'ought to': 'AUX_MODAL_WEAK',
      'would': 'AUX_MODAL_WEAK',
      'could': 'AUX_MODAL_WEAK',
      'recommended': 'AUX_MODAL_WEAK',
      
      // 英文许可性情态词
      'may': 'AUX_MODAL_PERMISSION',
      'might': 'AUX_MODAL_PERMISSION',
      'can': 'AUX_MODAL_PERMISSION',
      'allowed': 'AUX_MODAL_PERMISSION',
      'permitted': 'AUX_MODAL_PERMISSION',
      
      // 英文模糊副词
      'possibly': 'ADV_HEDGING',
      'probably': 'ADV_HEDGING',
      'likely': 'ADV_HEDGING',
      'perhaps': 'ADV_HEDGING',
      'maybe': 'ADV_HEDGING',
      'potentially': 'ADV_HEDGING',
      
      // 英文加强副词
      'definitely': 'ADV_INTENSIFIER',
      'certainly': 'ADV_INTENSIFIER',
      'absolutely': 'ADV_INTENSIFIER',
      'clearly': 'ADV_INTENSIFIER',
      'obviously': 'ADV_INTENSIFIER',
      'strongly': 'ADV_INTENSIFIER',
      
      // 中文强制性情态词
      '必须': 'AUX_MODAL_STRONG',
      '必需': 'AUX_MODAL_STRONG',
      '务必': 'AUX_MODAL_STRONG',
      '一定要': 'AUX_MODAL_STRONG',
      '必要': 'AUX_MODAL_STRONG',
      '强制': 'AUX_MODAL_STRONG',
      
      // 中文弱情态词
      '应该': 'AUX_MODAL_WEAK',
      '应当': 'AUX_MODAL_WEAK',
      '宜': 'AUX_MODAL_WEAK',
      '建议': 'AUX_MODAL_WEAK',
      '推荐': 'AUX_MODAL_WEAK',
      
      // 中文许可性情态词
      '可以': 'AUX_MODAL_PERMISSION',
      '能够': 'AUX_MODAL_PERMISSION',
      '可能': 'AUX_MODAL_PERMISSION',
      '允许': 'AUX_MODAL_PERMISSION',
      
      // 中文模糊副词
      '可能': 'ADV_HEDGING',
      '或许': 'ADV_HEDGING',
      '也许': 'ADV_HEDGING',
      '大概': 'ADV_HEDGING',
      '似乎': 'ADV_HEDGING',
      '看起来': 'ADV_HEDGING',
      
      // 中文加强副词
      '绝对': 'ADV_INTENSIFIER',
      '肯定': 'ADV_INTENSIFIER',
      '确实': 'ADV_INTENSIFIER',
      '明显': 'ADV_INTENSIFIER',
      '显然': 'ADV_INTENSIFIER',
      '非常': 'ADV_INTENSIFIER'
    };
  }

  showMessage(message, type = 'info') {
    // 创建消息提示
    const messageEl = document.createElement('div');
    messageEl.className = `dict-message dict-message-${type}`;
    messageEl.textContent = message;
    
    // 样式
    Object.assign(messageEl.style, {
      position: 'fixed',
      top: '20px',
      right: '20px',
      padding: '12px 20px',
      borderRadius: '6px',
      color: 'white',
      fontWeight: '500',
      zIndex: '10000',
      maxWidth: '300px',
      transform: 'translateX(100%)',
      transition: 'transform 0.3s ease'
    });

    // 设置背景色
    const colors = {
      success: '#10b981',
      error: '#ef4444',
      warning: '#f59e0b',
      info: '#3b82f6'
    };
    messageEl.style.backgroundColor = colors[type] || colors.info;

    document.body.appendChild(messageEl);

    // 显示动画
    setTimeout(() => {
      messageEl.style.transform = 'translateX(0)';
    }, 100);

    // 自动隐藏
    setTimeout(() => {
      messageEl.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (messageEl.parentNode) {
          messageEl.parentNode.removeChild(messageEl);
        }
      }, 300);
    }, 3000);
  }

  // 获取词典统计信息
  getStatistics() {
    const stats = {};
    for (const category of Object.values(this.dictionary)) {
      stats[category] = (stats[category] || 0) + 1;
    }
    return {
      total: Object.keys(this.dictionary).length,
      byCategory: stats
    };
  }
}