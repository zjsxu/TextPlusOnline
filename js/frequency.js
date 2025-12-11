/* =========================================
   frequency.js — 词频分析模块
   ========================================= */

/* 英文 token 化 */
function tokenizeEnglish(text) {
    return text
        .toLowerCase()
        .split(/[^a-zA-Z0-9]+/)
        .filter(t => t.length > 1);
}

/* 中文 token 化 */
function tokenizeChinese(text) {
    return text
        .replace(/[\s\r\n]+/g, "")
        .split("")
        .filter(t => /[\u4e00-\u9fa5]/.test(t));
}

/* 统计频率 */
function countFreq(tokens) {
    const freq = {};
    for (const t of tokens) {
        freq[t] = (freq[t] || 0) + 1;
    }
    return Object.entries(freq).sort((a, b) => b[1] - a[1]);
}

/* 渲染静态表格 */
function renderFreqTable(targetId, freqList, topN = 20) {
    const box = document.getElementById(targetId);
    if (!box) return;

    if (!freqList || freqList.length === 0) {
        box.innerHTML = "<p>无数据 | No Data</p>";
        return;
    }

    const rows = freqList
        .slice(0, topN)
        .map(([w, c]) => `<tr><td>${w}</td><td>${c}</td></tr>`)
        .join("");

    box.innerHTML = `
        <table border="1" cellpadding="5" width="100%">
            <tr><th>词语 | Word</th><th>频次 | Count</th></tr>
            ${rows}
        </table>
    `;
}

/* 高频词差异图表对象 */
let freqChartObj = null;

/* 运行词频分析 */
function runFrequencyAnalysis() {
    const textA = document.getElementById("textA").value;
    const textB = document.getElementById("textB").value;

    const tokensA = tokenizeEnglish(textA).concat(tokenizeChinese(textA));
    const tokensB = tokenizeEnglish(textB).concat(tokenizeChinese(textB));

    const freqA = countFreq(tokensA);
    const freqB = countFreq(tokensB);

    // 统计词频分析
    if (window.textDiffAnalytics) {
        window.textDiffAnalytics.trackFrequencyAnalysis(tokensA.length, tokensB.length);
    }

    renderFreqTable("freqTableA", freqA);
    renderFreqTable("freqTableB", freqB);

    const topWords = [
        ...new Set(
            freqA.slice(0, 20).map(x => x[0]).concat(freqB.slice(0, 20).map(x => x[0]))
        )
    ];

    const valsA = topWords.map(w => (freqA.find(x => x[0] === w)?.[1] || 0));
    const valsB = topWords.map(w => (freqB.find(x => x[0] === w)?.[1] || 0));

    if (freqChartObj) freqChartObj.destroy();

    const ctx = document.getElementById("freqChart");
    if (!ctx || typeof Chart === 'undefined') return;

    freqChartObj = new Chart(ctx, {
        type: "bar",
        data: {
            labels: topWords,
            datasets: [
                { label: "Text A", data: valsA, backgroundColor: "rgba(255,99,132,0.5)" },
                { label: "Text B", data: valsB, backgroundColor: "rgba(54,162,235,0.5)" },
            ]
        },
        options: {
            responsive: true,
            scales: { y: { beginAtZero: true } }
        }
    });
}