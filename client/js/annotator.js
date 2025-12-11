window.CUSTOM_CATEGORIES = window.CUSTOM_CATEGORIES || [];
/* =========================================
   annotator.js — 自定义标注模块（Mini-Doccano）
   ========================================= */

// 当前选中范围与文本
let CURRENT_SELECTED_RANGE = null;
let CURRENT_SELECTION_TEXT = "";

// 获取浮动菜单元素
function getSelectionMenu() {
    return document.getElementById('selectionMenu');
}

// 处理文本选中事件（绑定在 diffOutput 上）
function handleTextSelection(event) {
    const diffArea = document.getElementById('diffOutput');
    const menu = getSelectionMenu();
    if (!diffArea || !menu) return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
        hideSelectionMenu();
        return;
    }

    const range = selection.getRangeAt(0);

    // 仅在 diffOutput 中的选区才触发标注
    if (!diffArea.contains(range.commonAncestorContainer)) {
        hideSelectionMenu();
        return;
    }

    const text = selection.toString().trim();
    if (!text) {
        hideSelectionMenu();
        return;
    }

    CURRENT_SELECTED_RANGE = range.cloneRange();
    CURRENT_SELECTION_TEXT = text;

    // 构建菜单按钮
    buildSelectionMenuButtons(menu);

    // 将菜单显示在鼠标附近
    const x = event.clientX + window.scrollX;
    const y = event.clientY + window.scrollY;
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    menu.style.display = 'block';
}

function hideSelectionMenu() {
    const menu = getSelectionMenu();
    if (menu) {
        menu.style.display = 'none';
    }
}

// 根据自定义类别构建菜单按钮
function buildSelectionMenuButtons(menu) {
    // 清空原内容
    menu.innerHTML = '';

    const title = document.createElement('div');
    title.textContent = '选择标签 / Pick Label:';
    menu.appendChild(title);

    // 如果全局存在 CUSTOM_CATEGORIES（例如 [{code, label}]），则优先使用
    let categories = [];

    // 使用 window 确保不丢失全局变量
    // 正确读取所有自定义类别
    categories = Array.isArray(window.CUSTOM_CATEGORIES)
        ? [...window.CUSTOM_CATEGORIES]
        : [];

    // 系统内置 5 类（功能词类别）
    const builtinCats = [
        { code: 'AUX_MODAL_STRONG', label: '强制性 Strong' },
        { code: 'AUX_MODAL_WEAK', label: '弱情态 Weak' },
        { code: 'AUX_MODAL_PERMISSION', label: '许可 Permission' },
        { code: 'ADV_HEDGING', label: '模糊 Hedging' },
        { code: 'ADV_INTENSIFIER', label: '强调 Intensifier' }
    ];

    // 避免覆盖用户类别，将两者分开加入
    let finalCats = [...builtinCats, ...categories];

    finalCats.forEach(cat => {
        const btn = document.createElement('button');
        btn.textContent = cat.label || cat.code;
        btn.style.margin = '2px';
        btn.addEventListener('click', () => {
            applySelectionLabel(cat.code || 'CUSTOM');
        });
        menu.appendChild(btn);
    });

    // 始终提供独立 CUSTOM 选项
    const customBtn = document.createElement('button');
    customBtn.textContent = '自定义标注 / Custom';
    customBtn.style.margin = '2px';
    customBtn.onclick = () => applySelectionLabel('CUSTOM');
    menu.appendChild(customBtn);

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = '取消 / Cancel';
    cancelBtn.style.marginLeft = '4px';
    cancelBtn.addEventListener('click', () => {
        hideSelectionMenu();
        window.getSelection().removeAllRanges();
    });
    menu.appendChild(cancelBtn);
}

// 将选中的文本包裹为带类别信息的 span
function applySelectionLabel(categoryCode) {
    if (!CURRENT_SELECTED_RANGE) {
        hideSelectionMenu();
        return;
    }

    const selectedText = CURRENT_SELECTION_TEXT;
    if (!selectedText) {
        hideSelectionMenu();
        return;
    }

    // 取得 diffOutput HTML
    const root = document.getElementById('diffOutput');
    if (!root) return;

    const esc = selectedText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // ---- 2. 使用 TreeWalker 仅替换文本节点，避免破坏 HTML ----
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);

    // 内置 5 类使用 fw-* 颜色，自定义类别使用 user-annotation-*
    const builtinSet = new Set([
        'AUX_MODAL_STRONG',
        'AUX_MODAL_WEAK',
        'AUX_MODAL_PERMISSION',
        'ADV_HEDGING',
        'ADV_INTENSIFIER'
    ]);
    const isBuiltin = builtinSet.has(categoryCode);
    const spanClass = isBuiltin
        ? `fw-${categoryCode} user-annotation user-annotation-${categoryCode}`
        : `user-annotation user-annotation-${categoryCode}`;

    const wrapHTML = (txt) => `<span class="${spanClass}" data-annotation="${categoryCode}">${txt}</span>`;

    const regex = new RegExp(esc, 'g');
    const textNodes = [];

    while (walker.nextNode()) {
        textNodes.push(walker.currentNode);
    }

    textNodes.forEach(node => {
        if (!node.nodeValue || !regex.test(node.nodeValue)) return;

        const temp = document.createElement('span');
        temp.innerHTML = node.nodeValue.replace(regex, wrapHTML);

        while (temp.firstChild) {
            node.parentNode.insertBefore(temp.firstChild, node);
        }
        node.parentNode.removeChild(node);
    });

    // ---- 1. 记录原词（保持中文/英文大小写）----
    // 原词保持中文，英文统一转小写
    const key = /^[A-Za-z]+$/.test(selectedText) ? selectedText.toLowerCase() : selectedText;

    // ---- 写回词典（使用与 dict_manager.js 相同的全局 FUNCTION_WORD_DICT） ----
    if (typeof FUNCTION_WORD_DICT === 'object') {
        FUNCTION_WORD_DICT[key] = categoryCode;

        // 强制通知词典管理模块刷新
        if (typeof renderFunctionWordDict === 'function') {
            renderFunctionWordDict();
        }

        // 持久化保存
        if (typeof saveCustomWordMap === 'function') {
            CUSTOM_WORD_MAP[key] = categoryCode;
            saveCustomWordMap();
        }
    }

    hideSelectionMenu();
    window.getSelection().removeAllRanges();
    CURRENT_SELECTED_RANGE = null;
    CURRENT_SELECTION_TEXT = '';
}

// 页面加载完成后，将选中事件绑定到 diffOutput
window.addEventListener('DOMContentLoaded', () => {
    const diffArea = document.getElementById('diffOutput');
    if (!diffArea) return;

    diffArea.addEventListener('mouseup', handleTextSelection);
});