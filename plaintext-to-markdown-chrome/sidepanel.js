// Side panel — AI-only, document-type-adaptive Markdown converter

// ─── LLM provider registry (all OpenAI-compatible /chat/completions) ──────────
const PROVIDERS = {
    dashscope: {
        label: '阿里通义千问',
        baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        keyUrl: 'https://dashscope.aliyun.com/',
        keyName: 'DashScope',
        models: [
            { value: 'qwen-turbo', label: '通义千问 Turbo (快速)' },
            { value: 'qwen-plus',  label: '通义千问 Plus (平衡)' },
            { value: 'qwen-max',   label: '通义千问 Max (最强)' }
        ]
    },
    moonshot: {
        label: 'Kimi (Moonshot)',
        baseUrl: 'https://api.moonshot.cn/v1',
        keyUrl: 'https://platform.moonshot.cn/console/api-keys',
        keyName: 'Moonshot',
        models: [
            { value: 'moonshot-v1-8k',   label: 'moonshot-v1-8k' },
            { value: 'moonshot-v1-32k',  label: 'moonshot-v1-32k' },
            { value: 'moonshot-v1-128k', label: 'moonshot-v1-128k' },
            { value: 'kimi-latest',      label: 'kimi-latest' }
        ]
    },
    deepseek: {
        label: 'DeepSeek',
        baseUrl: 'https://api.deepseek.com/v1',
        keyUrl: 'https://platform.deepseek.com/api_keys',
        keyName: 'DeepSeek',
        models: [
            { value: 'deepseek-chat',     label: 'deepseek-chat (V3)' },
            { value: 'deepseek-reasoner', label: 'deepseek-reasoner (R1)' }
        ]
    },
    zhipu: {
        label: '智谱 GLM',
        baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
        keyUrl: 'https://open.bigmodel.cn/usercenter/apikeys',
        keyName: '智谱',
        models: [
            { value: 'glm-4-flash', label: 'glm-4-flash (免费)' },
            { value: 'glm-4-air',   label: 'glm-4-air' },
            { value: 'glm-4-plus',  label: 'glm-4-plus' }
        ]
    }
};

const DEFAULT_CONFIG = {
    provider: 'dashscope',
    apiKeys: {},          // { [providerId]: apiKey } — each provider keeps its own key
    model: 'qwen-plus',
    headingLevel: 1,
    styleTemplate: ''
};

// ─── Heading instruction builder ─────────────────────────────────────────────

function buildHeadingInstruction(level) {
    const h = n => '#'.repeat(n);
    return `标题层级规则：最高级标题使用 ${h(level)}（H${level}），二级标题使用 ${h(level + 1)}，三级标题使用 ${h(level + 2)}，文档中不得出现比 ${h(level)} 级别更高的标题。`;
}

// ─── Document feature extractor ──────────────────────────────────────────────

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

        // Prose sentence density: lines that are 40+ chars starting with a capital letter
        // This signal is near-zero for actual code but high for essays and blog posts
        const proseSentenceRx = /^[A-Z][a-zA-Z].{38,}/;
        const proseDensity = nonEmpty.filter(l => proseSentenceRx.test(l.trim())).length / nonEmpty.length;

        // Code block: 2+ indented lines that also contain code keywords
        const indentedCodeLines = nonEmpty.filter(l => /^(\s{2,}|\t)/.test(l) && codeKwRx.test(l));
        const hasCodeBlock = indentedCodeLines.length >= 2;

        // SQL block: 2+ lines starting with major SQL commands
        const sqlStartRx = /^\s*(SELECT\b|FROM\s+\w|INSERT\s+INTO\b|UPDATE\s+\w|DELETE\s+FROM\b|CREATE\s+(TABLE|INDEX|VIEW)\b|WITH\s+\w+\s+AS\b|GROUP\s+BY\b|ORDER\s+BY\b|HAVING\b)/i;
        const hasSqlBlock = nonEmpty.filter(l => sqlStartRx.test(l)).length >= 2;

        // Technical doc patterns: signals that appear in docs but not in prose or code
        const techDocPatterns = [
            /^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s+\//i, // REST endpoints
            /^--[\w-]+/,                                         // CLI flags
            /^\w[\w.]*:\s+(int|str|string|bool|float|number|void|array|list|object|any)\b/i, // typed params (colon)
            /^\w[\w.-]*\s{3,}(int|str|string|bool|float|number|array|list)\b/i,              // typed params (table)
            /^[A-Z][A-Z_0-9]{3,}\b/,                            // ALL_CAPS identifiers (config/env)
            /^[2-5]\d{2}\s+[A-Z][a-z]/,                         // HTTP status codes
        ];
        const hasTechPatterns = nonEmpty.filter(l => techDocPatterns.some(p => p.test(l.trim()))).length >= 2;

        // Meeting keywords beyond date detection
        const meetKwRx = /\b(attendees?|action\s+items?|agenda|sprint\s+(review|planning|goal|retro)|retrospective|stand[\s-]?up|blockers?|next\s+steps?)\b/i;
        const hasMeetingKeywords = meetKwRx.test(text);

        // First line is a descriptive title (multi-word phrase, no code punctuation)
        // Separates technical docs (open with a title) from raw code (opens with code)
        const firstLine = (nonEmpty[0] || '').trim();
        const firstLineIsTitle =
            firstLine.length >= 3 && firstLine.length <= 50 &&
            /\s/.test(firstLine) &&               // multi-word
            !/[(){}[\];=<>@#]/.test(firstLine) && // no code punctuation
            !/:$/.test(firstLine) &&              // not ending with a colon
            /[a-z]/.test(firstLine);              // has lowercase (excludes ALL-CAPS headers)

        return { codeDensity, indentDepth, upperRatio, hasTable, avgLen, hasDate, hasEmailHeaders, numericDensity, proseDensity, hasCodeBlock, hasSqlBlock, hasTechPatterns, hasMeetingKeywords, firstLineIsTitle, lineCount: nonEmpty.length };
    }

    classify(f) {
        if (f.numericDensity > 0.08 && f.hasTable) return { type: 'data_report', label: '数据报告' };
        if (f.numericDensity > 0.13) return { type: 'data_report', label: '数据报告' };
        // meeting_notes: date + (uppercase OR short lines OR meeting vocabulary)
        if (f.hasDate && (f.upperRatio > 0.08 || f.avgLen < 50 || f.hasMeetingKeywords)) return { type: 'meeting_notes', label: '会议记录' };
        if (f.hasEmailHeaders) return { type: 'meeting_notes', label: '会议记录' };
        if (f.hasMeetingKeywords && f.upperRatio > 0.05) return { type: 'meeting_notes', label: '会议记录' };
        // code_snippet: code-heavy AND does NOT open with a descriptive title line
        if ((f.codeDensity > 0.15 || f.hasSqlBlock) && f.proseDensity < 0.20 && !f.firstLineIsTitle) return { type: 'code_snippet', label: '代码片段' };
        // technical_doc: opens with a title and contains an indented code/config block
        if (f.firstLineIsTitle && f.indentDepth >= 3) return { type: 'technical_doc', label: '技术文档' };
        if (f.codeDensity > 0.02 && f.indentDepth >= 2 && f.proseDensity < 0.50) return { type: 'technical_doc', label: '技术文档' };
        if (f.hasCodeBlock && f.indentDepth >= 2) return { type: 'technical_doc', label: '技术文档' };
        if (f.hasTechPatterns) return { type: 'technical_doc', label: '技术文档' };
        return { type: 'general_prose', label: '通用文本' };
    }

    _empty() {
        return { codeDensity: 0, indentDepth: 0, upperRatio: 0, hasTable: false, avgLen: 0, hasDate: false, hasEmailHeaders: false, numericDensity: 0, proseDensity: 0, hasCodeBlock: false, hasSqlBlock: false, hasTechPatterns: false, hasMeetingKeywords: false, firstLineIsTitle: false, lineCount: 0 };
    }
}

// ─── Document-type prompt configs ────────────────────────────────────────────

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

// ─── Main App ─────────────────────────────────────────────────────────────────

class SidePanelApp {
    constructor() {
        this.config = { ...DEFAULT_CONFIG };
        this.extractor = new DocumentFeatureExtractor();
        this.currentView = 'source';
        this.docTypeAutoDetected = null; // tracks last auto-detected type to allow override detection
        this.init();
    }

    async init() {
        await this.loadConfig();
        this.bindEvents();
        this.updateStats();
        this.getSelectedTextFromPage();
    }

    async loadConfig() {
        const result = await chrome.storage.local.get(['provider', 'apiKeys', 'apiKey', 'model', 'headingLevel', 'styleTemplate']);
        this.config.provider = PROVIDERS[result.provider] ? result.provider : DEFAULT_CONFIG.provider;
        this.config.apiKeys = result.apiKeys || {};
        // migrate legacy single-key config (DashScope-only) to the per-provider map
        if (result.apiKey && !this.config.apiKeys.dashscope) this.config.apiKeys.dashscope = result.apiKey;
        this.config.model = result.model || DEFAULT_CONFIG.model;
        this.config.headingLevel = result.headingLevel != null ? result.headingLevel : DEFAULT_CONFIG.headingLevel;
        this.config.styleTemplate = result.styleTemplate || DEFAULT_CONFIG.styleTemplate;

        this.populateProviders();
        document.getElementById('ai-provider').value = this.config.provider;
        this.populateModels();
        // make sure the saved model belongs to the current provider
        const models = PROVIDERS[this.config.provider].models;
        if (!models.some(m => m.value === this.config.model)) this.config.model = models[0].value;
        document.getElementById('ai-model').value = this.config.model;
        this.applyProviderUI();
        document.getElementById('heading-level').value = this.config.headingLevel;
        document.getElementById('style-template').value = this.config.styleTemplate;
        this.updateStyleCounter(this.config.styleTemplate.length);
    }

    async saveConfig() {
        await chrome.storage.local.set({
            provider: this.config.provider,
            apiKeys: this.config.apiKeys,
            model: this.config.model,
            headingLevel: this.config.headingLevel,
            styleTemplate: this.config.styleTemplate
        });
    }

    // Fill the provider dropdown from the registry
    populateProviders() {
        document.getElementById('ai-provider').innerHTML = Object.entries(PROVIDERS)
            .map(([id, p]) => `<option value="${id}">${p.label}</option>`).join('');
    }

    // Fill the model dropdown for the current provider
    populateModels() {
        document.getElementById('ai-model').innerHTML = PROVIDERS[this.config.provider].models
            .map(m => `<option value="${m.value}">${m.label}</option>`).join('');
    }

    // Reflect the current provider in the key input + help link
    applyProviderUI() {
        const p = PROVIDERS[this.config.provider];
        const keyInput = document.getElementById('api-key');
        keyInput.value = this.config.apiKeys[this.config.provider] || '';
        keyInput.placeholder = `输入 ${p.keyName} API Key`;
        const link = document.getElementById('api-key-link');
        if (link) { link.href = p.keyUrl; link.textContent = `${p.keyName} 控制台`; }
    }

    bindEvents() {
        document.getElementById('toggle-settings').addEventListener('click', () => {
            document.getElementById('settings-content').classList.toggle('collapsed');
        });

        document.getElementById('toggle-key-visibility').addEventListener('click', (e) => {
            const input = document.getElementById('api-key');
            input.type = input.type === 'password' ? 'text' : 'password';
            e.target.textContent = input.type === 'password' ? '显示' : '隐藏';
        });

        document.getElementById('ai-provider').addEventListener('change', (e) => {
            this.config.provider = e.target.value;
            this.populateModels();
            this.config.model = PROVIDERS[this.config.provider].models[0].value;
            document.getElementById('ai-model').value = this.config.model;
            this.applyProviderUI();
            this.saveConfig();
        });

        document.getElementById('api-key').addEventListener('change', (e) => {
            this.config.apiKeys[this.config.provider] = e.target.value;
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
            this.showStatus('风格模板已清除');
        });

        document.getElementById('get-page-text').addEventListener('click', () => this.getSelectedTextFromPage());
        document.getElementById('paste-btn').addEventListener('click', () => this.pasteText());
        document.getElementById('clear-btn').addEventListener('click', () => this.clearAll());
        document.getElementById('sample-btn').addEventListener('click', () => this.loadSample());

        document.getElementById('convert-btn').addEventListener('click', () => this.convert());

        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', () => this.setView(btn.dataset.view));
        });

        document.getElementById('copy-btn').addEventListener('click', () => this.copyOutput());
        document.getElementById('download-btn').addEventListener('click', () => this.downloadOutput());

        // Auto-detect doc type while user types, but respect manual overrides
        document.getElementById('input-text').addEventListener('input', () => {
            this.updateStats();
            this.autoDetectType();
        });
    }

    // Runs local classifier and updates the type selector, unless user has manually overridden it
    autoDetectType() {
        const input = document.getElementById('input-text').value;
        if (!input.trim()) return;

        const features = this.extractor.extract(input);
        const docType = this.extractor.classify(features);
        const select = document.getElementById('doc-type-override');

        // Only auto-update if the current value is 'auto' or still matches the last auto-detected type
        if (select.value === 'auto' || select.value === this.docTypeAutoDetected) {
            select.value = docType.type;
            this.docTypeAutoDetected = docType.type;
        }
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
                this.autoDetectType();
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
            this.autoDetectType();
            this.showStatus('已粘贴剪贴板内容');
        } catch {
            this.showStatus('无法访问剪贴板', 'error');
        }
    }

    clearAll() {
        document.getElementById('input-text').value = '';
        document.getElementById('output-text').value = '';
        document.getElementById('output-text-split').value = '';
        document.getElementById('preview-content').innerHTML = '';
        document.getElementById('preview-content-split').innerHTML = '';
        document.getElementById('doc-type-override').value = 'auto';
        this.docTypeAutoDetected = null;
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
        this.autoDetectType();
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
        const loadingText = document.getElementById('loading-text');

        btn.disabled = true;
        loading.classList.remove('hidden');

        try {
            // Resolve doc type: use manual override if user changed the selector, else auto-detect now
            const selectValue = document.getElementById('doc-type-override').value;
            let docType;

            if (selectValue === 'auto') {
                loadingText.textContent = '分析文档结构...';
                const features = this.extractor.extract(input);
                docType = this.extractor.classify(features);
                document.getElementById('doc-type-override').value = docType.type;
                this.docTypeAutoDetected = docType.type;
            } else {
                docType = { type: selectValue, label: DOC_TYPE_CONFIGS[selectValue].label };
            }

            loadingText.textContent = `${docType.label}，AI 正在转换...`;
            const output = await this.convertWithAI(input, docType.type);

            document.getElementById('output-text').value = output;
            document.getElementById('output-text-split').value = output;
            this.updatePreview(output);
            this.updateStats();
            this.showStatus(`转换完成 · ${docType.label}`, 'success');
        } catch (error) {
            this.showStatus('转换失败: ' + error.message, 'error');
        } finally {
            btn.disabled = false;
            loading.classList.add('hidden');
            loadingText.textContent = '分析文档结构...';
        }
    }

    async convertWithAI(text, docType) {
        const apiKey = this.config.apiKeys[this.config.provider];
        if (!apiKey) throw new Error('请先设置 API Key');

        const typeConfig = DOC_TYPE_CONFIGS[docType] || DOC_TYPE_CONFIGS.general_prose;
        const headingInstruction = buildHeadingInstruction(this.config.headingLevel);
        let prompt = typeConfig.template
            .replace('{HEADING_INSTRUCTION}', headingInstruction)
            .replace('{TEXT}', text);

        if (this.config.styleTemplate && this.config.styleTemplate.trim()) {
            prompt += `\n\n## 用户风格参考\n\n以下是用户提供的 Markdown 风格样例，请模仿其格式习惯（标题选用、分隔符、代码块写法、表格样式等），但不要复制其中的内容：\n\n${this.config.styleTemplate.trim()}\n\n**最终约束（优先级高于上方样例）：** ${headingInstruction}`;
        }

        const response = await fetch(`${PROVIDERS[this.config.provider].baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
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
        // Fix unclosed code blocks (LLM sometimes omits the closing fence at end of output)
        if ((result.match(/^```/gm) || []).length % 2 !== 0) {
            result = result.trimEnd() + '\n```';
        }
        return result;
    }

    updateStyleCounter(len) {
        const counter = document.getElementById('style-template-counter');
        counter.textContent = `${len} / 800`;
        counter.classList.toggle('over-limit', len >= 800);
    }

    async testConnection() {
        const apiKey = this.config.apiKeys[this.config.provider];
        const btn = document.getElementById('test-api');
        if (!apiKey) {
            this.showStatus('请先输入 API Key', 'error');
            return;
        }
        // Feedback on the button itself — the footer status is easy to miss and auto-clears
        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = '测试中…';
        this.showStatus('正在测试连接...');
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15000);
        try {
            // Minimal chat completion — works across every OpenAI-compatible provider
            const response = await fetch(`${PROVIDERS[this.config.provider].baseUrl}/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                body: JSON.stringify({ model: this.config.model, messages: [{ role: 'user', content: 'ping' }], max_tokens: 1 }),
                signal: controller.signal
            });
            if (response.ok) {
                btn.textContent = '✅ 连接成功';
                this.showStatus('连接成功！', 'success');
            } else {
                let detail = `HTTP ${response.status}`;
                try { const e = await response.json(); if (e.error?.message) detail = e.error.message; } catch (_) {}
                btn.textContent = '❌ 连接失败';
                this.showStatus('连接失败: ' + detail, 'error');
            }
        } catch (error) {
            btn.textContent = '❌ 连接失败';
            this.showStatus(error.name === 'AbortError' ? '连接超时（15 秒）' : '连接失败: ' + error.message, 'error');
        } finally {
            clearTimeout(timer);
            btn.disabled = false;
            setTimeout(() => { btn.textContent = originalText; }, 4000);
        }
    }

    // Parse converted Markdown and count structural elements
    analyzeMarkdown(markdown) {
        const headings = (markdown.match(/^#{1,6} /gm) || []).length;
        const codeBlocks = Math.floor((markdown.match(/^```/gm) || []).length / 2);
        const tables = (markdown.match(/^\|[-: |]+\|$/gm) || []).length; // separator rows = table count
        const listItems = (markdown.match(/^[-*+] /gm) || []).length
                        + (markdown.match(/^\d+\. /gm) || []).length;
        return { headings, codeBlocks, tables, listItems };
    }

    updatePreview(markdown) {
        const html = this.markdownToHtml(markdown);
        document.getElementById('preview-content').innerHTML = html;
        document.getElementById('preview-content-split').innerHTML = html;
    }

    markdownToHtml(md) {
        // Tables must be handled as blocks before line-by-line processing,
        // otherwise header/separator/data rows all become <td> with no wrapping structure.
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

        if (output.trim()) {
            const { headings, codeBlocks, tables, listItems } = this.analyzeMarkdown(output);
            const parts = [];
            if (headings > 0) parts.push(`${headings} 个标题`);
            if (codeBlocks > 0) parts.push(`${codeBlocks} 个代码块`);
            if (tables > 0) parts.push(`${tables} 个表格`);
            if (listItems > 0) parts.push(`${listItems} 个列表项`);
            parts.push(`${output.length.toLocaleString()} 字符`);
            document.getElementById('output-stats').textContent = parts.join(' · ');
        } else {
            document.getElementById('output-stats').textContent = '0 字符';
        }
    }

    showStatus(message, type = 'info') {
        const el = document.getElementById('status-text');
        el.textContent = message;
        el.style.color = type === 'error' ? 'var(--error)'
            : type === 'success' ? 'var(--success)'
            : type === 'warning' ? 'var(--warning)'
            : 'var(--text-secondary)';
        setTimeout(() => {
            el.textContent = '就绪';
            el.style.color = 'var(--text-secondary)';
        }, 3000);
    }
}

document.addEventListener('DOMContentLoaded', () => new SidePanelApp());
