// Side panel — 素记 (AI Text to Markdown Converter)

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
            { value: 'glm-4-flash', label: 'glm-4-flash（免费）' },
            { value: 'glm-4v-flash', label: 'glm-4v-flash（免费 / 视觉）' },
            { value: 'glm-4-air',   label: 'glm-4-air' },
            { value: 'glm-4-plus',  label: 'glm-4-plus' }
        ]
    },
    local: {
        label: '本地规则（免费离线）',
        baseUrl: '',
        keyUrl: '',
        keyName: '本地',
        models: [{ value: 'rule-engine', label: '规则引擎（无需 API Key）' }]
    },
    groq: {
        label: 'Groq（免费额度）',
        baseUrl: 'https://api.groq.com/openai/v1',
        keyUrl: 'https://console.groq.com/keys',
        keyName: 'Groq',
        models: [
            { value: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B（免费额度）' },
            { value: 'gemma2-9b-it', label: 'Gemma 2 9B（免费额度）' },
            { value: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B（免费额度）' }
        ]
    },
    openrouter: {
        label: 'OpenRouter（免费模型）',
        baseUrl: 'https://openrouter.ai/api/v1',
        keyUrl: 'https://openrouter.ai/keys',
        keyName: 'OpenRouter',
        models: [
            { value: 'meta-llama/llama-3.1-8b-instruct:free', label: 'Llama 3.1 8B Free' },
            { value: 'google/gemma-2-9b-it:free', label: 'Gemma 2 9B Free' },
            { value: 'mistralai/mistral-7b-instruct:free', label: 'Mistral 7B Free' }
        ]
    },
    gemini: {
        label: 'Google Gemini（免费额度）',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
        keyUrl: 'https://aistudio.google.com/app/apikey',
        keyName: 'Google AI Studio',
        models: [
            { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash（免费额度）' },
            { value: 'gemini-1.5-flash-8b', label: 'Gemini 1.5 Flash 8B（免费额度）' }
        ]
    },
    pollinations: {
        label: 'Pollinations（无需 API Key）',
        baseUrl: 'https://text.pollinations.ai/v1',
        keyUrl: 'https://pollinations.ai/',
        keyName: 'Pollinations',
        requiresKey: false,
        models: [
            { value: 'openai', label: 'OpenAI GPT（匿名免费）' },
            { value: 'claude', label: 'Claude（匿名免费）' },
            { value: 'gemini', label: 'Gemini（匿名免费）' },
            { value: 'deepseek', label: 'DeepSeek（匿名免费）' },
            { value: 'mistral', label: 'Mistral（匿名免费）' },
            { value: 'qwen', label: 'Qwen（匿名免费）' }
        ]
    }
};

const DEFAULT_CONFIG = {
    provider: 'pollinations',
    apiKeys: {},
    model: 'openai',
    headingLevel: 1,
    styleTemplate: '',
    darkMode: false,
    autoCopy: false,
    customPrompts: {},
    streamOutput: true
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

        return { codeDensity, indentDepth, upperRatio, hasTable, avgLen, hasDate, hasEmailHeaders, numericDensity, proseDensity, hasCodeBlock, hasSqlBlock, hasTechPatterns, hasMeetingKeywords, firstLineIsTitle, lineCount: nonEmpty.length };
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
        return { codeDensity: 0, indentDepth: 0, upperRatio: 0, hasTable: false, avgLen: 0, hasDate: false, hasEmailHeaders: false, numericDensity: 0, proseDensity: 0, hasCodeBlock: false, hasSqlBlock: false, hasTechPatterns: false, hasMeetingKeywords: false, firstLineIsTitle: false, lineCount: 0 };
    }
}

const DOC_TYPE_CONFIGS = {
    technical_doc: {
        label: '技术文档',
        system: '你是专业的技术文档格式化专家，擅长将混合了代码、配置和说明的技术文本转换为规范 Markdown。',
        template: `{HEADING_INSTRUCTION}\n\n将以下技术文档转换为 Markdown。规则：\n1. 代码、命令、配置内容用 fenced code block 包裹并标注语言\n2. 函数名、变量名、路径用 \`inline code\` 标记\n3. 参数/选项列表优先转为 Markdown 表格\n4. 保留所有技术细节，不做解释性改动\n\n---\n\n待转换文本：\n{TEXT}`
    },
    meeting_notes: {
        label: '会议记录',
        system: '你是专业的会议记录整理助手，擅长将非结构化会议文本转换为结构清晰的 Markdown。',
        template: `{HEADING_INSTRUCTION}\n\n将以下会议记录转换为 Markdown。规则：\n1. Action items / 待办事项转换为 GitHub 任务列表格式 \`- [ ] 内容\`\n2. 日期时间精确保留，不得修改\n3. 与会人员列为无序列表\n4. 决策结论用粗体标注\n\n---\n\n待转换文本：\n{TEXT}`
    },
    code_snippet: {
        label: '代码片段',
        system: '你是代码文档专家。输入文本主体是源代码，需要正确格式化为带语言标注的 Markdown 代码块。',
        template: `{HEADING_INSTRUCTION}\n\n将以下内容转换为 Markdown。规则：\n1. 代码主体用 fenced code block 包裹并标注编程语言\n2. 注释和说明性文字保留在代码块外作为正文\n3. 多段代码之间用简短说明文字分隔\n4. 只输出 Markdown，不添加原文没有的解释\n\n---\n\n待转换文本：\n{TEXT}`
    },
    data_report: {
        label: '数据报告',
        system: '你是数据报告格式化专家，擅长将含有大量数字、表格和统计数据的文本转换为规范 Markdown。',
        template: `{HEADING_INSTRUCTION}\n\n将以下数据报告转换为 Markdown。规则：\n1. 对齐的列式数据必须转换为 Markdown 表格\n2. 所有数字和百分比精确保留，不得四舍五入或省略\n3. 关键指标（合计、最大值等）用粗体标注\n4. 时间序列数据优先用表格而非列表\n\n---\n\n待转换文本：\n{TEXT}`
    },
    general_prose: {
        label: '通用文本',
        system: '你是专业的文档格式化助手，将纯文本转换为格式规范的 Markdown。',
        template: `{HEADING_INSTRUCTION}\n\n将以下文本转换为 Markdown。规则：\n1. 根据上方标题层级规则分配各级标题\n2. 识别并转换列表、链接、邮箱地址\n3. 如文本中有缩进的代码片段或命令，用 fenced code block 包裹并标注语言\n4. 段落间保持适当空行\n5. 保持原文语义，不添加原文没有的内容\n6. 只输出 Markdown，不要添加解释\n\n---\n\n待转换文本：\n{TEXT}`
    }
};

class SidePanelApp {
    constructor() {
        this.config = { ...DEFAULT_CONFIG };
        this.extractor = new DocumentFeatureExtractor();
        this.currentView = 'source';
        this.docTypeAutoDetected = null;
        this.init();
    }

    async init() {
        await this.loadConfig();
        ThemeManager.apply(this.config.darkMode);
        this.bindEvents();
        this.updateStats();
        this.loadDraft();
        this.renderHistory();
        this.populatePromptDocType();
    }

    async loadConfig() {
        const result = await chrome.storage.local.get([
            'provider', 'apiKeys', 'apiKey', 'model', 'headingLevel',
            'styleTemplate', 'darkMode', 'autoCopy', 'customPrompts', 'streamOutput'
        ]);
        this.config.provider = PROVIDERS[result.provider] ? result.provider : DEFAULT_CONFIG.provider;
        this.config.apiKeys = result.apiKeys || {};
        if (result.apiKey && !this.config.apiKeys.dashscope) this.config.apiKeys.dashscope = result.apiKey;
        this.config.model = result.model || DEFAULT_CONFIG.model;
        this.config.headingLevel = result.headingLevel != null ? result.headingLevel : DEFAULT_CONFIG.headingLevel;
        this.config.styleTemplate = result.styleTemplate || DEFAULT_CONFIG.styleTemplate;
        this.config.darkMode = result.darkMode != null ? result.darkMode : DEFAULT_CONFIG.darkMode;
        this.config.autoCopy = result.autoCopy != null ? result.autoCopy : DEFAULT_CONFIG.autoCopy;
        this.config.customPrompts = result.customPrompts || DEFAULT_CONFIG.customPrompts;
        this.config.streamOutput = result.streamOutput != null ? result.streamOutput : DEFAULT_CONFIG.streamOutput;

        this.populateProviders();
        document.getElementById('ai-provider').value = this.config.provider;
        this.populateModels();
        const models = PROVIDERS[this.config.provider].models;
        if (!models.some(m => m.value === this.config.model)) this.config.model = models[0].value;
        document.getElementById('ai-model').value = this.config.model;
        this.applyProviderUI();
        document.getElementById('heading-level').value = this.config.headingLevel;
        document.getElementById('style-template').value = this.config.styleTemplate;
        document.getElementById('auto-copy').checked = this.config.autoCopy;
        this.updateStyleCounter(this.config.styleTemplate.length);
        this.updateThemeIcon();
    }

    async saveConfig() {
        await chrome.storage.local.set({
            provider: this.config.provider,
            apiKeys: this.config.apiKeys,
            model: this.config.model,
            headingLevel: this.config.headingLevel,
            styleTemplate: this.config.styleTemplate,
            darkMode: this.config.darkMode,
            autoCopy: this.config.autoCopy,
            customPrompts: this.config.customPrompts,
            streamOutput: this.config.streamOutput
        });
    }

    populateProviders() {
        document.getElementById('ai-provider').innerHTML = Object.entries(PROVIDERS)
            .map(([id, p]) => `<option value="${id}">${p.label}</option>`).join('');
    }

    populateModels() {
        document.getElementById('ai-model').innerHTML = PROVIDERS[this.config.provider].models
            .map(m => `<option value="${m.value}">${m.label}</option>`).join('');
    }

    applyProviderUI() {
        const p = PROVIDERS[this.config.provider];
        const keyInput = document.getElementById('api-key');
        const link = document.getElementById('api-key-link');
        const testBtn = document.getElementById('test-api');
        const toggleKeyBtn = document.getElementById('toggle-key-visibility');

        if (this.config.provider === 'local') {
            keyInput.value = '';
            keyInput.placeholder = '本地模式无需 API Key';
            keyInput.disabled = true;
            if (toggleKeyBtn) toggleKeyBtn.disabled = true;
            if (link) { link.href = '#'; link.textContent = '本地规则引擎，无需联网'; }
            if (testBtn) { testBtn.textContent = '本地模式'; testBtn.disabled = true; }
            return;
        }

        if (p.requiresKey === false) {
            keyInput.value = '';
            keyInput.placeholder = '该提供商无需 API Key';
            keyInput.disabled = true;
            if (toggleKeyBtn) toggleKeyBtn.disabled = true;
            if (link) { link.href = p.keyUrl; link.textContent = '访问 Pollinations 官网'; }
            if (testBtn) { testBtn.textContent = '测试连接'; testBtn.disabled = false; }
            return;
        }

        keyInput.disabled = false;
        if (toggleKeyBtn) toggleKeyBtn.disabled = false;
        keyInput.value = this.config.apiKeys[this.config.provider] || '';
        keyInput.placeholder = `输入 ${p.keyName} API Key`;
        if (link) { link.href = p.keyUrl; link.textContent = `${p.keyName} 控制台`; }
        if (testBtn) { testBtn.textContent = '测试连接'; testBtn.disabled = false; }
    }

    bindEvents() {
        document.getElementById('toggle-settings').addEventListener('click', () => {
            document.getElementById('settings-content').classList.toggle('collapsed');
        });

        document.getElementById('toggle-history').addEventListener('click', () => {
            document.getElementById('history-panel').classList.toggle('collapsed');
        });

        document.getElementById('theme-toggle').addEventListener('click', async () => {
            this.config.darkMode = await ThemeManager.toggle();
            this.saveConfig();
            this.updateThemeIcon();
        });

        document.getElementById('toggle-key-visibility').addEventListener('click', (e) => {
            const input = document.getElementById('api-key');
            input.type = input.type === 'password' ? 'text' : 'password';
            e.target.textContent = input.type === 'password' ? '显示' : '隐藏';
        });

        document.getElementById('auto-copy').addEventListener('change', (e) => {
            this.config.autoCopy = e.target.checked;
            this.saveConfig();
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

        document.getElementById('prompt-doc-type').addEventListener('change', () => this.loadPromptEditor());
        document.getElementById('save-prompt').addEventListener('click', () => this.saveCustomPrompt());
        document.getElementById('reset-prompt').addEventListener('click', () => this.resetCustomPrompt());

        document.getElementById('get-page-text').addEventListener('click', () => this.getSelectedTextFromPage());
        document.getElementById('get-page-content').addEventListener('click', () => this.getFullPageContent());
        document.getElementById('paste-btn').addEventListener('click', () => this.pasteText());
        document.getElementById('clear-btn').addEventListener('click', () => this.clearAll());
        document.getElementById('sample-btn').addEventListener('click', () => this.loadSample());

        document.getElementById('convert-btn').addEventListener('click', () => this.convert());

        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', () => this.setView(btn.dataset.view));
        });

        document.getElementById('copy-btn').addEventListener('click', () => this.copyOutput());
        document.getElementById('download-btn').addEventListener('click', () => this.downloadOutput());

        const saveDraftDebounced = debounce((text) => DraftManager.save(text), 500);
        document.getElementById('input-text').addEventListener('input', () => {
            this.updateStats();
            this.autoDetectType();
            saveDraftDebounced(document.getElementById('input-text').value);
        });
    }

    updateThemeIcon() {
        const icon = document.querySelector('#theme-toggle .icon use');
        if (icon) icon.setAttribute('href', this.config.darkMode ? '#icon-sun' : '#icon-moon');
    }

    populatePromptDocType() {
        const select = document.getElementById('prompt-doc-type');
        select.innerHTML = Object.entries(DOC_TYPE_CONFIGS)
            .map(([id, cfg]) => `<option value="${id}">${cfg.label}</option>`).join('');
        this.loadPromptEditor();
    }

    loadPromptEditor() {
        const type = document.getElementById('prompt-doc-type').value;
        const custom = this.config.customPrompts[type];
        const defaults = DOC_TYPE_CONFIGS[type];
        document.getElementById('custom-system').value = custom?.system || defaults.system;
        document.getElementById('custom-template').value = custom?.template || defaults.template;
    }

    saveCustomPrompt() {
        const type = document.getElementById('prompt-doc-type').value;
        this.config.customPrompts[type] = {
            system: document.getElementById('custom-system').value,
            template: document.getElementById('custom-template').value
        };
        this.saveConfig();
        this.showStatus('自定义提示词已保存', 'success');
    }

    resetCustomPrompt() {
        const type = document.getElementById('prompt-doc-type').value;
        delete this.config.customPrompts[type];
        this.saveConfig();
        this.loadPromptEditor();
        this.showStatus('已恢复默认提示词', 'success');
    }

    getDocTypeConfig(type) {
        const defaults = DOC_TYPE_CONFIGS[type] || DOC_TYPE_CONFIGS.general_prose;
        const custom = this.config.customPrompts[type];
        if (!custom) return defaults;
        return {
            label: defaults.label,
            system: custom.system || defaults.system,
            template: custom.template || defaults.template
        };
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
            if (!tab || !tab.id) {
                this.showStatus('未找到当前标签页', 'error');
                return;
            }
            if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('https://chrome.google.com/webstore/'))) {
                this.showStatus('该页面不支持提取文字', 'warning');
                return;
            }
            const response = await chrome.tabs.sendMessage(tab.id, { action: 'getSelectedText' });
            const selectedText = response?.text || '';
            if (selectedText) {
                document.getElementById('input-text').value = selectedText;
                this.updateStats();
                this.autoDetectType();
                this.showStatus(`已获取页面选中文字 · ${selectedText.length} 字符`);
            } else {
                this.showStatus('请先在页面中选中文字', 'warning');
            }
        } catch (err) {
            this.showStatus('无法获取选中文字: ' + (err.message || '请刷新页面后重试'), 'error');
        }
    }

    async getFullPageContent() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab || !tab.id) {
                this.showStatus('未找到当前标签页', 'error');
                return;
            }
            if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('https://chrome.google.com/webstore/'))) {
                this.showStatus('该页面不支持提取正文', 'warning');
                return;
            }
            const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractPageContent' });
            const text = response?.text || '';
            if (text && text.length > 50) {
                document.getElementById('input-text').value = text;
                this.updateStats();
                this.autoDetectType();
                this.showStatus(`已获取整页正文 · ${text.length} 字符`);
            } else {
                this.showStatus('页面正文内容太少', 'warning');
            }
        } catch (err) {
            this.showStatus('无法获取页面正文: ' + (err.message || '请刷新页面后重试'), 'error');
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
        DraftManager.clear();
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
        loadingText.textContent = '分析文档结构...';

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

            loadingText.textContent = `${docType.label}，AI 正在转换...`;
            const output = await this.convertWithAI(input, docType.type);

            document.getElementById('output-text').value = output;
            document.getElementById('output-text-split').value = output;
            this.updatePreview(output);
            this.updateStats();

            await HistoryManager.add({
                docType: docType.type,
                docLabel: docType.label,
                input: input,
                inputPreview: truncate(input, 120),
                output: output
            });
            this.renderHistory();

            if (this.config.autoCopy) {
                await this.copyOutput();
                this.showStatus('已自动复制到剪贴板', 'success');
            } else {
                this.showStatus(`转换完成 · ${docType.label}`, 'success');
            }

            DraftManager.clear();
        } catch (error) {
            this.showStatus('转换失败: ' + error.message, 'error');
        } finally {
            btn.disabled = false;
            loading.classList.add('hidden');
            loadingText.textContent = '分析文档结构...';
        }
    }

    async convertWithAI(text, docType) {
        if (this.config.provider === 'local') {
            return LocalMarkdownConverter.convert(text, docType, this.config.headingLevel);
        }

        const p = PROVIDERS[this.config.provider];
        const apiKey = this.config.apiKeys[this.config.provider];
        if (p.requiresKey !== false && !apiKey) {
            throw new Error('请先设置 API Key，或切换到「本地规则（免费离线）」模式');
        }

        const typeConfig = this.getDocTypeConfig(docType);
        const headingInstruction = buildHeadingInstruction(this.config.headingLevel);
        let prompt = typeConfig.template
            .replace('{HEADING_INSTRUCTION}', headingInstruction)
            .replace('{TEXT}', text);

        if (this.config.styleTemplate && this.config.styleTemplate.trim()) {
            prompt += `\n\n## 用户风格参考\n\n以下是用户提供的 Markdown 风格样例，请模仿其格式习惯（标题选用、分隔符、代码块写法、表格样式等），但不要复制其中的内容：\n\n${this.config.styleTemplate.trim()}\n\n**最终约束（优先级高于上方样例）：** ${headingInstruction}`;
        }

        // Estimate prompt tokens conservatively (~2 chars per token for CJK-heavy text)
        const promptTokens = Math.ceil(prompt.length / 2);
        const contextWindow = 8192; // safe minimum for supported models
        const reservedTokens = 256; // buffer for system overhead
        const maxTokens = Math.min(4096, Math.max(1024, contextWindow - promptTokens - reservedTokens));

        const requestBody = {
            model: this.config.model,
            messages: [
                { role: 'system', content: typeConfig.system },
                { role: 'user', content: prompt }
            ],
            temperature: 0.3,
            max_tokens: maxTokens
        };

        if (this.config.streamOutput) {
            requestBody.stream = true;
        }

        const headers = { 'Content-Type': 'application/json' };
        if (p.requiresKey !== false) {
            headers['Authorization'] = `Bearer ${apiKey}`;
        }

        const response = await fetch(`${p.baseUrl}/chat/completions`, {
            method: 'POST',
            headers,
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error?.message || `HTTP ${response.status}`);
        }

        if (this.config.streamOutput && response.headers.get('content-type')?.includes('text/event-stream')) {
            return await this.streamResponse(response);
        }

        const data = await response.json();
        if (data.choices?.[0]?.finish_reason === 'length') {
            throw new Error('输出因长度限制被截断，请缩短输入文本或选择更大上下文模型');
        }
        let result = data.choices[0].message.content;
        result = result.replace(/^```markdown\n/, '').replace(/^```\n/, '').replace(/\n```$/, '');
        if ((result.match(/^```/gm) || []).length % 2 !== 0) {
            result = result.trimEnd() + '\n```';
        }
        return result;
    }

    async streamResponse(response) {
        const outputEl = document.getElementById('output-text');
        const splitEl = document.getElementById('output-text-split');
        const loadingText = document.getElementById('loading-text');
        outputEl.value = '';
        splitEl.value = '';
        let buffer = '';
        let finishReason = null;

        for await (const chunk of StreamingParser.parseStream(response)) {
            finishReason = chunk.finishReason || finishReason;
            buffer += chunk.content;
            outputEl.value = buffer;
            splitEl.value = buffer;
            this.updatePreview(buffer);
            if (loadingText) loadingText.textContent = 'AI 正在生成...';
            outputEl.scrollTop = outputEl.scrollHeight;
        }

        let result = buffer.replace(/^```markdown\n/, '').replace(/^```\n/, '').replace(/\n```$/, '');
        if ((result.match(/^```/gm) || []).length % 2 !== 0) {
            result = result.trimEnd() + '\n```';
        }
        outputEl.value = result;
        splitEl.value = result;
        this.updatePreview(result);

        if (finishReason === 'length') {
            throw new Error('输出因长度限制被截断，请缩短输入文本或选择更大上下文模型');
        }

        return result;
    }

    updateStyleCounter(len) {
        const counter = document.getElementById('style-template-counter');
        counter.textContent = `${len} / 800`;
        counter.classList.toggle('over-limit', len >= 800);
    }

    async testConnection() {
        if (this.config.provider === 'local') {
            this.showStatus('本地模式无需测试连接', 'success');
            return;
        }

        const p = PROVIDERS[this.config.provider];
        const apiKey = this.config.apiKeys[this.config.provider];
        const btn = document.getElementById('test-api');
        if (p.requiresKey !== false && !apiKey) {
            this.showStatus('请先输入 API Key，或切换到本地模式', 'error');
            return;
        }
        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = '测试中…';
        this.showStatus('正在测试连接...');
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15000);
        try {
            const headers = { 'Content-Type': 'application/json' };
            if (p.requiresKey !== false) {
                headers['Authorization'] = `Bearer ${apiKey}`;
            }
            const response = await fetch(`${p.baseUrl}/chat/completions`, {
                method: 'POST',
                headers,
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

    analyzeMarkdown(markdown) {
        const headings = (markdown.match(/^#{1,6} /gm) || []).length;
        const codeBlocks = Math.floor((markdown.match(/^```/gm) || []).length / 2);
        const tables = (markdown.match(/^\|[-: |]+\|$/gm) || []).length;
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
        if (!md) return '';
        const escapeHtml = (text) => String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');

        // Extract fenced code blocks first so their content is highlighted, not escaped
        const codeBlocks = [];
        md = md.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
            const placeholder = `\u0000CODEBLOCK${codeBlocks.length}\u0000`;
            const highlighted = SyntaxHighlighter.highlight(code, lang || '');
            codeBlocks.push(`<pre><code class="language-${escapeHtml(lang || 'text')}">${highlighted}</code></pre>`);
            return placeholder;
        });

        // Escape remaining HTML before applying markdown replacements
        md = escapeHtml(md);

        // Tables
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

        // Inline elements and headings (content is already escaped)
        const safeUrl = (url) => {
            const u = String(url).trim();
            if (/^(https?|mailto):/i.test(u)) return u;
            return '#';
        };

        md = md
            .replace(/^#{6} (.+)$/gm, '<h6>$1</h6>')
            .replace(/^#{5} (.+)$/gm, '<h5>$1</h5>')
            .replace(/^#{4} (.+)$/gm, '<h4>$1</h4>')
            .replace(/^#{3} (.+)$/gm, '<h3>$1</h3>')
            .replace(/^#{2} (.+)$/gm, '<h2>$1</h2>')
            .replace(/^#{1} (.+)$/gm, '<h1>$1</h1>')
            .replace(/^\- \[ \] (.+)$/gm, '<li><input type="checkbox" disabled> $1</li>')
            .replace(/^\- \[x\] (.+)$/gm, '<li><input type="checkbox" checked disabled> $1</li>')
            .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/\*([^*]+)\*/g, '<em>$1</em>')
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, href) => `<a href="${safeUrl(href)}" target="_blank">${text}</a>`)
            .replace(/\n/g, '<br>');

        // Restore code blocks
        codeBlocks.forEach((html, i) => {
            md = md.replace(`\u0000CODEBLOCK${i}\u0000`, html);
        });

        return md;
    }

    async renderHistory() {
        const panel = document.getElementById('history-panel');
        const history = await HistoryManager.getAll();
        if (history.length === 0) {
            panel.innerHTML = '<div class="history-empty">暂无历史记录</div>';
            return;
        }

        const escapeHtml = (text) => String(text ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');

        panel.innerHTML = history.map(item => `
            <div class="history-item" data-id="${item.id}">
                <div class="history-item-header">
                    <span class="history-item-type">${escapeHtml(item.docLabel)}</span>
                    <span class="history-item-time">${escapeHtml(HistoryManager.formatDate(item.timestamp))}</span>
                </div>
                <div class="history-item-preview">${escapeHtml(truncate(item.inputPreview, 80))}</div>
            </div>
        `).join('') + `
            <div class="history-actions">
                <button id="clear-history" class="btn-small secondary">清空历史</button>
            </div>
        `;

        panel.querySelectorAll('.history-item').forEach(el => {
            el.addEventListener('click', () => {
                const item = history.find(h => h.id === el.dataset.id);
                if (item) {
                    document.getElementById('input-text').value = item.input || item.inputPreview;
                    document.getElementById('output-text').value = item.output;
                    document.getElementById('output-text-split').value = item.output;
                    this.updatePreview(item.output);
                    this.updateStats();
                    this.showStatus('已加载历史记录');
                }
            });
        });

        const clearBtn = panel.querySelector('#clear-history');
        if (clearBtn) {
            clearBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await HistoryManager.clear();
                this.renderHistory();
                this.showStatus('历史记录已清空');
            });
        }
    }

    async copyOutput() {
        const output = document.getElementById('output-text');
        try {
            await navigator.clipboard.writeText(output.value);
            this.showStatus('已复制到剪贴板', 'success');
        } catch {
            output.select();
            document.execCommand('copy');
            this.showStatus('已复制到剪贴板', 'success');
        }
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

    async loadDraft() {
        const draft = await DraftManager.load();
        if (draft && !document.getElementById('input-text').value) {
            document.getElementById('input-text').value = draft;
            this.updateStats();
            this.autoDetectType();
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
