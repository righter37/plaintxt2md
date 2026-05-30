// Content script - runs on all web pages
// Handles text selection and communication with extension

// Notify background script that content script is ready
chrome.runtime.sendMessage({ action: 'contentScriptReady' });

// Listen for messages from popup/background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getSelectedText') {
        const selectedText = window.getSelection().toString();
        sendResponse({ text: selectedText });
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

// Optional: Add floating button when text is selected
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
    floatingButton.innerHTML = '📝';
    floatingButton.title = '转换为 Markdown';
    floatingButton.style.cssText = `
        position: fixed;
        z-index: 999999;
        background: linear-gradient(135deg, #667eea, #764ba2);
        color: white;
        border: none;
        border-radius: 50%;
        width: 40px;
        height: 40px;
        font-size: 18px;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        transition: transform 0.2s;
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
    });
    
    floatingButton.addEventListener('mouseleave', () => {
        floatingButton.style.transform = 'scale(1)';
    });
    
    document.body.appendChild(floatingButton);
}

function hideFloatingButton() {
    if (floatingButton) {
        floatingButton.remove();
        floatingButton = null;
    }
}

// Listen for selection changes
// Note: This is optional and can be enabled if desired
/*
document.addEventListener('selectionchange', () => {
    const selection = window.getSelection();
    if (selection.toString().trim().length > 10) {
        showFloatingButton(selection);
    } else {
        hideFloatingButton();
    }
});

// Hide button when clicking elsewhere
document.addEventListener('click', (e) => {
    if (floatingButton && !floatingButton.contains(e.target)) {
        hideFloatingButton();
    }
});
*/

console.log('AI Text to Markdown: Content script loaded');
