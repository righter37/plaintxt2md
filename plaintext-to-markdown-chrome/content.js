// Content script - runs on all web pages
// Handles text selection, page extraction and communication with extension

// Notify background script that content script is ready
chrome.runtime.sendMessage({ action: 'contentScriptReady' });

// Listen for messages from popup/background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getSelectedText') {
        const selectedText = window.getSelection().toString();
        sendResponse({ text: selectedText });
    }

    if (request.action === 'extractPageContent') {
        const text = extractMainContent();
        sendResponse({ text });
    }

    if (request.action === 'insertText') {
        insertTextAtCursor(request.text);
        sendResponse({ success: true });
    }
});

// Function to insert text at cursor position
function insertTextAtCursor(text) {
    const activeElement = document.activeElement;

    if (activeElement && (activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'INPUT')) {
        const start = activeElement.selectionStart;
        const end = activeElement.selectionEnd;
        const value = activeElement.value;

        activeElement.value = value.substring(0, start) + text + value.substring(end);
        activeElement.selectionStart = activeElement.selectionEnd = start + text.length;
        activeElement.focus();
    }
}

// Heuristic extraction of main article content
function extractMainContent() {
    const removeSelectors = [
        'nav', 'header', 'footer', 'aside', '.sidebar', '.ads', '.advertisement',
        '#comments', '.comments', '.related', '.recommend', '.share', '.social',
        'script', 'style', 'noscript', 'iframe', 'svg', 'canvas', 'video', 'audio'
    ];

    const candidates = Array.from(document.querySelectorAll('article, main, [role="main"], .post, .entry, .content, .article'));
    let root = document.body;

    if (candidates.length > 0) {
        root = candidates.reduce((best, el) => {
            return el.innerText.length > best.innerText.length ? el : best;
        }, candidates[0]);
    }

    const clone = root.cloneNode(true);
    removeSelectors.forEach(sel => {
        clone.querySelectorAll(sel).forEach(el => el.remove());
    });

    clone.querySelectorAll('*').forEach(el => {
        if (el.children.length > 0 && el.innerText.length < 30) {
            const tag = el.tagName.toLowerCase();
            if (tag === 'div' || tag === 'section') {
                el.remove();
            }
        }
    });

    let text = clone.innerText || '';
    text = text.replace(/\n{3,}/g, '\n\n').trim();

    if (!text || text.length < 50) {
        text = window.getSelection().toString();
    }

    return text;
}

// Optional: floating button when text is selected
let floatingButton = null;

function showFloatingButton(selection) {
    if (!selection.toString().trim()) {
        hideFloatingButton();
        return;
    }

    if (floatingButton) {
        hideFloatingButton();
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    floatingButton = document.createElement('button');
    floatingButton.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5L12 2z"/>
            <path d="M19 13l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1 1-2.5z"/>
        </svg>
    `;
    floatingButton.title = '用 素记 转换';
    floatingButton.style.cssText = `
        position: fixed;
        z-index: 999999;
        background: linear-gradient(135deg, #d97736, #c46a2e);
        color: white;
        border: none;
        border-radius: 50%;
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        box-shadow: 0 4px 16px rgba(217, 119, 54, 0.35);
        transition: transform 0.2s, box-shadow 0.2s;
        top: ${rect.top + window.scrollY - 50}px;
        left: ${rect.left + window.scrollX + rect.width / 2 - 20}px;
    `;

    floatingButton.addEventListener('click', () => {
        const text = selection.toString();
        chrome.runtime.sendMessage({
            action: 'convertText',
            text: text
        });
        hideFloatingButton();
    });

    floatingButton.addEventListener('mouseenter', () => {
        floatingButton.style.transform = 'scale(1.1)';
        floatingButton.style.boxShadow = '0 6px 20px rgba(217, 119, 54, 0.45)';
    });

    floatingButton.addEventListener('mouseleave', () => {
        floatingButton.style.transform = 'scale(1)';
        floatingButton.style.boxShadow = '0 4px 16px rgba(217, 119, 54, 0.35)';
    });

    document.body.appendChild(floatingButton);
}

function hideFloatingButton() {
    if (floatingButton) {
        floatingButton.remove();
        floatingButton = null;
    }
}

// Listen for selection changes (disabled by default, can be enabled in settings later)
/*
document.addEventListener('selectionchange', () => {
    const selection = window.getSelection();
    if (selection.toString().trim().length > 10) {
        showFloatingButton(selection);
    } else {
        hideFloatingButton();
    }
});

document.addEventListener('click', (e) => {
    if (floatingButton && !floatingButton.contains(e.target)) {
        hideFloatingButton();
    }
});
*/

console.log('素记：Content script loaded');
