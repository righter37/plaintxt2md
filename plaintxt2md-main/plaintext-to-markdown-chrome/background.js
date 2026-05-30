// Background service worker for Chrome Extension

// Install event
chrome.runtime.onInstalled.addListener((details) => {
    console.log('AI Text to Markdown Converter installed');
    
    // Create context menu
    chrome.contextMenus.create({
        id: 'convert-selection',
        title: '📝 转换为 Markdown',
        contexts: ['selection']
    });
    
    chrome.contextMenus.create({
        id: 'open-converter',
        title: '🤖 打开 AI Markdown 转换器',
        contexts: ['page', 'action']
    });
    
    // Set default settings
    chrome.storage.local.set({
        apiKey: '',
        model: 'qwen-plus',
        mode: 'ai'
    });
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
