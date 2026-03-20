// AI Plain Text to Markdown Converter - Chrome Extension
// Main logic for popup

const DEFAULT_CONFIG = {
    apiBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiKey: '',
    model: 'qwen-plus',
    mode: 'ai' // 'ai' or 'local'
};

const AI_PROMPT_TEMPLATE = `你是一位专业的文档格式分析专家。请将用户提供的纯文本转换为格式规范的 Markdown 文档。

## 分析任务

1. **文档结构分析**
   - 识别主标题、章节标题、子标题
   - 判断层级关系（H1-H6）
   - 识别引言、正文、总结等不同段落类型

2. **代码块识别**
   - 检测代码片段（函数、类、配置等）
   - 识别编程语言（Python、JavaScript、Java、C++、SQL、Bash 等）
   - 使用 fenced code block (\`\`\`) 包裹

3. **列表识别**
   - 无序列表（项目符号）
   - 有序列表（编号）
   - 嵌套列表

4. **表格识别**
   - 识别表格结构
   - 使用 Markdown 表格语法

5. **其他元素**
   - 链接（URL、邮箱）
   - 强调（粗体、斜体）
   - 引用块
   - 分隔线

## 输出要求

1. 只输出转换后的 Markdown 内容，不要添加解释
2. 保持原文的语义和顺序
3. 使用适当的空行分隔不同段落
4. 代码块必须标注语言类型

## 待转换文本

{text}`;

// Local converter class
class TextToMarkdownConverter {
    constructor(options = {}) {
        this.options = {
            headers: true,
            lists: true,
            emphasis: true,
            links: true,
            tables: true,
            code: true,
            ...options
        };
    }

    convert(text) {
        if (!text.trim()) return '';
        
        let lines = text.split('\n');
        let result = [];
        let i = 0;
        
        while (i < lines.length) {
            let line = lines[i];
            
            if (!line.trim()) {
                result.push('');
                i++;
                continue;
            }

            // Code block detection
            if (this.options.code && this.isCodeBlockStart(line)) {
                let codeBlock = this.extractCodeBlock(lines, i);
                result.push(codeBlock);
                i += codeBlock.split('\n').length;
                continue;
            }

            // Process line
            let converted = this.processLine(line, lines, i);
            result.push(converted);
            i++;
        }

        return result.join('\n');
    }

    isCodeBlockStart(line) {
        return /^(    |\t)/.test(line) || 
               /^(function|class|def|const|let|var|if|for|while|import|from)\s/.test(line.trim());
    }

    extractCodeBlock(lines, startIndex) {
        let codeLines = [];
        let language = this.detectLanguage(lines[startIndex]);
        
        for (let i = startIndex; i < lines.length; i++) {
            let line = lines[i];
            if (/^(    |\t)/.test(line) || 
                (/^\s*$/.test(line) && codeLines.length > 0) ||
                (/^(function|class|def|const|let|var|if|for|while|import|from|return|print)/.test(line.trim()))) {
                codeLines.push(line.replace(/^(    |\t)/, ''));
            } else if (codeLines.length > 0) {
                break;
            } else {
                codeLines.push(line);
                break;
            }
        }
        
        return '```' + language + '\n' + codeLines.join('\n') + '\n```';
    }

    detectLanguage(line) {
        let trimmed = line.trim();
        if (/^(import|from|def|class)\s/.test(trimmed) || /^(print\(|#)/.test(trimmed)) return 'python';
        if (/^(const|let|var|function|import|export)\s/.test(trimmed) || trimmed.includes('=>')) return 'javascript';
        if (/^(public|private|class|import|package)\s/.test(trimmed)) return 'java';
        if (trimmed.startsWith('#include') || trimmed.startsWith('using namespace')) return 'cpp';
        return '';
    }

    processLine(line, lines, index) {
        let content = line.trim();
        
        // Header detection
        if (this.options.headers) {
            if (content === content.toUpperCase() && content.length > 3 && content.length < 50) {
                return `## ${content}`;
            }
            if (index < lines.length - 1) {
                let nextLine = lines[index + 1];
                if (/^[=-]{3,}$/.test(nextLine.trim()) && content.length < 50) {
                    return `# ${content}`;
                }
            }
        }

        // List detection
        if (this.options.lists) {
            if (/^[•·\-\*]\s/.test(content)) {
                return `- ${content.substring(2).trim()}`;
            }
            if (/^\d+[.\)]\s/.test(content)) {
                return content;
            }
        }

        // Inline formatting
        if (this.options.emphasis) {
            content = content.replace(/\b([A-Z]{3,})\b/g, '**$1**');
        }

        if (this.options.links) {
            content = content.replace(
                /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g,
                '[$1]($1)'
            );
            content = content.replace(
                /\b([\w.-]+@[\w.-]+\.[a-zA-Z]{2,})\b/g,
                '[$1](mailto:$1)'
            );
        }

        return content;
    }
}

// Main app
class MarkdownConverterApp {
    constructor() {
        this.currentMode = 'ai';
        this.config = DEFAULT_CONFIG;
        this.init();
    }

    async init() {
        await this.loadConfig();
        this.bindEvents();
        this.updateUI();
    }

    async loadConfig() {
        const result = await chrome.storage.local.get(['apiKey', 'model', 'mode']);
        this.config.apiKey = result.apiKey || DEFAULT_CONFIG.apiKey;
        this.config.model = result.model || DEFAULT_CONFIG.model;
        this.currentMode = result.mode || DEFAULT_CONFIG.mode;
        
        // Apply to UI
        document.getElementById('api-key').value = this.config.apiKey;
        document.getElementById('ai-model').value = this.config.model;
        this.setMode(this.currentMode);
    }

    async saveConfig() {
        await chrome.storage.local.set({
            apiKey: this.config.apiKey,
            model: this.config.model,
            mode: this.currentMode
        });
    }

    bindEvents() {
        // Mode switch
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.setMode(btn.dataset.mode);
            });
        });

        // API settings
        document.getElementById('toggle-api').addEventListener('click', () => {
            document.getElementById('api-panel').classList.toggle('hidden');
        });

        document.getElementById('api-key').addEventListener('change', (e) => {
            this.config.apiKey = e.target.value;
            this.saveConfig();
        });

        document.getElementById('ai-model').addEventListener('change', (e) => {
            this.config.model = e.target.value;
            this.saveConfig();
        });

        document.getElementById('test-api').addEventListener('click', () => this.testConnection());

        // Input actions
        document.getElementById('paste-btn').addEventListener('click', () => this.pasteText());
        document.getElementById('clear-btn').addEventListener('click', () => this.clearAll());
        document.getElementById('sample-btn').addEventListener('click', () => this.loadSample());

        // Convert
        document.getElementById('convert-btn').addEventListener('click', () => this.convert());

        // Output actions
        document.getElementById('copy-btn').addEventListener('click', () => this.copyOutput());
        document.getElementById('download-btn').addEventListener('click', () => this.downloadOutput());
        document.getElementById('preview-toggle').addEventListener('click', () => this.togglePreview());

        // Open side panel
        document.getElementById('open-sidepanel').addEventListener('click', () => {
            chrome.sidePanel.open({});
        });
    }

    setMode(mode) {
        this.currentMode = mode;
        
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });

        const apiSettings = document.getElementById('api-settings');
        const btnText = document.getElementById('btn-text');
        
        if (mode === 'ai') {
            apiSettings.classList.remove('hidden');
            btnText.textContent = 'AI 智能转换';
        } else {
            apiSettings.classList.add('hidden');
            btnText.textContent = '本地转换';
        }
        
        this.saveConfig();
    }

    async pasteText() {
        try {
            const text = await navigator.clipboard.readText();
            document.getElementById('input-text').value = text;
            this.showStatus('已粘贴剪贴板内容');
        } catch (err) {
            this.showStatus('无法访问剪贴板，请手动粘贴', 'error');
        }
    }

    clearAll() {
        document.getElementById('input-text').value = '';
        document.getElementById('output-text').value = '';
        document.getElementById('output-preview').innerHTML = '';
        document.getElementById('output-preview').classList.add('hidden');
        this.showStatus('已清空');
    }

    loadSample() {
        const sample = `Project Overview
================

This is a sample document.

Introduction
    Goals
        - Improve by 25%
        - Reduce costs
    
Code Example
    function hello() {
        console.log("Hello World");
    }

Contact: https://example.com`;
        
        document.getElementById('input-text').value = sample;
        this.showStatus('示例已加载');
    }

    async convert() {
        const input = document.getElementById('input-text').value;
        if (!input.trim()) {
            this.showStatus('请输入文本内容', 'error');
            return;
        }

        const btn = document.getElementById('convert-btn');
        const loading = document.getElementById('loading');
        
        btn.disabled = true;
        loading.classList.remove('hidden');
        this.showStatus('转换中...');

        try {
            let output;
            
            if (this.currentMode === 'ai') {
                output = await this.convertWithAI(input);
            } else {
                const converter = new TextToMarkdownConverter();
                output = converter.convert(input);
            }
            
            document.getElementById('output-text').value = output;
            this.updatePreview(output);
            this.showStatus(this.currentMode === 'ai' ? 'AI 转换完成' : '转换完成', 'success');
            
        } catch (error) {
            this.showStatus('转换失败: ' + error.message, 'error');
        } finally {
            btn.disabled = false;
            loading.classList.add('hidden');
        }
    }

    async convertWithAI(text) {
        if (!this.config.apiKey) {
            throw new Error('请先设置 API Key');
        }

        const prompt = AI_PROMPT_TEMPLATE.replace('{text}', text);
        
        const response = await fetch(`${this.config.apiBaseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.config.apiKey}`
            },
            body: JSON.stringify({
                model: this.config.model,
                messages: [
                    { role: 'system', content: '你是一个专业的 Markdown 格式转换助手。' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.3
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || `HTTP ${response.status}`);
        }
        
        const data = await response.json();
        let result = data.choices[0].message.content;
        
        // Clean up
        result = result.replace(/^```markdown\n/, '');
        result = result.replace(/^```\n/, '');
        result = result.replace(/\n```$/, '');
        
        return result;
    }

    async testConnection() {
        if (!this.config.apiKey) {
            this.showStatus('请先输入 API Key', 'error');
            return;
        }
        
        this.showStatus('正在测试连接...');
        
        try {
            const response = await fetch(`${this.config.apiBaseUrl}/models`, {
                headers: { 'Authorization': `Bearer ${this.config.apiKey}` }
            });
            
            if (response.ok) {
                this.showStatus('连接成功！', 'success');
            } else {
                this.showStatus('连接失败: ' + response.status, 'error');
            }
        } catch (error) {
            this.showStatus('连接失败: ' + error.message, 'error');
        }
    }

    updatePreview(markdown) {
        const preview = document.getElementById('output-preview');
        // Simple markdown to HTML conversion for preview
        let html = markdown
            .replace(/^# (.*$)/gim, '<h1>$1</h1>')
            .replace(/^## (.*$)/gim, '<h2>$1</h2>')
            .replace(/^### (.*$)/gim, '<h3>$1</h3>')
            .replace(/^\* (.*$)/gim, '<li>$1</li>')
            .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
        
        preview.innerHTML = html;
    }

    togglePreview() {
        const preview = document.getElementById('output-preview');
        const btn = document.getElementById('preview-toggle');
        
        if (preview.classList.contains('hidden')) {
            preview.classList.remove('hidden');
            btn.textContent = '隐藏预览';
        } else {
            preview.classList.add('hidden');
            btn.textContent = '预览';
        }
    }

    copyOutput() {
        const output = document.getElementById('output-text');
        output.select();
        document.execCommand('copy');
        this.showStatus('已复制到剪贴板', 'success');
    }

    downloadOutput() {
        const output = document.getElementById('output-text').value;
        if (!output.trim()) {
            this.showStatus('没有内容可下载', 'error');
            return;
        }
        
        const blob = new Blob([output], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `converted-${new Date().toISOString().slice(0, 10)}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.showStatus('下载已开始', 'success');
    }

    showStatus(message, type = 'info') {
        const statusEl = document.getElementById('status-text');
        statusEl.textContent = message;
        statusEl.style.color = type === 'error' ? 'var(--error)' : 
                               type === 'success' ? 'var(--success)' : 
                               'var(--text-secondary)';
        
        setTimeout(() => {
            statusEl.textContent = '就绪';
            statusEl.style.color = 'var(--text-secondary)';
        }, 3000);
    }

    updateUI() {
        // Any additional UI updates
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new MarkdownConverterApp();
});
