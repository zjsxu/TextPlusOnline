/* =========================================
   dict_manager.js — 词典管理模块（纯前端版本）
   ========================================= */

// =========================================
// 自定义标注类别（用于 Mini-Doccano 标注系统）
// =========================================
var CUSTOM_CATEGORIES = [];
window.CUSTOM_CATEGORIES = CUSTOM_CATEGORIES;

try {
    const raw = localStorage.getItem("CUSTOM_CATEGORIES");
    if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            CUSTOM_CATEGORIES = parsed;
            window.CUSTOM_CATEGORIES = CUSTOM_CATEGORIES;
        } else {
            console.warn("[dict_manager] Invalid CUSTOM_CATEGORIES, clearing");
            localStorage.removeItem("CUSTOM_CATEGORIES");
        }
    }
} catch (err) {
    console.warn("[dict_manager] Failed to parse CUSTOM_CATEGORIES:", err);
    localStorage.removeItem("CUSTOM_CATEGORIES");
}

function saveCustomCategories() {
    localStorage.setItem("CUSTOM_CATEGORIES", JSON.stringify(CUSTOM_CATEGORIES));
    window.CUSTOM_CATEGORIES = CUSTOM_CATEGORIES;
    // 通知 annotator.js 更新类别菜单
    window.dispatchEvent(new Event("customCategoriesUpdated"));
}

/* 全局：FUNCTION_WORD_DICT 来自 main.js 初始化 */
/* 全局：CUSTOM_WORD_MAP 用于存储用户添加的词语（localStorage） */

/* 保存 CUSTOM_WORD_MAP */
function saveCustomWordMap() {
    localStorage.setItem("CUSTOM_WORD_MAP", JSON.stringify(CUSTOM_WORD_MAP));
}

/* 将 CUSTOM_WORD_MAP 合并到 FUNCTION_WORD_DICT */
function mergeCustomWordsIntoDict() {
    for (const [word, cat] of Object.entries(CUSTOM_WORD_MAP)) {
        FUNCTION_WORD_DICT[word] = cat;
    }
}

/* ====================================================
   词典渲染（右侧面板显示）
   ==================================================== */
function renderFunctionWordDict() {
    const box = document.getElementById("fwDictView");
    if (!box) return;

    const entries = Object.entries(FUNCTION_WORD_DICT);
    if (entries.length === 0) {
        box.innerHTML = "<p>词典为空 | Dictionary is empty.</p>";
        return;
    }

    const grouped = {};
    for (const [word, cat] of entries) {
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(word);
    }

    let html = "";
    for (const cat of Object.keys(grouped)) {
        html += `<h4>${cat}</h4><ul>`;
        for (const w of grouped[cat]) {
            html += `<li>${w} <button onclick="deleteFunctionWord('${w}')">删除</button></li>`;
        }
        html += "</ul>";
    }
    box.innerHTML = html;
}

/* ====================================================
   添加词语
   ==================================================== */
function addFunctionWord() {
    const raw = document.getElementById("fwPhraseInput").value.trim();
    const category = document.getElementById("fwCategorySelect").value;

    if (!raw) return alert("请输入词语");
    if (!category) return alert("请选择类别");

    const isEnglish = /[A-Za-z]/.test(raw);
    const key = isEnglish ? raw.toLowerCase() : raw;

    FUNCTION_WORD_DICT[key] = category;
    CUSTOM_WORD_MAP[key] = category;
    saveCustomWordMap();

    // 统计词典使用
    if (window.textDiffAnalytics) {
        window.textDiffAnalytics.trackDictionaryUsage('add_word', Object.keys(FUNCTION_WORD_DICT).length);
    }

    document.getElementById("fwPhraseInput").value = "";
    renderFunctionWordDict();
    if (typeof compareTexts === "function") {
        compareTexts();
    }
}

/* ====================================================
   删除词语
   ==================================================== */
function deleteFunctionWord(word) {
    delete FUNCTION_WORD_DICT[word];
    delete CUSTOM_WORD_MAP[word];
    saveCustomWordMap();
    renderFunctionWordDict();
    if (typeof compareTexts === "function") {
        compareTexts();
    }
}

/* ====================================================
   导出 JSON 词典
   ==================================================== */
function exportFunctionWordDict() {
    // 统计词典导出
    if (window.textDiffAnalytics) {
        window.textDiffAnalytics.trackDictionaryUsage('export', Object.keys(FUNCTION_WORD_DICT).length);
    }

    const blob = new Blob(
        [JSON.stringify(FUNCTION_WORD_DICT, null, 2)],
        { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "function_words.json";
    a.click();
    URL.revokeObjectURL(url);
}

/* ====================================================
   导入 JSON 词典
   ==================================================== */
function importFunctionWordDict(fileInput) {
    const file = fileInput.files[0];
    if (!file) return alert("请选择文件");

    const reader = new FileReader();
    reader.onload = e => {
        try {
            const importedDict = JSON.parse(e.target.result);
            FUNCTION_WORD_DICT = { ...FUNCTION_WORD_DICT, ...importedDict };
            mergeCustomWordsIntoDict();
            
            // 统计词典导入
            if (window.textDiffAnalytics) {
                window.textDiffAnalytics.trackDictionaryUsage('import', Object.keys(importedDict).length);
            }
            
            renderFunctionWordDict();
            if (typeof compareTexts === "function") {
                compareTexts();
            }
            alert(`导入成功，共导入 ${Object.keys(importedDict).length} 个词条`);
        } catch {
            alert("JSON 格式错误");
        }
    };
    reader.readAsText(file);
}

/* ====================================================
   导入 doccano JSONL
   ==================================================== */
function importDoccanoJSONL(fileInput) {
    const file = fileInput.files[0];
    if (!file) return alert("请选择 JSONL 文件");

    const reader = new FileReader();
    reader.onload = e => {
        const lines = e.target.result.split("\n").filter(x => x.trim());
        let newEntries = {};

        for (const line of lines) {
            try {
                const obj = JSON.parse(line);
                const text = obj.text || "";
                const labels = obj.labels || [];

                for (const lbl of labels) {
                    const start = lbl[0];
                    const end = lbl[1];
                    const cat = lbl[2];
                    const phrase = text.slice(start, end);

                    if (phrase && !FUNCTION_WORD_DICT[phrase]) {
                        newEntries[phrase] = cat;
                    }
                }
            } catch (err) {
                console.error("解析失败:", line, err);
            }
        }

        FUNCTION_WORD_DICT = { ...FUNCTION_WORD_DICT, ...newEntries };
        renderFunctionWordDict();
        if (typeof compareTexts === "function") {
            compareTexts();
        }

        alert(`导入成功，共新增 ${Object.keys(newEntries).length} 个词条`);
    };

    reader.readAsText(file);
}

/* ====================================================
   添加自定义标注类别（严格匹配 index.html）
   ==================================================== */
function addCustomCategory() {
    console.log("[dict_manager] addCustomCategory() CALLED");

    const nameInput  = document.getElementById("customLabelName");
    const codeInput  = document.getElementById("customLabelCode");
    const colorInput = document.getElementById("customLabelColor");

    if (!nameInput || !codeInput || !colorInput) {
        console.error("[dict_manager] Missing category input fields");
        alert("内部错误：找不到自定义类别输入框");
        return;
    }

    const name  = nameInput.value.trim();
    const code  = codeInput.value.trim().toUpperCase();
    const color = colorInput.value.trim();

    if (!name) return alert("请输入类别显示名称");
    if (!code) return alert("请输入类别编码（英文大写/数字/下划线）");
    if (!/^[A-Z0-9_]+$/.test(code)) return alert("类别编码格式不合法");
    if (!color) return alert("请选择高亮颜色");

    if (CUSTOM_CATEGORIES.some(c => c.code === code)) {
        return alert("类别编码已存在");
    }

    const newCat = { label: name, code: code, color: color };
    console.log("[dict_manager] 新增类别 →", newCat);

    CUSTOM_CATEGORIES.push(newCat);
    saveCustomCategories();

    if (typeof injectCustomCategoryCSS === "function") injectCustomCategoryCSS();
    if (typeof renderCustomCategoryList === "function") renderCustomCategoryList();

    nameInput.value = "";
    codeInput.value = "";
    colorInput.value = "#ffe599";

    alert("已成功添加类别：" + code);
    // 再次广播，确保 annotator.js 捕捉到类别更新
    window.dispatchEvent(new Event("customCategoriesUpdated"));
}

/* 兼容旧版名称 */
function addCustomLabel() {
    return addCustomCategory();
}

/* ====================================================
   渲染类别列表（在词典管理面板底部）
   ==================================================== */
function renderCustomCategoryList() {
    const box = document.getElementById("customCategoryList");
    if (!box) return;

    if (CUSTOM_CATEGORIES.length === 0) {
        box.innerHTML = "<p>尚无自定义类别。</p>";
        return;
    }

    let html = "<ul>";
    for (const cat of CUSTOM_CATEGORIES) {
        html += `<li><b>${cat.code}</b> — ${cat.label} &nbsp; <span style="background:${cat.color};padding:2px 6px;border-radius:4px;">示例</span></li>`;
    }
    html += "</ul>";

    box.innerHTML = html;
}

/* ====================================================
   注入 CSS，使 .user-annotation-CODE 生效
   ==================================================== */
function injectCustomCategoryCSS() {
    let styleTag = document.getElementById("customCategoryStyles");
    if (!styleTag) {
        styleTag = document.createElement("style");
        styleTag.id = "customCategoryStyles";
        document.head.appendChild(styleTag);
    }

    let cssText = "";
    for (const cat of CUSTOM_CATEGORIES) {
        cssText += `.user-annotation-${cat.code} { background-color: ${cat.color} !important; }
        `;
    }

    styleTag.innerHTML = cssText;
}

// 页面加载时恢复类别
window.addEventListener("DOMContentLoaded", () => {
    injectCustomCategoryCSS();
    renderCustomCategoryList();
    window.dispatchEvent(new Event("customCategoriesUpdated"));
});

/* ====================================================
   恢复默认词典
   ==================================================== */
function resetToDefaultDict() {
    if (typeof getDefaultDictionary === "function") {
        FUNCTION_WORD_DICT = getDefaultDictionary();
        mergeCustomWordsIntoDict();
        renderFunctionWordDict();
        if (typeof compareTexts === "function") {
            compareTexts();
        }
        alert("已恢复默认词典");
    }
}