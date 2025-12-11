// 文本对比引擎
export class DiffEngine {
  constructor() {
    this.dmp = null;
    this.initDiffMatchPatch();
  }

  initDiffMatchPatch() {
    if (typeof diff_match_patch !== 'undefined') {
      this.dmp = new diff_match_patch();
      this.dmp.Match_EditCost = 0;
    } else {
      console.error('diff_match_patch 库未加载');
    }
  }

  compare(textA, textB, functionWordDict = {}) {
    if (!this.dmp) {
      throw new Error('diff_match_patch 库未初始化');
    }

    const diffs = this.dmp.diff_main(textA, textB);
    this.dmp.diff_cleanupSemantic(diffs);

    return this.renderSideBySide(diffs, functionWordDict);
  }

  renderSideBySide(diffs, functionWordDict) {
    let html = ['<div class="side-by-side-container"><table class="diff-table">'];
    
    let pointerA = 1;
    let pointerB = 1;
    let sideA = [];
    let sideB = [];

    const outputRow = () => {
      if (sideA.length > 0 || sideB.length > 0) {
        const maxLength = Math.max(sideA.length, sideB.length);
        
        // 填充较短的一侧
        while (sideA.length < maxLength) {
          sideA.push('<span class="diff-spacer">&nbsp;</span>');
        }
        while (sideB.length < maxLength) {
          sideB.push('<span class="diff-spacer">&nbsp;</span>');
        }
        
        // 输出行
        for (let i = 0; i < maxLength; i++) {
          const isAddition = sideA[i].includes('diff-spacer');
          const isDeletion = sideB[i].includes('diff-spacer');
          const rowClass = isAddition ? 'diff-added' : (isDeletion ? 'diff-removed' : '');
          
          html.push(`<tr class="${rowClass}">`);
          
          // A 侧行号和内容
          html.push(`<td class="line-num-A">${isDeletion ? pointerA++ : (isAddition ? "" : pointerA++)}</td>`);
          html.push(`<td class="line-content-A">${sideA[i]}</td>`);

          // B 侧行号和内容
          html.push(`<td class="line-num-B">${isAddition ? pointerB++ : (isDeletion ? "" : pointerB++)}</td>`);
          html.push(`<td class="line-content-B">${sideB[i]}</td>`);
          
          html.push("</tr>");
        }
      }
      sideA = [];
      sideB = [];
    };

    // 处理 diff 结果
    for (let x = 0; x < diffs.length; x++) {
      const op = diffs[x][0];
      const data = diffs[x][1];

      let lines = data.split("\n");
      if (lines.length === 1) {
        lines = [lines[0], ""];
      }

      const lineCount = lines.length - 1;

      for (let i = 0; i < lineCount; i++) {
        const line = lines[i];

        if (op === 0) { // 相等
          outputRow();
          html.push("<tr>");
          html.push(`<td class="line-num-A">${pointerA++}</td>`);
          html.push(`<td class="line-content-A">${this.highlightFunctionWords(line, functionWordDict)}</td>`);
          html.push(`<td class="line-num-B">${pointerB++}</td>`);
          html.push(`<td class="line-content-B">${this.highlightFunctionWords(line, functionWordDict)}</td>`);
          html.push("</tr>");

        } else if (op === 1) { // 插入
          sideB.push(`<ins>${this.highlightFunctionWords(line, functionWordDict)}</ins>`);

        } else if (op === -1) { // 删除
          sideA.push(`<del>${this.highlightFunctionWords(line, functionWordDict)}</del>`);
        }
      }
    }

    outputRow();
    html.push("</table></div>");
    return html.join("");
  }

  highlightFunctionWords(text, functionWordDict) {
    if (!functionWordDict || Object.keys(functionWordDict).length === 0) {
      return this.escapeHtml(text);
    }

    let result = this.escapeHtml(text);

    // 英文词汇匹配（按词边界）
    const englishWords = Object.keys(functionWordDict).filter(word => 
      /^[a-zA-Z]/.test(word)
    );

    for (const word of englishWords) {
      const category = functionWordDict[word];
      const regex = new RegExp(`\\b${this.escapeRegex(word)}\\b`, 'gi');
      result = result.replace(regex, match => 
        `<span class="fw-${category}">${match}</span>`
      );
    }

    // 中文词汇匹配（最长匹配，避免重叠）
    const chineseWords = Object.keys(functionWordDict)
      .filter(word => /[\u4e00-\u9fa5]/.test(word))
      .sort((a, b) => b.length - a.length);

    const occupied = Array(result.length).fill(false);

    for (const phrase of chineseWords) {
      const category = functionWordDict[phrase];
      if (!category) continue;

      let index = 0;
      while ((index = result.indexOf(phrase, index)) !== -1) {
        // 检查是否与已标记的区域重叠
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

          // 替换文本
          const before = result.substring(0, index);
          const after = result.substring(index + phrase.length);
          result = before + `<span class="fw-${category}">${phrase}</span>` + after;
          
          // 更新占用数组长度
          const newLength = result.length;
          const lengthDiff = newLength - occupied.length;
          if (lengthDiff > 0) {
            occupied.splice(index + phrase.length, 0, ...Array(lengthDiff).fill(true));
          }
        }

        index += phrase.length;
      }
    }

    return result;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // 统一视图渲染（可选功能）
  renderUnified(diffs, functionWordDict) {
    let html = ['<div class="unified-diff">'];
    
    for (let x = 0; x < diffs.length; x++) {
      const op = diffs[x][0];
      const data = diffs[x][1];
      
      let className = '';
      let prefix = '';
      
      switch (op) {
        case -1: // 删除
          className = 'diff-removed';
          prefix = '- ';
          break;
        case 1: // 插入
          className = 'diff-added';
          prefix = '+ ';
          break;
        case 0: // 相等
          className = '';
          prefix = '  ';
          break;
      }

      const lines = data.split('\n');
      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i];
        const highlightedLine = this.highlightFunctionWords(line, functionWordDict);
        html.push(`<div class="diff-line ${className}">${prefix}${highlightedLine}</div>`);
      }
    }
    
    html.push('</div>');
    return html.join('');
  }
}