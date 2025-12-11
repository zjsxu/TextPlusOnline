/* =========================================
   main.js — 项目入口模块
   ========================================= */

/* 全局词典 */
let FUNCTION_WORD_DICT = {};
let CUSTOM_WORD_MAP = JSON.parse(localStorage.getItem("CUSTOM_WORD_MAP") || "{}");

/* 保存 custom-map */
function saveCustomWordMap() {
    localStorage.setItem("CUSTOM_WORD_MAP", JSON.stringify(CUSTOM_WORD_MAP));
}

/* 将自定义词加入总词典 */
function mergeCustomWordsIntoDict() {
    for (const [word, cat] of Object.entries(CUSTOM_WORD_MAP)) {
        FUNCTION_WORD_DICT[word] = cat;
    }
}

/* 加载词典（纯前端版本） */
function loadFunctionWordDict() {
    return new Promise((resolve) => {
        // 使用默认词典
        FUNCTION_WORD_DICT = getDefaultDictionary();
        mergeCustomWordsIntoDict();
        console.log("词典已加载：", FUNCTION_WORD_DICT);
        resolve();
    });
}

/* 默认词典 */
function getDefaultDictionary() {
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

/* =========================================
   文件上传 + 文本提取（纯前端版本）
   ========================================= */
function uploadFile(target) {
    const fileInput = document.getElementById(`file${target}`);
    const file = fileInput.files[0];
    const textarea = document.getElementById(`text${target}`);
    
    if (!file) return;

    // 统计文件上传
    if (window.textDiffAnalytics) {
        window.textDiffAnalytics.trackFileUpload(file.type || 'unknown', file.size);
    }
    
    textarea.value = `正在提取文件 [${file.name}] 中的文本，请稍候...`;

    // 根据文件类型处理
    if (file.type === 'application/pdf') {
        extractPDFText(file, target);
    } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        extractDocxText(file, target);
    } else if (file.type === 'text/plain') {
        extractTxtText(file, target);
    } else {
        textarea.value = `不支持的文件类型: ${file.type}。请上传 PDF、TXT 或 DOCX 文件。`;
    }
}

/* PDF文本提取 */
function extractPDFText(file, target) {
    const textarea = document.getElementById(`text${target}`);
    
    const fileReader = new FileReader();
    fileReader.onload = function() {
        const typedarray = new Uint8Array(this.result);
        
        pdfjsLib.getDocument(typedarray).promise.then(function(pdf) {
            let textContent = '';
            const numPages = pdf.numPages;
            let pagesProcessed = 0;
            
            for (let i = 1; i <= numPages; i++) {
                pdf.getPage(i).then(function(page) {
                    page.getTextContent().then(function(content) {
                        const pageText = content.items.map(item => item.str).join(' ');
                        textContent += pageText + '\n';
                        pagesProcessed++;
                        
                        if (pagesProcessed === numPages) {
                            textarea.value = textContent.trim();
                        }
                    });
                });
            }
        }).catch(function(error) {
            console.error('PDF解析错误:', error);
            textarea.value = `PDF文件解析失败: ${error.message}`;
        });
    };
    
    fileReader.readAsArrayBuffer(file);
}

/* DOCX文本提取 */
function extractDocxText(file, target) {
    const textarea = document.getElementById(`text${target}`);
    
    const fileReader = new FileReader();
    fileReader.onload = function() {
        mammoth.extractRawText({arrayBuffer: this.result})
            .then(function(result) {
                textarea.value = result.value;
            })
            .catch(function(error) {
                console.error('DOCX解析错误:', error);
                textarea.value = `DOCX文件解析失败: ${error.message}`;
            });
    };
    
    fileReader.readAsArrayBuffer(file);
}

/* TXT文本提取 */
function extractTxtText(file, target) {
    const textarea = document.getElementById(`text${target}`);
    
    const fileReader = new FileReader();
    fileReader.onload = function() {
        textarea.value = this.result;
    };
    
    fileReader.readAsText(file, 'UTF-8');
}

/* 页面初始动作 */
window.addEventListener("DOMContentLoaded", () => {
    console.log("系统初始化中……");

    // 加载词典
    loadFunctionWordDict().then(() => {
        if (typeof renderFunctionWordDict === "function") {
            renderFunctionWordDict();
        }
    });

    // 主题加载
    const mode = localStorage.getItem("themeMode") || "default";
    if (typeof applyTheme === "function") {
        applyTheme(mode);
    }

    console.log("初始化完成。");
});