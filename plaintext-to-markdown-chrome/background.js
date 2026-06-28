// Background service worker for Chrome Extension

const MENU_ICONS = {
    convertSelection: '✨',
    openConverter: '◈'
};

// Install event
chrome.runtime.onInstalled.addListener((details) => {
    console.log('素记 installed, reason:', details.reason);

    // Recreate context menus to avoid duplicate-id errors on update
    chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create({
            id: 'convert-selection',
            title: `${MENU_ICONS.convertSelection} 转换为 Markdown`,
            contexts: ['selection']
        });

        chrome.contextMenus.create({
            id: 'open-converter',
            title: `${MENU_ICONS.openConverter} 打开 素记`,
            contexts: ['page', 'action']
        });
    });

    // Only set defaults on first install; never overwrite existing settings on update
    if (details.reason === 'install') {
        chrome.storage.local.set({
            apiKey: '',
            model: 'qwen-plus',
            mode: 'ai',
            darkMode: false,
            autoCopy: false,
            customPrompts: {}
        });
    }
});

// Context menu click handler
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'convert-selection') {
        // Open popup with selected text
        chrome.storage.local.set({
            pendingText: info.selectionText
        }, () => {
            chrome.action.openPopup();
        });
    } else if (info.menuItemId === 'open-converter') {
        chrome.action.openPopup();
    }
});

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getSelectedText') {
        // Return pending text if exists
        chrome.storage.local.get(['pendingText'], (result) => {
            sendResponse({ text: result.pendingText || '' });
            // Clear pending text after retrieval
            chrome.storage.local.remove('pendingText');
        });
        return true; // Async response
    }

    if (request.action === 'openSidePanel') {
        chrome.sidePanel.open({});
        sendResponse({ success: true });
    }
});

// Side panel behavior
chrome.sidePanel.setPanelBehavior({
    openPanelOnActionClick: true
}).catch((error) => console.error('Side panel error:', error));

// Keyboard shortcut handler
chrome.commands.onCommand.addListener((command) => {
    if (command === 'open_side_panel') {
        chrome.sidePanel.open({});
    }
});

console.log('Background service worker initialized');
