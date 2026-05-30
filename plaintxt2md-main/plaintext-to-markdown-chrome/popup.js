// Popup — AI-only, document-type-adaptive Markdown converter

const DEFAULT_CONFIG = {
    apiBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiKey: '',
    model: 'qwen-plus',
    headingLevel: 1,
    styleTemplate: ''
};

function buildHeadingInstruction(level) {
    const h = n => '#'.repeat(n);
    return `标题层级规则：最高级标题使用 ${h(level)}（H${level}），二级标题使用 ${h(level + 1)}，三级标题使用 ${h(level + 2)}，文档中不得出现比 ${h(level)} 级别更高的标题。`;
}

class DocumentFeatureExtractor {
    extract(text) {
        const lines = text.split('\n');
        const nonEmpty = lines.filter(l => l.trim().length > 0);
        if (nonEmpty.length === 0) return this._empty();

        const codeKwRx = /\b(function|class|def|const|let|var|return|import|from|select|if|for|while|public|private|void|int|float|double|bool|#include|namespace|struct|interface|extends|implements|fn|func|async|await|enum|impl|trait)\b/i;
        const codeDensity = nonEmpty.filter(l => codeKwRx.test(l)).length / nonEmpty.length;

        const indentDepth = Math.max(0, ...nonEmpty.map(l => {
            const m = l.match(/^(\t+| +)/);
            if (!m) return 0;
            return m[0].includes('\t') ? m[0].length : Math.floor(m[0].length / 2);
        }));

        const upperRatio = nonEmpty.filter(l => {
            const t = l.trim();
            return t.length > 3 && t.length < 60 && t === t.toUpperCase() && /[A-Z]/.test(t);
        }).length / nonEmpty.length;

        const hasTable = lines.filter(l => l.trim().split(/\s{2,}/).filter(Boolean).length >= 3).length >= 2;
        const avgLen = nonEmpty.reduce((s, l) => s + l.length, 0) / nonEmpty.length;

        const dateRx = /\b(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|Q[1-4]\s*\d{4}|(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2})/i;
        const hasDate = lines.some(l => dateRx.test(l));
        const hasEmailHeaders = lines.some(l => /^(From|To|Subject|Cc|Bcc|Date)\s*:/i.test(l.trim()));
        const numericDensity = (text.match(/\d/g) || []).length / Math.max(text.length, 1);

        const proseSentenceRx = /^[A-Z][a-zA-Z].{38,}/;
        const proseDensity = nonEmpty.filter(l => proseSentenceRx.test(l.trim())).length / nonEmpty.length;

        const indentedCodeLines = nonEmpty.filter(l => /^(\s{2,}|\t)/.test(l) && codeKwRx.test(l));
        const hasCodeBlock = indentedCodeLines.length >= 2;

        const sqlStartRx = /^\s*(SELECT\b|FROM\s+\w|INSERT\s+INTO\b|UPDATE\s+\w|DELETE\s+FROM\b|CREATE\s+(TABLE|INDEX|VIEW)\b|WITH\s+\w+\s+AS\b|GROUP\s+BY\b|ORDER\s+BY\b|HAVING\b)/i;
        const hasSqlBlock = nonEmpty.filter(l => sqlStartRx.test(l)).length >= 2;

        const techDocPatterns = [
            /^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s+\//i,
            /^--[\w-]+/,
            /^\w[\w.]*:\s+(int|str|string|bool|float|number|void|array|list|object|any)\b/i,
            /^\w[\w.-]*\s{3,}(int|str|string|bool|float|number|array|list)\b/i,
            /^[A-Z][A-Z_0-9]{3,}\b/,
            /^[2-5]\d{2}\s+[A-Z][a-z]/,
        ];
        const hasTechPatterns = nonEmpty.filter(l => techDocPatterns.some(p => p.test(l.trim()))).length >= 2;

        const meetKwRx = /\b(attendees?|action\s+items?|agenda|sprint\s+(review|planning|goal|retro)|retrospective|stand[\s-]?up|blockers?|next\s+steps?)\b/i;
        const hasMeetingKeywords = meetKwRx.test(text);

        const firstLine = (nonEmpty[0] || '').trim();
        const firstLineIsTitle =
            firstLine.length >= 3 && firstLine.length <= 50 &&
            /\s/.test(firstLine) &&
            !/[(){}[\];=<>@#]/.test(firstLine) &&
            !/:$/.test(firstLine) &&
            /[a-z]/.test(firstLine);

        return { codeDensity, indentDepth, upperRatio, hasTable, avgLen, hasDate, hasEmailHeaders, numericDensity, proseDensity, hasCodeBlock, hasSqlBlock, hasTechPatterns, hasMeetingKeywords, firstLineIsTitle };
    }

    classify(f) {
        if (f.numericDensity > 0.08 && f.hasTable) return { type: 'data_report', label: '数据报告' };
        if (f.numericDensity > 0.13) return { type: 'data_report', label: '数据报告' };
        if (f.hasDate && (f.upperRatio > 0.08 || f.avgLen < 50 || f.hasMeetingKeywords)) return { type: 'meeting_notes', label: '会议记录' };
        if (f.hasEmailHeaders) return { type: 'meeting_notes', label: '会议记录' };
        if (f.hasMeetingKeywords && f.upperRatio > 0.05) return { type: 'meeting_notes', label: '会议记录' };
        if ((f.codeDensity > 0.15 || f.hasSqlBlock) && f.proseDensity < 0.20 && !f.firstLineIsTitle) return { type: 'code_snippet', label: '代码片段' };
        if (f.firstLineIsTitle && f.indentDepth >= 3) return { type: 'technical_doc', label: '技术文档' };
        if (f.codeDensity > 0.02 && f.indentDepth >= 2 && f.proseDensity < 0.50) return { type: 'technical_doc', label: '技术文档' };
        if (f.hasCodeBlock && f.indentDepth >= 2) return { type: 'technical_doc', label: '技术文档' };
        if (f.hasTechPatterns) return { type: 'technical_doc', label: '技术文档' };
        return { type: 'general_prose', label: '通用文本' };
    }

    _empty() {
        return { codeDensity: 0, indentDepth: 0, upperRatio: 0, hasTable: false, avgLen: 0, hasDate: false, hasEmailHeaders: false, numericDensity: 0 };
    }
}

const DOC_TYPE_CONFIGS = {
    technical_doc: {
        label: '技术文档',
        system: '你是专业的技术文档格式化专家，擅长将混合了代码、配置和说明的技术文本转换为规范 Markdown。',
        template: `{HEADING_INSTRUCTION}

将以下技术文档转换为 Markdown。规则：
1. 代码、命令、配置内容用 fenced code block 包裹并标注语言
2. 函数名、变量名、路径用 \`inline code\` 标记
3. 参数/选项列表优先转为 Markdown 表格
4. 保留所有技术细节，不做解释性改动

示例输入：
INSTALLATION
    Requirements: Python 3.8+
    pip install mylib

    Config options
        timeout: int  default 30
        retry: bool   default True

示例输出：
## Installation

**Requirements:** Python 3.8+

\`\`\`bash
pip install mylib
\`\`\`

### Config Options

| 参数 | 类型 | 默认值 |
|------|------|--------|
| \`timeout\` | int | 30 |
| \`retry\` | bool | True |

---

待转换文本：
{TEXT}`
    },

    meeting_notes: {
        label: '会议记录',
        system: '你是专业的会议记录整理助手，擅长将非结构化会议文本转换为结构清晰的 Markdown。',
        template: `{HEADING_INSTRUCTION}

将以下会议记录转换为 Markdown。规则：
1. Action items / 待办事项转换为 GitHub 任务列表格式 \`- [ ] 内容\`
2. 日期时间精确保留，不得修改
3. 与会人员列为无序列表
4. 决策结论用粗体标注

示例输入：
Weekly Sync  2024-01-15  3:00PM
Attendees: Alice, Bob, Carol

Discussion
    Decided to delay launch to Q2

Action Items
    Bob: update roadmap by Friday
    Alice: send client email

示例输出：
## Weekly Sync

**日期：** 2024-01-15 15:00

**与会人员：** Alice、Bob、Carol

### 讨论

**决策：** 将发布延迟至 Q2

### Action Items

- [ ] Bob：在周五前更新 roadmap
- [ ] Alice：发送客户邮件

---

待转换文本：
{TEXT}`
    },

    code_snippet: {
        label: '代码片段',
        system: '你是代码文档专家。输入文本主体是源代码，需要正确格式化为带语言标注的 Markdown 代码块。',
        template: `{HEADING_INSTRUCTION}

将以下内容转换为 Markdown。规则：
1. 代码主体用 fenced code block 包裹并标注编程语言
2. 注释和说明性文字保留在代码块外作为正文
3. 多段代码之间用简短说明文字分隔
4. 只输出 Markdown，不添加原文没有的解释

示例输入：
Calculate fibonacci sequence
def fib(n):
    if n <= 1:
        return n
    return fib(n-1) + fib(n-2)

Usage:
print(fib(10))  # 55

示例输出：
## Calculate Fibonacci Sequence

\`\`\`python
def fib(n):
    if n <= 1:
        return n
    return fib(n-1) + fib(n-2)
\`\`\`

使用示例：

\`\`\`python
print(fib(10))  # 55
\`\`\`

---

待转换文本：
{TEXT}`
    },

    data_report: {
        label: '数据报告',
        system: '你是数据报告格式化专家，擅长将含有大量数字、表格和统计数据的文本转换为规范 Markdown。',
        template: `{HEADING_INSTRUCTION}

将以下数据报告转换为 Markdown。规则：
1. 对齐的列式数据必须转换为 Markdown 表格
2. 所有数字和百分比精确保留，不得四舍五入或省略
3. 关键指标（合计、最大值等）用粗体标注
4. 时间序列数据优先用表格而非列表

示例输入：
Q3 Sales Report
Product      Units    Revenue    Change
Widget A     1204     $24,080    +12.5%
Widget B     856      $17,120    -3.2%
Total        2060     $41,200    +5.8%

示例输出：
## Q3 Sales Report

| 产品 | 销量 | 营收 | 变化 |
|------|------|------|------|
| Widget A | 1,204 | $24,080 | +12.5% |
| Widget B | 856 | $17,120 | -3.2% |
| **合计** | **2,060** | **$41,200** | **+5.8%** |

---

待转换文本：
{TEXT}`
    },

    general_prose: {
        label: '通用文本',
        system: '你是专业的文档格式化助手，将纯文本转换为格式规范的 Markdown。',
        template: `{HEADING_INSTRUCTION}

将以下文本转换为 Markdown。规则：
1. 根据上方标题层级规则分配各级标题
2. 识别并转换列表、链接、邮箱地址
3. 如文本中有缩进的代码片段或命令，用 fenced code block 包裹并标注语言
4. 段落间保持适当空行
5. 保持原文语义，不添加原文没有的内容
6. 只输出 Markdown，不要添加解释

---

待转换文本：
{TEXT}`
    }
};

class MarkdownConverterApp {
    constructor() {
        this.config = { ...DEFAULT_CONFIG };
        this.extractor = new DocumentFeatureExtractor();
        this.docTypeAutoDetected = null;
        this.init();
    }

    async init() {
        await this.loadConfig();
        this.bindEvents();
        this.checkPendingText();
    }

    async loadConfig() {
        const result = await chrome.storage.local.get(['apiKey', 'model', 'headingLevel', 'styleTemplate']);
        this.config.apiKey = result.apiKey || DEFAULT_CONFIG.apiKey;
        this.config.model = result.model || DEFAULT_CONFIG.model;
        this.config.headingLevel = result.headingLevel != null ? result.headingLevel : DEFAULT_CONFIG.headingLevel;
        this.config.styleTemplate = result.styleTemplate || DEFAULT_CONFIG.styleTemplate;

        document.getElementById('api-key').value = this.config.apiKey;
        document.getElementById('ai-model').value = this.config.model;
        document.getElementById('heading-level').value = this.config.headingLevel;
        document.getElementById('style-template').value = this.config.styleTemplate;
        this.updateStyleCounter(this.config.styleTemplate.length);
    }

    async saveConfig() {
        await chrome.storage.local.set({
            apiKey: this.config.apiKey,
            model: this.config.model,
            headingLevel: this.config.headingLevel,
            styleTemplate: this.config.styleTemplate
        });
    }

    async checkPendingText() {
        const result = await chrome.storage.local.get(['pendingText']);
        if (result.pendingText) {
            document.getElementById('input-text').value = result.pendingText;
            chrome.storage.local.remove('pendingText');
        }
    }

    bindEvents() {
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

        document.getElementById('heading-level').addEventListener('change', (e) => {
            this.config.headingLevel = parseInt(e.target.value);
            this.saveConfig();
        });

        document.getElementById('test-api').addEventListener('click', () => this.testConnection());

        document.getElementById('style-template').addEventListener('input', (e) => {
            this.config.styleTemplate = e.target.value.slice(0, 800);
            if (e.target.value.length > 800) e.target.value = this.config.styleTemplate;
            this.updateStyleCounter(this.config.styleTemplate.length);
            this.saveConfig();
        });

        document.getElementById('clear-style-template').addEventListener('click', () => {
            document.getElementById('style-template').value = '';
            this.config.styleTemplate = '';
            this.updateStyleCounter(0);
            this.saveConfig();
        });

        document.getElementById('paste-btn').addEventListener('click', () => this.pasteText());
        document.getElementById('clear-btn').addEventListener('click', () => this.clearAll());
        document.getElementById('sample-btn').addEventListener('click', () => this.loadSample());

        document.getElementById('input-text').addEventListener('input', () => this.autoDetectType());

        document.getElementById('convert-btn').addEventListener('click', () => this.convert());

        document.getElementById('copy-btn').addEventListener('click', () => this.copyOutput());
        document.getElementById('download-btn').addEventListener('click', () => this.downloadOutput());
        document.getElementById('preview-toggle').addEventListener('click', () => this.togglePreview());

        document.getElementById('open-sidepanel').addEventListener('click', () => {
            chrome.sidePanel.open({});
        });
    }

    autoDetectType() {
        const input = document.getElementById('input-text').value;
        if (!input.trim()) return;
        const features = this.extractor.extract(input);
        const docType = this.extractor.classify(features);
        const select = document.getElementById('doc-type-override');
        if (select.value === 'auto' || select.value === this.docTypeAutoDetected) {
            select.value = docType.type;
            this.docTypeAutoDetected = docType.type;
        }
    }

    updateStyleCounter(len) {
        const counter = document.getElementById('style-template-counter');
        counter.textContent = `${len} / 800`;
        counter.classList.toggle('over-limit', len >= 800);
    }

    analyzeMarkdown(markdown) {
        const headings = (markdown.match(/^#{1,6} /gm) || []).length;
        const codeBlocks = Math.floor((markdown.match(/^```/gm) || []).length / 2);
        const tables = (markdown.match(/^\|[-: |]+\|$/gm) || []).length;
        const listItems = (markdown.match(/^[-*+] /gm) || []).length
                        + (markdown.match(/^\d+\. /gm) || []).length;
        return { headings, codeBlocks, tables, listItems };
    }

    async pasteText() {
        try {
            const text = await navigator.clipboard.readText();
            document.getElementById('input-text').value = text;
            this.autoDetectType();
            this.showStatus('已粘贴剪贴板内容');
        } catch {
            this.showStatus('无法访问剪贴板，请手动粘贴', 'error');
        }
    }

    clearAll() {
        document.getElementById('input-text').value = '';
        document.getElementById('output-text').value = '';
        document.getElementById('output-preview').innerHTML = '';
        document.getElementById('output-preview').classList.add('hidden');
        document.getElementById('doc-type-override').value = 'auto';
        this.docTypeAutoDetected = null;
        this.showStatus('已清空');
    }

    loadSample() {
        document.getElementById('input-text').value = `Project Overview
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
        this.showStatus('分析文档结构...');

        try {
            const selectValue = document.getElementById('doc-type-override').value;
            let docType;
            if (selectValue === 'auto') {
                const features = this.extractor.extract(input);
                docType = this.extractor.classify(features);
                document.getElementById('doc-type-override').value = docType.type;
                this.docTypeAutoDetected = docType.type;
            } else {
                docType = { type: selectValue, label: DOC_TYPE_CONFIGS[selectValue].label };
            }

            this.showStatus(`${docType.label}，转换中...`);
            const output = await this.convertWithAI(input, docType.type);

            document.getElementById('output-text').value = output;
            this.updatePreview(output);

            const { headings, codeBlocks, tables, listItems } = this.analyzeMarkdown(output);
            const parts = [];
            if (headings > 0) parts.push(`${headings} 标题`);
            if (codeBlocks > 0) parts.push(`${codeBlocks} 代码块`);
            if (tables > 0) parts.push(`${tables} 表格`);
            if (listItems > 0) parts.push(`${listItems} 列表项`);
            this.showStatus(`完成 · ${parts.join(' · ') || docType.label}`, 'success');
        } catch (error) {
            this.showStatus('转换失败: ' + error.message, 'error');
        } finally {
            btn.disabled = false;
            loading.classList.add('hidden');
        }
    }

    async convertWithAI(text, docType) {
        if (!this.config.apiKey) throw new Error('请先设置 API Key');

        const typeConfig = DOC_TYPE_CONFIGS[docType] || DOC_TYPE_CONFIGS.general_prose;
        const headingInstruction = buildHeadingInstruction(this.config.headingLevel);
        let prompt = typeConfig.template
            .replace('{HEADING_INSTRUCTION}', headingInstruction)
            .replace('{TEXT}', text);

        if (this.config.styleTemplate && this.config.styleTemplate.trim()) {
            prompt += `\n\n## 用户风格参考\n\n以下是用户提供的 Markdown 风格样例，请模仿其格式习惯（标题选用、分隔符、代码块写法、表格样式等），但不要复制其中的内容：\n\n${this.config.styleTemplate.trim()}\n\n**最终约束（优先级高于上方样例）：** ${headingInstruction}`;
        }

        const response = await fetch(`${this.config.apiBaseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.config.apiKey}`
            },
            body: JSON.stringify({
                model: this.config.model,
                messages: [
                    { role: 'system', content: typeConfig.system },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.3
            })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error?.message || `HTTP ${response.status}`);
        }

        const data = await response.json();
        let result = data.choices[0].message.content;
        result = result.replace(/^```markdown\n/, '').replace(/^```\n/, '').replace(/\n```$/, '');
        // If the fence count is odd, the last code block was not closed by the model
        if ((result.match(/^```/gm) || []).length % 2 !== 0) {
            result = result.trimEnd() + '\n```';
        }
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
            this.showStatus(response.ok ? '连接成功！' : '连接失败: ' + response.status, response.ok ? 'success' : 'error');
        } catch (error) {
            this.showStatus('连接失败: ' + error.message, 'error');
        }
    }

    markdownToHtml(md) {
        md = md.replace(/(\|[^\n]+\n?)+/g, block => {
            const lines = block.trim().split('\n').filter(l => l.trim());
            const sepIdx = lines.findIndex(l => /^\|[\s\-:|]+\|$/.test(l.trim()));
            if (sepIdx < 0) return block;

            const toRow = (line, tag) =>
                '<tr>' + line.trim().replace(/^\||\|$/g, '').split('|')
                    .map(c => `<${tag}>${c.trim()}</${tag}>`).join('') + '</tr>';

            const thead = lines.slice(0, sepIdx).map(l => toRow(l, 'th')).join('');
            const tbody = lines.slice(sepIdx + 1).filter(l => l.trim()).map(l => toRow(l, 'td')).join('');
            return `<table><thead>${thead}</thead><tbody>${tbody}</tbody></table>`;
        });

        return md
            .replace(/^#{6} (.+)$/gm, '<h6>$1</h6>')
            .replace(/^#{5} (.+)$/gm, '<h5>$1</h5>')
            .replace(/^#{4} (.+)$/gm, '<h4>$1</h4>')
            .replace(/^#{3} (.+)$/gm, '<h3>$1</h3>')
            .replace(/^#{2} (.+)$/gm, '<h2>$1</h2>')
            .replace(/^#{1} (.+)$/gm, '<h1>$1</h1>')
            .replace(/^\- \[ \] (.+)$/gm, '<li><input type="checkbox" disabled> $1</li>')
            .replace(/^\- \[x\] (.+)$/gm, '<li><input type="checkbox" checked disabled> $1</li>')
            .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
            .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/\*([^*]+)\*/g, '<em>$1</em>')
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
            .replace(/\n/g, '<br>');
    }

    updatePreview(markdown) {
        document.getElementById('output-preview').innerHTML = this.markdownToHtml(markdown);
    }

    togglePreview() {
        const preview = document.getElementById('output-preview');
        const btn = document.getElementById('preview-toggle');
        const hidden = preview.classList.toggle('hidden');
        btn.textContent = hidden ? '预览' : '隐藏预览';
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
        const el = document.getElementById('status-text');
        el.textContent = message;
        el.style.color = type === 'error' ? 'var(--error)'
            : type === 'success' ? 'var(--success)'
            : 'var(--text-secondary)';
        setTimeout(() => {
            el.textContent = '就绪';
            el.style.color = 'var(--text-secondary)';
        }, 3000);
    }
}

document.addEventListener('DOMContentLoaded', () => new MarkdownConverterApp());
