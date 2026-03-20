// Side panel script - extended version with full features

const DEFAULT_CONFIG = {
    apiBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiKey: '',
    model: 'qwen-plus',
    mode: 'ai',
    style: 'standard'
};

const STYLE_PROMPTS = {
    'standard': '标准 Markdown 格式，清晰易读',
    'github': 'GitHub Flavored Markdown，支持任务列表等',
    'minimal': '简洁风格，减少不必要的格式标记',
    'detailed': '详细风格，添加更多结构说明'
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

## 输出风格

{STYLE}

## 输出要求

1. 只输出转换后的 Markdown 内容，不要添加解释
2. 保持原文的语义和顺序
3. 使用适当的空行分隔不同段落
4. 代码块必须标注语言类型

## 待转换文本

{text}`;

// Local converter
class TextToMarkdownConverter {
    constructor(options = {}) {
        this.options = { headers: true, lists: true, emphasis: true, links: true, code: true, ...options };
    }

    convert(text) {
        if (!text.trim()) return '';
        let lines = text.split('\n'), result = [], i = 0;
        
        while (i < lines.length) {
            let line = lines[i];
            if (!line.trim()) { result.push(''); i++; continue; }
            
            if (this.options.code && this.isCodeBlockStart(line)) {
                let codeBlock = this.extractCodeBlock(lines, i);
                result.push(codeBlock);
                i += codeBlock.split('\n').length;
                continue;
            }
            
            result.push(this.processLine(line, lines, i));
            i++;
        }
        return result.join('\n');
    }

    isCodeBlockStart(line) {
        return /^(    |\t)/.test(line) || /^(function|class|def|const|let|var|if|for|while|import|from)\s/.test(line.trim());
    }

    extractCodeBlock(lines, startIndex) {
        let codeLines = [], language = this.detectLanguage(lines[startIndex]);
        for (let i = startIndex; i < lines.length; i++) {
            let line = lines[i];
            if (/^(    |\t)/.test(line) || (/^\s*$/.test(line) && codeLines.length > 0) ||
                (/^(function|class|def|const|let|var|if|for|while|import|from|return|print)/.test(line.trim()))) {
                codeLines.push(line.replace(/^(    |\t)/, ''));
            } else if (codeLines.length > 0) break;
            else { codeLines.push(line); break; }
        }
        return '```' + language + '\n' + codeLines.join('\n') + '\n```';
    }

    detectLanguage(line) {
        let trimmed = line.trim();
        if (/^(import|from|def|class)\s/.test(trimmed) || /^(print\(|#)/.test(trimmed)) return 'python';
        if (/^(const|let|var|function|import|export)\s/.test(trimmed) || trimmed.includes('=>')) return 'javascript';
        if (/^(public|private|class|import|package)\s/.test(trimmed)) return 'java';
        if (trimmed.startsWith('#include')) return 'cpp';
        return '';
    }

    processLine(line, lines, index) {
        let content = line.trim();
        if (this.options.headers) {
            if (content === content.toUpperCase() && content.length > 3 && content.length < 50) return `## ${content}`;
            if (index < lines.length - 1 && /^[=-]{3,}$/.test(lines[index + 1].trim()) && content.length < 50) return `# ${content}`;
        }
        if (this.options.lists) {
            if (/^[•·\-\*]\s/.test(content)) return `- ${content.substring(2).trim()}`;
            if (/^\d+[.\)]\s/.test(content)) return content;
        }
        if (this.options.emphasis) content = content.replace(/\b([A-Z]{3,})\b/g, '**$1**');
        if (this.options.links) {
            content = content.replace(/(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g, '[$1]($1)');
            content = content.replace(/\b([\w.-]+@[\w.-]+\.[a-zA-Z]{2,})\b/g, '[$1](mailto:$1)');
        }
        return content;
    }
}

// Main App
class SidePanelApp {
    constructor() {
        this.currentMode = 'ai';
        this.currentView = 'source';
        this.config = DEFAULT_CONFIG;
        this.init();
    }

    async init() {
        await this.loadConfig();
        this.bindEvents();
        this.updateStats();
        
        // Try to get selected text from active tab
        this.getSelectedTextFromPage();
    }

    async loadConfig() {
        const result = await chrome.storage.local.get(['apiKey', 'model', 'mode', 'style']);
        this.config.apiKey = result.apiKey || DEFAULT_CONFIG.apiKey;
        this.config.model = result.model || DEFAULT_CONFIG.model;
        this.config.style = result.style || DEFAULT_CONFIG.style;
        this.currentMode = result.mode || DEFAULT_CONFIG.mode;
        
        document.getElementById('api-key').value = this.config.apiKey;
        document.getElementById('ai-model').value = this.config.model;
        document.getElementById('output-style').value = this.config.style;
        this.setMode(this.currentMode);
    }

    async saveConfig() {
        await chrome.storage.local.set({
            apiKey: this.config.apiKey,
            model: this.config.model,
            style: this.config.style,
            mode: this.currentMode
        });
    }

    bindEvents() {
        // Mode switch
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', () => this.setMode(btn.dataset.mode));
        });

        // Settings toggle
        document.getElementById('toggle-settings').addEventListener('click', () => {
            document.getElementById('settings-content').classList.toggle('collapsed');
        });

        // API key visibility
        document.getElementById('toggle-key-visibility').addEventListener('click', (e) => {
            const input = document.getElementById('api-key');
            input.type = input.type === 'password' ? 'text' : 'password';
            e.target.textContent = input.type === 'password' ? '显示' : '隐藏';
        });

        // Config changes
        document.getElementById('api-key').addEventListener('change', (e) => {
            this.config.apiKey = e.target.value;
            this.saveConfig();
        });

        document.getElementById('ai-model').addEventListener('change', (e) => {
            this.config.model = e.target.value;
            this.saveConfig();
        });

        document.getElementById('output-style').addEventListener('change', (e) => {
            this.config.style = e.target.value;
            this.saveConfig();
        });

        document.getElementById('test-api').addEventListener('click', () => this.testConnection());

        // Input actions
        document.getElementById('get-page-text').addEventListener('click', () => this.getSelectedTextFromPage());
        document.getElementById('paste-btn').addEventListener('click', () => this.pasteText());
        document.getElementById('clear-btn').addEventListener('click', () => this.clearAll());
        document.getElementById('sample-btn').addEventListener('click', () => this.loadSample());

        // Convert
        document.getElementById('convert-btn').addEventListener('click', () => this.convert());

        // View toggle
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', () => this.setView(btn.dataset.view));
        });

        // Output actions
        document.getElementById('copy-btn').addEventListener('click', () => this.copyOutput());
        document.getElementById('download-btn').addEventListener('click', () => this.downloadOutput());

        // Input stats
        document.getElementById('input-text').addEventListener('input', () => this.updateStats());
    }

    setMode(mode) {
        this.currentMode = mode;
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });
        document.getElementById('settings-panel').style.display = mode === 'ai' ? 'block' : 'none';
        document.getElementById('btn-text').textContent = mode === 'ai' ? 'AI 智能转换' : '本地转换';
        this.saveConfig();
    }

    setView(view) {
        this.currentView = view;
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === view);
        });
        
        document.getElementById('view-source').classList.toggle('hidden', view !== 'source');
        document.getElementById('view-preview').classList.toggle('hidden', view !== 'preview');
        document.getElementById('view-split').classList.toggle('hidden', view !== 'split');
    }

    async getSelectedTextFromPage() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => window.getSelection().toString()
            });
            
            const selectedText = results[0].result;
            if (selectedText) {
                document.getElementById('input-text').value = selectedText;
                this.updateStats();
                this.showStatus('已获取页面选中文字');
            } else {
                this.showStatus('请先在页面中选中文字', 'warning');
            }
        } catch (err) {
            this.showStatus('无法获取选中文字: ' + err.message, 'error');
        }
    }

    async pasteText() {
        try {
            const text = await navigator.clipboard.readText();
            document.getElementById('input-text').value = text;
            this.updateStats();
            this.showStatus('已粘贴剪贴板内容');
        } catch (err) {
            this.showStatus('无法访问剪贴板', 'error');
        }
    }

    clearAll() {
        document.getElementById('input-text').value = '';
        document.getElementById('output-text').value = '';
        document.getElementById('output-text-split').value = '';
        document.getElementById('preview-content').innerHTML = '';
        document.getElementById('preview-content-split').innerHTML = '';
        this.updateStats();
        this.showStatus('已清空');
    }

    loadSample() {
        const sample = `Project Overview
================

This is a sample plain text document that will be converted to Markdown using AI.

Introduction
    Project Goals
        - Improve efficiency by 25%
        - Reduce costs
        - Enhance user experience
    
    Timeline
        Phase 1: Planning (Q1 2024)
        Phase 2: Development (Q2-Q3 2024)
        Phase 3: Launch (Q4 2024)

Technical Details

    Architecture
        The system uses a microservices architecture with the following components:
        
        API Gateway
            Handles routing and authentication
            Rate limiting: 1000 req/min
        
        Database
            PostgreSQL for primary storage
            Redis for caching
    
    Code Example
        function calculateTotal(items) {
            return items.reduce((sum, item) => sum + item.price, 0);
        }

Team Members

    Name                    Role                Email
    Alice Johnson           Project Manager     alice@example.com
    Bob Smith               Lead Developer      bob@example.com
    Carol White             Designer            carol@example.com

Contact

For more information, visit https://example.com or email contact@example.com`;
        
        document.getElementById('input-text').value = sample;
        this.updateStats();
        this.showStatus('示例已加载');
    }

    async convert() {
        const input = document.getElementById('input-text').value;
        if (!input.trim()) {
            this.showStatus('请输入文本内容', 'error');
            return;
        }

        const btn = document.getElementById('convert-btn');
        const loading = document.getElementById('loading-indicator');
        
        btn.disabled = true;
        loading.classList.remove('hidden');
        this.showStatus('转换中...');

        try {
            let output = this.currentMode === 'ai' 
                ? await this.convertWithAI(input)
                : new TextToMarkdownConverter().convert(input);
            
            document.getElementById('output-text').value = output;
            document.getElementById('output-text-split').value = output;
            this.updatePreview(output);
            this.updateStats();
            this.showStatus(this.currentMode === 'ai' ? 'AI 转换完成' : '转换完成', 'success');
        } catch (error) {
            this.showStatus('转换失败: ' + error.message, 'error');
        } finally {
            btn.disabled = false;
            loading.classList.add('hidden');
        }
    }

    async convertWithAI(text) {
        if (!this.config.apiKey) throw new Error('请先设置 API Key');

        const prompt = AI_PROMPT_TEMPLATE
            .replace('{STYLE}', STYLE_PROMPTS[this.config.style])
            .replace('{text}', text);

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
        result = result.replace(/^```markdown\n/, '').replace(/^```\n/, '').replace(/\n```$/, '');
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
            this.showStatus(response.ok ? '连接成功！' : '连接失败', response.ok ? 'success' : 'error');
        } catch (error) {
            this.showStatus('连接失败: ' + error.message, 'error');
        }
    }

    updatePreview(markdown) {
        const html = this.markdownToHtml(markdown);
        document.getElementById('preview-content').innerHTML = html;
        document.getElementById('preview-content-split').innerHTML = html;
    }

    markdownToHtml(markdown) {
        return markdown
            .replace(/^# (.*$)/gim, '<h1>$1</h1>')
            .replace(/^## (.*$)/gim, '<h2>$1</h2>')
            .replace(/^### (.*$)/gim, '<h3>$1</h3>')
            .replace(/^#### (.*$)/gim, '<h4>$1</h4>')
            .replace(/^\*\* (.*$)/gim, '<li>$1</li>')
            .replace(/^\* (.*$)/gim, '<li>$1</li>')
            .replace(/^- (.*$)/gim, '<li>$1</li>')
            .replace(/<\/li>\n<li>/g, '</li><li>')
            .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
            .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/\*([^*]+)\*/g, '<em>$1</em>')
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
            .replace(/\n/g, '<br>');
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

    updateStats() {
        const input = document.getElementById('input-text').value;
        const output = document.getElementById('output-text').value;
        
        document.getElementById('input-stats').textContent = 
            `${input.length.toLocaleString()} 字符 | ${input.split('\n').length} 行`;
        document.getElementById('output-stats').textContent = 
            `${output.length.toLocaleString()} 字符`;
    }

    showStatus(message, type = 'info') {
        const statusEl = document.getElementById('status-text');
        statusEl.textContent = message;
        statusEl.style.color = type === 'error' ? 'var(--error)' : 
                               type === 'success' ? 'var(--success)' : 
                               type === 'warning' ? 'var(--warning)' :
                               'var(--text-secondary)';
        
        setTimeout(() => {
            statusEl.textContent = '就绪';
            statusEl.style.color = 'var(--text-secondary)';
        }, 3000);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    new SidePanelApp();
});
