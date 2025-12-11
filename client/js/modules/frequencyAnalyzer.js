// 词频分析模块
export class FrequencyAnalyzer {
  constructor() {
    this.chart = null;
    
    // 常用停用词列表
    this.stopWords = new Set([
      // 英文停用词
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
      'will', 'would', 'could', 'should', 'may', 'might', 'can', 'shall', 'must',
      'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
      'my', 'your', 'his', 'her', 'its', 'our', 'their', 'this', 'that', 'these', 'those',
      'not', 'no', 'yes', 'all', 'any', 'some', 'each', 'every', 'other', 'another',
      'more', 'most', 'less', 'much', 'many', 'few', 'little', 'big', 'small', 'large',
      'good', 'bad', 'new', 'old', 'first', 'last', 'long', 'short', 'high', 'low',
      'here', 'there', 'where', 'when', 'why', 'how', 'what', 'who', 'which',
      'up', 'down', 'out', 'off', 'over', 'under', 'again', 'further', 'then', 'once',
      
      // 中文停用词
      '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '一个', '上', '也', '很',
      '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好', '自己', '这', '那', '里', '就是',
      '他', '时候', '过', '下', '可以', '出', '比', '还', '把', '什么', '对', '没', '来', '以', '个',
      '中', '大', '为', '能', '多', '然后', '现在', '所以', '因为', '这个', '那个', '这样', '那样',
      '但是', '如果', '虽然', '因此', '所以', '然而', '不过', '而且', '或者', '以及', '以后', '以前'
    ]);
  }

  analyze(textA, textB, options = {}) {
    const { excludeCommon = true, topCount = 20 } = options;
    
    const wordsA = this.extractWords(textA, excludeCommon);
    const wordsB = this.extractWords(textB, excludeCommon);
    
    const freqA = this.calculateFrequency(wordsA, topCount);
    const freqB = this.calculateFrequency(wordsB, topCount);
    
    return {
      freqA,
      freqB,
      comparison: this.compareFrequencies(freqA, freqB)
    };
  }

  extractWords(text, excludeCommon = true) {
    if (!text) return [];

    // 文本预处理
    text = text
      .toLowerCase()
      .replace(/[^\u4e00-\u9fa5a-zA-Z\s]/g, ' ') // 保留中英文和空格
      .replace(/\s+/g, ' ')
      .trim();

    let words = [];

    // 英文单词提取
    const englishWords = text.match(/[a-zA-Z]+/g) || [];
    words.push(...englishWords);

    // 中文分词（简单实现，按字符分割）
    const chineseText = text.replace(/[a-zA-Z\s]/g, '');
    if (chineseText) {
      // 简单的中文分词：提取2-4字的词组
      for (let len = 4; len >= 2; len--) {
        for (let i = 0; i <= chineseText.length - len; i++) {
          const word = chineseText.substr(i, len);
          if (this.isValidChineseWord(word)) {
            words.push(word);
          }
        }
      }
      
      // 单字也加入（如果不是停用词）
      for (const char of chineseText) {
        if (this.isValidChineseWord(char)) {
          words.push(char);
        }
      }
    }

    // 过滤停用词
    if (excludeCommon) {
      words = words.filter(word => 
        word.length > 1 && 
        !this.stopWords.has(word) &&
        !this.isCommonWord(word)
      );
    }

    return words;
  }

  isValidChineseWord(word) {
    // 检查是否为有效的中文词
    return /^[\u4e00-\u9fa5]+$/.test(word) && 
           !this.stopWords.has(word) &&
           word.length <= 4; // 限制最大长度
  }

  isCommonWord(word) {
    // 额外的常用词过滤
    const commonPatterns = [
      /^\d+$/, // 纯数字
      /^[a-z]{1,2}$/, // 1-2个字母
      /^(am|pm|etc|vs|ie|eg)$/i // 常见缩写
    ];
    
    return commonPatterns.some(pattern => pattern.test(word));
  }

  calculateFrequency(words, topCount) {
    const frequency = {};
    
    // 统计词频
    for (const word of words) {
      frequency[word] = (frequency[word] || 0) + 1;
    }
    
    // 排序并取前N个
    return Object.entries(frequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, topCount);
  }

  compareFrequencies(freqA, freqB) {
    const comparison = [];
    const wordsA = new Map(freqA);
    const wordsB = new Map(freqB);
    
    // 获取所有词汇
    const allWords = new Set([
      ...wordsA.keys(),
      ...wordsB.keys()
    ]);
    
    for (const word of allWords) {
      const countA = wordsA.get(word) || 0;
      const countB = wordsB.get(word) || 0;
      const diff = countB - countA;
      
      if (Math.abs(diff) > 0) {
        comparison.push({
          word,
          countA,
          countB,
          diff,
          change: diff > 0 ? 'increase' : 'decrease'
        });
      }
    }
    
    // 按差异绝对值排序
    return comparison.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  }

  renderChart(ctx, analysis) {
    if (!window.Chart) return;

    // 销毁旧图表
    if (this.chart) {
      this.chart.destroy();
    }

    // 取前10个变化最大的词
    const topChanges = analysis.comparison.slice(0, 10);
    
    if (topChanges.length === 0) {
      ctx.getContext('2d').clearRect(0, 0, ctx.width, ctx.height);
      return;
    }

    const labels = topChanges.map(item => item.word);
    const changes = topChanges.map(item => item.diff);
    
    // 根据变化方向设置颜色
    const backgroundColors = changes.map(change => 
      change > 0 ? 'rgba(16, 185, 129, 0.6)' : 'rgba(239, 68, 68, 0.6)'
    );
    const borderColors = changes.map(change => 
      change > 0 ? 'rgba(16, 185, 129, 1)' : 'rgba(239, 68, 68, 1)'
    );

    this.chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: '词频变化 (B - A)',
          data: changes,
          backgroundColor: backgroundColors,
          borderColor: borderColors,
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y', // 水平条形图
        plugins: {
          legend: {
            display: false
          },
          title: {
            display: true,
            text: '词频变化对比 (前10个变化最大的词)'
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const item = topChanges[context.dataIndex];
                return [
                  `文本A: ${item.countA}次`,
                  `文本B: ${item.countB}次`,
                  `变化: ${item.diff > 0 ? '+' : ''}${item.diff}`
                ];
              }
            }
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            title: {
              display: true,
              text: '频次变化'
            }
          },
          y: {
            title: {
              display: true,
              text: '词汇'
            }
          }
        }
      }
    });
  }

  destroyChart() {
    if (this.chart && typeof this.chart.destroy === 'function') {
      this.chart.destroy();
      this.chart = null;
    }
  }

  // 导出词频数据
  exportFrequencyData(analysis) {
    return {
      timestamp: new Date().toISOString(),
      textA: {
        topWords: analysis.freqA,
        totalUniqueWords: analysis.freqA.length
      },
      textB: {
        topWords: analysis.freqB,
        totalUniqueWords: analysis.freqB.length
      },
      comparison: analysis.comparison
    };
  }
}