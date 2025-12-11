/* =========================================
   tone_analysis.js — 语气识别 + 图表模块
   ========================================= */

/* --- 功能词计数（英文 + 中文最长匹配） --- */
function countFunctionWords(text) {
    text = text
        .normalize("NFKC")
        .replace(/[\u200B\uFEFF\u00A0]/g, "")
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .trim();

    if (!text) return {};

    const stats = {};

    /* ------- 英文 token 匹配 ------- */
    const tokens = text.split(/\s+/);
    for (const tok of tokens) {
        const clean = tok.trim().toLowerCase();
        if (!clean) continue;

        const cat = FUNCTION_WORD_DICT[clean];
        if (cat) stats[cat] = (stats[cat] || 0) + 1;
    }

    /* ------- 中文词（最长匹配 + 去重） ------- */
    const chineseKeys = Object.keys(FUNCTION_WORD_DICT)
        .filter(k => /[\u4e00-\u9fa5]/.test(k))
        .sort((a, b) => b.length - a.length);

    const occupied = Array(text.length).fill(false);

    for (const phrase of chineseKeys) {
        const category = FUNCTION_WORD_DICT[phrase];
        if (!category) continue;

        const chars = phrase.split("");
        const hidden = "[\\u200B-\\u200F\\u2028\\u2029\\u2060]*";
        const safePattern = chars.join(hidden);
        const pattern = new RegExp(safePattern, "g");

        let m;
        while ((m = pattern.exec(text)) !== null) {
            const start = m.index;
            const end = pattern.lastIndex;

            let conflict = false;
            for (let i = start; i < end; i++) {
                if (occupied[i]) {
                    conflict = true;
                    break;
                }
            }
            if (conflict) continue;

            for (let i = start; i < end; i++) occupied[i] = true;

            stats[category] = (stats[category] || 0) + 1;
        }
    }

    return stats;
}

/* ------- 权重表 ------- */
const TONE_WEIGHT = {
    "AUX_MODAL_STRONG": 2,
    "AUX_MODAL_WEAK": 1,
    "AUX_MODAL_PERMISSION": 0,
    "ADV_HEDGING": -1,
    "ADV_INTENSIFIER": 1
};

/* ------- 语气得分 ------- */
function computeToneScore(stats) {
    let score = 0;
    for (const cat in stats) {
        const w = TONE_WEIGHT[cat] || 0;
        score += stats[cat] * w;
    }
    return score;
}

/* ------- 生成文字总结 ------- */
function generateToneSummary(scoreA, scoreB, statsA, statsB) {
    const diff = scoreB - scoreA;
    const direction =
        diff > 0 ? "更强硬 | Stronger tone" :
        diff < 0 ? "更缓和 | Softer tone" :
        "无明显变化 | No change";

    let summary = `语气指数 Tone Score：A=${scoreA}, B=${scoreB}\n变化 Change：${direction} (${diff})\n\n`;

    const allCats = Object.keys(TONE_WEIGHT);

    allCats.forEach(c => {
        const a = statsA[c] || 0;
        const b = statsB[c] || 0;
        const d = b - a;
        summary += `${c}: A=${a}, B=${b}, Δ=${d}\n`;
    });

    return summary;
}

/* ------- 渲染语义摘要 + 图表 ------- */
function renderSemanticAnalysis(textA, textB) {
    const panel = document.getElementById("semanticAnalysisPanel");
    if (!panel) return;

    const statsA = countFunctionWords(textA);
    const statsB = countFunctionWords(textB);

    const scoreA = computeToneScore(statsA);
    const scoreB = computeToneScore(statsB);

    const summary = generateToneSummary(scoreA, scoreB, statsA, statsB);
    panel.innerText = summary;

    renderCharts(statsA, statsB);
}

/* =========================================
   Chart.js 图表模块
   ========================================= */

let chartChangeObj = null;
let chartCompareObj = null;
let chartRadarObj = null;

/* --- 准备数据 --- */
function prepareChartData(statsA, statsB) {
    const cats = Object.keys(TONE_WEIGHT);
    const labels = cats;
    const valuesA = cats.map(c => statsA[c] || 0);
    const valuesB = cats.map(c => statsB[c] || 0);
    const diffValues = cats.map(c => (statsB[c] || 0) - (statsA[c] || 0));

    return { labels, valuesA, valuesB, diffValues };
}

/* --- 销毁旧图表 --- */
function destroyOldCharts() {
    if (chartChangeObj) chartChangeObj.destroy();
    if (chartCompareObj) chartCompareObj.destroy();
    if (chartRadarObj) chartRadarObj.destroy();
    chartChangeObj = chartCompareObj = chartRadarObj = null;
}

/* --- 图表渲染 --- */
function renderCharts(statsA, statsB) {
    destroyOldCharts();

    const data = prepareChartData(statsA, statsB);

    /* --- 图 1：语气变化条形图 --- */
    const ctx1 = document.getElementById("chartChange");
    if (ctx1) {
        chartChangeObj = new Chart(ctx1, {
            type: "bar",
            data: {
                labels: data.labels,
                datasets: [{
                    label: "变化 Δ(B - A)",
                    data: data.diffValues,
                    backgroundColor: "rgba(100,149,237,0.6)"
                }]
            },
            options: { indexAxis: 'y', responsive: true }
        });
    }

    /* --- 图 2：A vs B 柱状图 --- */
    const ctx2 = document.getElementById("chartCompare");
    if (ctx2) {
        chartCompareObj = new Chart(ctx2, {
            type: "bar",
            data: {
                labels: data.labels,
                datasets: [
                    { label: "Text A", data: data.valuesA, backgroundColor: "rgba(255,99,132,0.5)" },
                    { label: "Text B", data: data.valuesB, backgroundColor: "rgba(54,162,235,0.5)" }
                ]
            },
            options: { responsive: true }
        });
    }

    /* --- 图 3：语气雷达图 --- */
    const ctx3 = document.getElementById("chartRadar");
    if (ctx3) {
        chartRadarObj = new Chart(ctx3, {
            type: "radar",
            data: {
                labels: data.labels,
                datasets: [
                    { label: "A Tone", data: data.valuesA, backgroundColor: "rgba(255,159,64,0.3)" },
                    { label: "B Tone", data: data.valuesB, backgroundColor: "rgba(54,162,235,0.3)" }
                ]
            },
            options: { responsive: true }
        });
    }
}