// 语义分析模块
export class SemanticAnalyzer {
  constructor() {
    this.toneWeights = {
      'AUX_MODAL_STRONG': 2,
      'AUX_MODAL_WEAK': 1,
      'AUX_MODAL_PERMISSION': 0,
      'ADV_HEDGING': -1,
      'ADV_INTENSIFIER': 1
    };
    
    this.categoryNames = {
      'AUX_MODAL_STRONG': '强制性情态词',
      'AUX_MODAL_WEAK': '弱情态词',
      'AUX_MODAL_PERMISSION': '许可性情态词',
      'ADV_HEDGING': '模糊副词',
      'ADV_INTENSIFIER': '加强副词'
    };

    this.charts = {};
  }

  analyze(textA, textB, functionWordDict) {
    const statsA = this.countFunctionWords(textA, functionWordDict);
    const statsB = this.countFunctionWords(textB, functionWordDict);
    
    const scoreA = this.computeToneScore(statsA);
    const scoreB = this.computeToneScore(statsB);
    
    return {
      statsA,
      statsB,
      scoreA,
      scoreB,
      scoreDiff: scoreB - scoreA,
      summary: this.generateSummary(scoreA, scoreB, statsA, statsB)
    };
  }

  countFunctionWords(text, functionWordDict) {
    if (!text || !functionWordDict) return {};

    // 文本预处理
    text = text
      .normalize("NFKC")
      .replace(/[\u200B\uFEFF\u00A0]/g, "")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .trim();

    const stats = {};

    // 英文词汇统计（按词边界分割）
    const tokens = text.split(/\s+/);
    for (const token of tokens) {
      const cleanToken = token.trim().toLowerCase();
      if (!cleanToken) continue;

      const category = functionWordDict[cleanToken];
      if (category) {
        stats[category] = (stats[category] || 0) + 1;
      }
    }

    // 中文词汇统计（最长匹配，避免重复计数）
    const chineseWords = Object.keys(functionWordDict)
      .filter(word => /[\u4e00-\u9fa5]/.test(word))
      .sort((a, b) => b.length - a.length);

    const occupied = Array(text.length).fill(false);

    for (const phrase of chineseWords) {
      const category = functionWordDict[phrase];
      if (!category) continue;

      let index = 0;
      while ((index = text.indexOf(phrase, index)) !== -1) {
        // 检查是否与已匹配的区域重叠
        let conflict = false;
        for (let i = index; i < index + phrase.length; i++) {
          if (occupied[i]) {
            conflict = true;
            break;
          }
        }

        if (!conflict) {
          // 标记占用区域
          for (let i = index; i < index + phrase.length; i++) {
            occupied[i] = true;
          }
          
          stats[category] = (stats[category] || 0) + 1;
        }

        index += phrase.length;
      }
    }

    return stats;
  }

  computeToneScore(stats) {
    let score = 0;
    for (const [category, count] of Object.entries(stats)) {
      const weight = this.toneWeights[category] || 0;
      score += count * weight;
    }
    return score;
  }

  generateSummary(scoreA, scoreB, statsA, statsB) {
    const diff = scoreB - scoreA;
    let direction = '无明显变化';
    
    if (diff > 0) {
      direction = '语气更强硬';
    } else if (diff < 0) {
      direction = '语气更缓和';
    }

    const summary = {
      direction,
      scoreDiff: diff,
      details: []
    };

    // 生成详细变化说明
    const allCategories = new Set([
      ...Object.keys(statsA),
      ...Object.keys(statsB)
    ]);

    for (const category of allCategories) {
      const countA = statsA[category] || 0;
      const countB = statsB[category] || 0;
      const change = countB - countA;
      
      if (change !== 0) {
        summary.details.push({
          category: this.categoryNames[category] || category,
          countA,
          countB,
          change
        });
      }
    }

    return summary;
  }

  renderFunctionWordChart(ctx, analysis) {
    if (!window.Chart) return;

    // 销毁旧图表
    if (this.charts.functionWord) {
      this.charts.functionWord.destroy();
    }

    const categories = Object.keys(this.toneWeights);
    const dataA = categories.map(cat => analysis.statsA[cat] || 0);
    const dataB = categories.map(cat => analysis.statsB[cat] || 0);
    const labels = categories.map(cat => this.categoryNames[cat] || cat);

    this.charts.functionWord = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: '文本 A',
            data: dataA,
            backgroundColor: 'rgba(239, 68, 68, 0.6)',
            borderColor: 'rgba(239, 68, 68, 1)',
            borderWidth: 1
          },
          {
            label: '文本 B',
            data: dataB,
            backgroundColor: 'rgba(59, 130, 246, 0.6)',
            borderColor: 'rgba(59, 130, 246, 1)',
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top'
          },
          title: {
            display: true,
            text: '功能词分布对比'
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1
            }
          }
        }
      }
    });
  }

  renderToneRadarChart(ctx, analysis) {
    if (!window.Chart) return;

    // 销毁旧图表
    if (this.charts.radar) {
      this.charts.radar.destroy();
    }

    const categories = Object.keys(this.toneWeights);
    const dataA = categories.map(cat => analysis.statsA[cat] || 0);
    const dataB = categories.map(cat => analysis.statsB[cat] || 0);
    const labels = categories.map(cat => this.categoryNames[cat] || cat);

    this.charts.radar = new Chart(ctx, {
      type: 'radar',
      data: {
        labels,
        datasets: [
          {
            label: '文本 A',
            data: dataA,
            backgroundColor: 'rgba(239, 68, 68, 0.2)',
            borderColor: 'rgba(239, 68, 68, 1)',
            borderWidth: 2,
            pointBackgroundColor: 'rgba(239, 68, 68, 1)',
            pointBorderColor: '#fff',
            pointHoverBackgroundColor: '#fff',
            pointHoverBorderColor: 'rgba(239, 68, 68, 1)'
          },
          {
            label: '文本 B',
            data: dataB,
            backgroundColor: 'rgba(59, 130, 246, 0.2)',
            borderColor: 'rgba(59, 130, 246, 1)',
            borderWidth: 2,
            pointBackgroundColor: 'rgba(59, 130, 246, 1)',
            pointBorderColor: '#fff',
            pointHoverBackgroundColor: '#fff',
            pointHoverBorderColor: 'rgba(59, 130, 246, 1)'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top'
          },
          title: {
            display: true,
            text: '语气特征雷达图'
          }
        },
        scales: {
          r: {
            beginAtZero: true,
            ticks: {
              stepSize: 1
            }
          }
        }
      }
    });
  }

  destroyCharts() {
    Object.values(this.charts).forEach(chart => {
      if (chart && typeof chart.destroy === 'function') {
        chart.destroy();
      }
    });
    this.charts = {};
  }
}