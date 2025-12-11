/* =========================================
   diff_core.js — 文本对比核心模块
   ========================================= */

// 功能词高亮（英文 token + 中文短语）
function highlightFunctionWordsInLine(line) {
    if (!FUNCTION_WORD_DICT || Object.keys(FUNCTION_WORD_DICT).length === 0) {
        return line;
    }

    const tokens = line.split(/(\s+)/);
    let processed = tokens.map(tok => {
        const trimmed = tok.trim();
        if (trimmed === "") return tok;
        const cleanTok = trimmed.toLowerCase();
        const category = FUNCTION_WORD_DICT[cleanTok] || CUSTOM_WORD_MAP[cleanTok];
        if (category) {
            return `<span class="fw-${category}">${tok}</span>`;
        }
        return tok;
    }).join("");

    const chineseKeys = Object.keys(FUNCTION_WORD_DICT)
        .filter(k => /[\u4e00-\u9fa5]/.test(k))
        .sort((a, b) => b.length - a.length);

    let result = processed;

    for (const phrase of chineseKeys) {
        const category = FUNCTION_WORD_DICT[phrase];
        if (!category) continue;
        const pattern = new RegExp(phrase, "g");
        result = result.replace(pattern, match => {
            return `<span class="fw-${category}">${match}</span>`;
        });
    }

    return result;
}


/* =========================================
   并排对比渲染 diff_prettySideBySide()
   ========================================= */

function diff_prettySideBySide(diffs) {
    let html = ['<table class="diff-table">'];
    
    let pointerA = 1;
    let pointerB = 1;
    
    let sideA = [];
    let sideB = [];

    const outputRow = () => {
        if (sideA.length > 0 || sideB.length > 0) {
            const maxLength = Math.max(sideA.length, sideB.length);
            while (sideA.length < maxLength) sideA.push('<span class="diff-spacer">&nbsp;</span>');
            while (sideB.length < maxLength) sideB.push('<span class="diff-spacer">&nbsp;</span>');
            
            for (let i = 0; i < maxLength; i++) {
                const isAddition = sideA[i].includes('diff-spacer');
                const isDeletion = sideB[i].includes('diff-spacer');
                const rowClass = isAddition ? 'diff-added' : (isDeletion ? 'diff-removed' : '');
                
                html.push(`<tr class="${rowClass}">`);
                
                html.push(`<td class="line-num-A">${isDeletion ? pointerA++ : (isAddition ? "" : pointerA++)}</td>`);
                html.push(`<td class="line-content-A">${sideA[i]}</td>`);

                html.push(`<td class="line-num-B">${isAddition ? pointerB++ : (isDeletion ? "" : pointerB++)}</td>`);
                html.push(`<td class="line-content-B">${sideB[i]}</td>`);
                
                html.push("</tr>");
            }
        }
        sideA = [];
        sideB = [];
    };

    for (let x = 0; x < diffs.length; x++) {
        const op = diffs[x][0];
        const data = diffs[x][1];

        let lines = data.split("\n");
        if (lines.length === 1) lines = [lines[0], ""];

        const lineCount = lines.length - 1;

        for (let i = 0; i < lineCount; i++) {
            const line = lines[i];

            if (op === 0) {
                outputRow();
                html.push("<tr>");
                html.push(`<td class="line-num-A">${pointerA++}</td>`);
                html.push(`<td class="line-content-A">${highlightFunctionWordsInLine(line)}</td>`);
                html.push(`<td class="line-num-B">${pointerB++}</td>`);
                html.push(`<td class="line-content-B">${highlightFunctionWordsInLine(line)}</td>`);
                html.push("</tr>");

            } else if (op === 1) {
                sideB.push(`<ins>${highlightFunctionWordsInLine(line)}</ins>`);

            } else if (op === -1) {
                sideA.push(`<del>${highlightFunctionWordsInLine(line)}</del>`);
            }
        }
    }

    outputRow();
    html.push("</table>");
    return html.join("");
}


/* =========================================
   compareTexts — 文本对比入口函数
   ========================================= */

function compareTexts() {
    const textA = document.getElementById('textA').value;
    const textB = document.getElementById('textB').value;
    const outputDiv = document.getElementById('diffOutput');

    if (!textA && !textB) {
        outputDiv.innerHTML = '<p style="color:red;">请在至少一个文本框中粘贴文本。</p>';
        return;
    }

    if (typeof diff_match_patch === 'undefined') {
        outputDiv.innerHTML = '<p style="color:red;">diff_match_patch 未加载。</p>';
        return;
    }

    const dmp = new diff_match_patch();
    dmp.Match_EditCost = 0;

    const diffs = dmp.diff_main(textA, textB);
    dmp.diff_cleanupSemantic(diffs);

    const htmlOutput = diff_prettySideBySide(diffs);
    outputDiv.innerHTML = `<div class="side-by-side-container">${htmlOutput}</div>`;

    if (typeof renderSemanticAnalysis === "function") {
        renderSemanticAnalysis(textA, textB);
    }
    if (typeof runFrequencyAnalysis === "function") {
        runFrequencyAnalysis();
    }
}