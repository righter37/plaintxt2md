// Shared utilities for popup and sidepanel

// ─── Theme / Dark mode ───────────────────────────────────────────────────────

const ThemeManager = {
    async load() {
        const result = await chrome.storage.local.get(['darkMode']);
        return !!result.darkMode;
    },
    async save(enabled) {
        await chrome.storage.local.set({ darkMode: enabled });
    },
    apply(enabled) {
        document.documentElement.classList.toggle('dark', enabled);
        document.body.classList.toggle('dark', enabled);
    },
    async toggle() {
        const current = await this.load();
        const next = !current;
        await this.save(next);
        this.apply(next);
        return next;
    }
};

// ─── Conversion history ──────────────────────────────────────────────────────

const HistoryManager = {
    MAX_ITEMS: 50,
    async getAll() {
        const result = await chrome.storage.local.get(['conversionHistory']);
        return result.conversionHistory || [];
    },
    async add(item) {
        const history = await this.getAll();
        const input = item.input || '';
        const record = {
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
            timestamp: Date.now(),
            docType: item.docType || 'general_prose',
            docLabel: item.docLabel || '通用文本',
            input: input,
            inputPreview: item.inputPreview || input.slice(0, 120),
            output: item.output || ''
        };
        history.unshift(record);
        if (history.length > this.MAX_ITEMS) history.length = this.MAX_ITEMS;
        await chrome.storage.local.set({ conversionHistory: history });
        return record;
    },
    async delete(id) {
        const history = await this.getAll();
        const filtered = history.filter(h => h.id !== id);
        await chrome.storage.local.set({ conversionHistory: filtered });
    },
    async clear() {
        await chrome.storage.local.set({ conversionHistory: [] });
    },
    formatDate(ts) {
        const d = new Date(ts);
        return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }
};

// ─── Input draft auto-save ───────────────────────────────────────────────────

const DraftManager = {
    async save(text) {
        await chrome.storage.local.set({ inputDraft: text });
    },
    async load() {
        const result = await chrome.storage.local.get(['inputDraft']);
        return result.inputDraft || '';
    },
    async clear() {
        await chrome.storage.local.remove('inputDraft');
    }
};

// ─── Streaming SSE parser ────────────────────────────────────────────────────

const StreamingParser = {
    // Returns an async generator yielding { content: string, finishReason: string|null }
    async* parseStream(response) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        const processLines = (text) => {
            buffer += text;
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            return lines;
        };

        const parseLine = (line) => {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data:')) return null;
            const data = trimmed.slice(5).trim();
            if (data === '[DONE]') return { done: true };
            try {
                const json = JSON.parse(data);
                const choice = json.choices?.[0];
                const delta = choice?.delta;
                const finishReason = choice?.finish_reason || null;
                if (delta?.content || finishReason) {
                    return { chunk: { content: delta?.content || '', finishReason } };
                }
            } catch (e) {
                // ignore malformed JSON lines
            }
            return null;
        };

        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                // Flush decoder and process any final bytes
                const final = decoder.decode(new Uint8Array(0), { stream: false });
                for (const line of processLines(final)) {
                    const result = parseLine(line);
                    if (result?.done) return;
                    if (result?.chunk) yield result.chunk;
                }
                break;
            }
            const chunk = decoder.decode(value, { stream: true });
            for (const line of processLines(chunk)) {
                const result = parseLine(line);
                if (result?.done) return;
                if (result?.chunk) yield result.chunk;
            }
        }
    }
};

// ─── Simple syntax highlighter ───────────────────────────────────────────────

const SyntaxHighlighter = {
    // Map of common languages to token patterns
    languages: {
        javascript: {
            keywords: /\b(const|let|var|function|return|if|else|for|while|class|import|export|from|async|await|new|this|try|catch|throw|typeof|instanceof)\b/g,
            strings: /(`[^`]*`|'[^']*'|"[^"]*")/g,
            comments: /(\/\/.*$|\/\*[\s\S]*?\*\/)/gm,
            numbers: /\b\d+(\.\d+)?\b/g
        },
        python: {
            keywords: /\b(def|class|return|if|elif|else|for|while|import|from|as|try|except|with|lambda|None|True|False)\b/g,
            strings: /("""[\s\S]*?"""|'''[\s\S]*?'''|"[^"]*"|'[^']*')/g,
            comments: /#.*/g,
            numbers: /\b\d+(\.\d+)?\b/g
        },
        bash: {
            keywords: /\b(if|then|else|fi|for|while|do|done|echo|export|source|cd|ls|cat|grep|sed|awk)\b/g,
            strings: /("[^"]*"|'[^']*')/g,
            comments: /#.*/g,
            numbers: /\b\d+\b/g
        },
        sql: {
            keywords: /\b(SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|CREATE|TABLE|JOIN|LEFT|RIGHT|INNER|OUTER|ON|GROUP|ORDER|BY|HAVING|LIMIT|VALUES|AND|OR|NOT|NULL|AS)\b/gi,
            strings: /('[^']*')/g,
            comments: /--.*/g,
            numbers: /\b\d+(\.\d+)?\b/g
        },
        json: {
            keys: /"([^"]+)":/g,
            strings: /"[^"]*"/g,
            numbers: /\b\d+(\.\d+)?\b/g,
            booleans: /\b(true|false|null)\b/g
        }
    },

    detectLanguage(code) {
        if (/^(\{|\[)\s*["']/.test(code.trim())) return 'json';
        if (/\bdef\s+\w+\s*\(/.test(code)) return 'python';
        if (/\b(function|const|let|var)\b/.test(code) || /=>/.test(code)) return 'javascript';
        if (/\b(SELECT|FROM|WHERE)\b/i.test(code)) return 'sql';
        if (/\b(if|then|fi|for|do|done|echo)\b/.test(code) || /^(npm|pip|curl|git)\b/m.test(code)) return 'bash';
        return 'javascript';
    },

    escapeHtml(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    },

    highlight(code, lang) {
        const rules = this.languages[lang] || this.languages[this.detectLanguage(code)];

        // Build ordered token list to avoid nested replacements
        const tokens = [];
        const addTokens = (regex, className) => {
            if (!regex) return;
            let match;
            const localRegex = new RegExp(regex.source, regex.flags);
            while ((match = localRegex.exec(code)) !== null) {
                tokens.push({ start: match.index, end: match.index + match[0].length, text: match[0], className });
                if (localRegex.lastIndex === match.index) localRegex.lastIndex++;
            }
        };

        addTokens(rules.comments, 'sh-comment');
        addTokens(rules.strings, 'sh-string');
        addTokens(rules.keywords, 'sh-keyword');
        addTokens(rules.numbers, 'sh-number');
        addTokens(rules.keys, 'sh-key');
        addTokens(rules.booleans, 'sh-boolean');

        // Sort by start, longer first for ties
        tokens.sort((a, b) => a.start - b.start || b.end - a.end);

        // Remove overlapping tokens
        const clean = [];
        let lastEnd = -1;
        for (const t of tokens) {
            if (t.start >= lastEnd) {
                clean.push(t);
                lastEnd = t.end;
            }
        }

        // Build HTML by escaping each segment in original code order
        let html = '';
        let pos = 0;
        for (const t of clean) {
            if (t.start > pos) {
                html += this.escapeHtml(code.substring(pos, t.start));
            }
            html += `<span class="${t.className}">${this.escapeHtml(t.text)}</span>`;
            pos = t.end;
        }
        if (pos < code.length) {
            html += this.escapeHtml(code.substring(pos));
        }

        return html || this.escapeHtml(code);
    }
};

// ─── Page content extraction ─────────────────────────────────────────────────

const PageExtractor = {
    // Heuristic extraction of main article content
    extractMainContent() {
        const removeSelectors = [
            'nav', 'header', 'footer', 'aside', '.sidebar', '.ads', '.advertisement',
            '#comments', '.comments', '.related', '.recommend', '.share', '.social',
            'script', 'style', 'noscript', 'iframe', 'svg', 'canvas', 'video', 'audio'
        ];

        // Try to find article/main/content area
        const candidates = Array.from(document.querySelectorAll('article, main, [role="main"], .post, .entry, .content, .article'));
        let root = document.body;

        if (candidates.length > 0) {
            // Pick the one with most text content
            root = candidates.reduce((best, el) => {
                return el.innerText.length > best.innerText.length ? el : best;
            }, candidates[0]);
        }

        // Clone to avoid modifying page
        const clone = root.cloneNode(true);
        removeSelectors.forEach(sel => {
            clone.querySelectorAll(sel).forEach(el => el.remove());
        });

        // Remove elements with very little text (likely menus)
        clone.querySelectorAll('*').forEach(el => {
            if (el.children.length > 0 && el.innerText.length < 30) {
                const tag = el.tagName.toLowerCase();
                if (tag === 'div' || tag === 'section') {
                    el.remove();
                }
            }
        });

        // Clean up whitespace
        let text = clone.innerText || '';
        text = text.replace(/\n{3,}/g, '\n\n').trim();

        // Fallback to selection if extraction is too short/empty
        if (!text || text.length < 50) {
            text = window.getSelection().toString();
        }

        return text;
    }
};

// ─── Utility helpers ─────────────────────────────────────────────────────────

function debounce(fn, ms) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), ms);
    };
}

function truncate(str, maxLen) {
    if (!str) return '';
    str = str.replace(/\s+/g, ' ').trim();
    return str.length > maxLen ? str.slice(0, maxLen) + '…' : str;
}


// ─── Local rule-based Markdown converter (free / offline) ────────────────────

const LocalMarkdownConverter = {
    convert(text, docType = 'general_prose', headingLevel = 1) {
        if (!text || !text.trim()) return '';

        const lines = text.split('\n');
        const result = [];
        let i = 0;

        const h = (level) => '#'.repeat(Math.min(Math.max(level, 1), 6));
        const baseLevel = headingLevel;

        const codeKwRx = /\b(function|class|def|const|let|var|return|import|from|select|if|for|while|public|private|void|int|float|double|bool|#include|namespace|struct|interface|extends|implements|fn|func|async|await|enum|impl|trait)\b/i;
        const sqlStartRx = /^\s*(SELECT\b|FROM\s+\w|INSERT\s+INTO\b|UPDATE\s+\w|DELETE\s+FROM\b|CREATE\s+(TABLE|INDEX|VIEW)\b|WITH\s+\w+\s+AS\b|GROUP\s+BY\b|ORDER\s+BY\b|HAVING\b)/i;

        const isUnderlineTitle = (line, nextLine) => {
            if (!nextLine) return false;
            const trimmed = line.trim();
            const nextTrimmed = nextLine.trim();
            return trimmed.length > 0 && trimmed.length < 60 &&
                   (/^[=-]{3,}$/.test(nextTrimmed) && nextTrimmed.length >= trimmed.length * 0.8);
        };

        const isAllCapsHeading = (line) => {
            const t = line.trim();
            return t.length >= 3 && t.length <= 50 && t === t.toUpperCase() && /[A-Z]/.test(t) && !/[:;,.!?]$/.test(t);
        };

        const isLikelyHeading = (line, index, allowAfterHeading = false) => {
            const t = line.trim();
            if (t.length < 3 || t.length > 60) return false;
            if (/[:;,.!?]$/.test(t)) return false;
            if (/^[•·\-\*\d]/.test(t)) return false;
            if (t.includes('@') || t.includes('http')) return false;
            if (!allowAfterHeading && index > 0 && lines[index - 1].trim() && !isAllCapsHeading(lines[index - 1].trim())) return false;
            return true;
        };

        const isIndentedHeading = (line, index) => {
            const t = line.trim();
            if (t.length < 3 || t.length > 50) return false;
            if (/[:;,.!?]$/.test(t)) return false;
            if (/^[•·\-\*\d]/.test(t)) return false;
            if (t.includes('@') || t.includes('http')) return false;
            if (codeKwRx.test(t) && /[;=<>{}()]/.test(t)) return false; // not a code line
            return true;
        };

        const isBullet = (line) => /^\s*[•·\-\*]\s+/.test(line);
        const isNumbered = (line) => /^\s*\d+[.\)]\s+/.test(line);
        const isTableSeparator = (line) => /^\|[\s\-:|]+\|$/.test(line.trim());
        const getIndent = (line) => line.match(/^(\s*)/)[1].length;

        const detectCodeLanguage = (firstLine) => {
            const t = firstLine.trim();
            if (/^(import|from|def|class)\s/.test(t) || /^#/.test(t) || /^(print|return|if|for|while)\b/.test(t)) return 'python';
            if (/^(const|let|var|function|import|export|class)\b/.test(t) || /=>/.test(t)) return 'javascript';
            if (/^(public|private|class|interface|package)\b/.test(t)) return 'java';
            if (/^#include\b/.test(t) || /^using\s+namespace\b/.test(t)) return 'cpp';
            if (/^\s*(SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|CREATE)\b/i.test(t)) return 'sql';
            return 'text';
        };

        const looksLikeCode = (line) => {
            const t = line.trim();
            if (codeKwRx.test(t)) return true;
            if (sqlStartRx.test(t)) return true;
            if (/^([\[{]|\(\))/.test(t)) return true;
            if (/[;=<>{}()]/.test(t) && /[A-Za-z]/.test(t)) return true;
            return false;
        };

        const processInline = (line) => {
            // URLs
            line = line.replace(/(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g, '[$1]($1)');
            // Emails
            line = line.replace(/\b([\w.-]+@[\w.-]+\.[a-zA-Z]{2,})\b/g, '[$1](mailto:$1)');
            // Bold for ALL_CAPS keywords (tech terms)
            line = line.replace(/\b([A-Z][A-Z_0-9]{2,})\b/g, '**$1**');
            return line;
        };

        const classifyLine = (line, index) => {
            const trimmed = line.trim();
            if (!trimmed) return 'empty';
            if (isBullet(line)) return 'bullet';
            if (isNumbered(line)) return 'numbered';
            if (isUnderlineTitle(trimmed, lines[index + 1])) return 'title-underline';
            if (isAllCapsHeading(trimmed)) return 'heading';
            if (isTableSeparator(trimmed)) return 'table-sep';
            if (trimmed.startsWith('|') && trimmed.endsWith('|')) return 'table';
            const indent = getIndent(line);
            if (indent >= 4 && looksLikeCode(trimmed)) return 'code';
            if (indent >= 2 && isIndentedHeading(trimmed, index)) return 'indented-heading';
            if (indent === 0 && isLikelyHeading(trimmed, index)) return 'heading';
            if (docType === 'technical_doc' && indent < 4 && codeKwRx.test(trimmed)) return 'code-start';
            return 'text';
        };

        while (i < lines.length) {
            const line = lines[i];
            const type = classifyLine(line, i);

            if (type === 'empty') {
                result.push('');
                i++;
                continue;
            }

            if (type === 'title-underline') {
                result.push(`${h(baseLevel)} ${processInline(line.trim())}`);
                i += 2; // skip underline
                continue;
            }

            if (type === 'heading') {
                result.push(`${h(baseLevel + 1)} ${processInline(line.trim())}`);
                i++;
                continue;
            }

            if (type === 'indented-heading') {
                const indent = getIndent(line);
                const level = Math.min(baseLevel + Math.floor(indent / 2), 6);
                result.push(`${h(level)} ${processInline(line.trim())}`);
                i++;
                continue;
            }

            if (type === 'code' || type === 'code-start') {
                const codeLines = [];
                let lang = detectCodeLanguage(line);
                let braceBalance = 0;
                let baseIndent = null;
                while (i < lines.length) {
                    const cl = lines[i];
                    if (cl.trim() === '' && codeLines.length > 0) {
                        codeLines.push('');
                        i++;
                        continue;
                    }
                    const clType = classifyLine(cl, i);
                    const trimmedCl = cl.trim();
                    const isClosingOnly = /^[\s}\)\]]+$/.test(cl);
                    const isInBlock = codeLines.length > 0;

                    // Track brace balance to avoid cutting off closing braces
                    for (const ch of trimmedCl) {
                        if (ch === '{' || ch === '(' || ch === '[') braceBalance++;
                        if (ch === '}' || ch === ')' || ch === ']') braceBalance--;
                    }

                    const shouldInclude = clType === 'code' || clType === 'code-start' ||
                                          (getIndent(cl) >= 4 && looksLikeCode(trimmedCl)) ||
                                          (isInBlock && (isClosingOnly || trimmedCl === '')) ||
                                          (isInBlock && braceBalance > 0);

                    if (shouldInclude) {
                        if (baseIndent === null) baseIndent = getIndent(cl);
                        const unindented = cl.length >= baseIndent ? cl.slice(baseIndent) : cl.trimStart();
                        codeLines.push(unindented);
                        i++;
                    } else if (isInBlock) {
                        break;
                    } else {
                        codeLines.push(cl);
                        i++;
                        break;
                    }
                }
                while (codeLines.length > 0 && codeLines[codeLines.length - 1].trim() === '') {
                    codeLines.pop();
                }
                if (codeLines.length > 0) {
                    result.push(`\`\`\`${lang}`);
                    result.push(...codeLines);
                    result.push('\`\`\`');
                }
                continue;
            }

            if (type === 'bullet') {
                const content = line.trim().replace(/^\s*[•·\-\*]\s+/, '');
                result.push(`- ${processInline(content)}`);
                i++;
                continue;
            }

            if (type === 'numbered') {
                const match = line.trim().match(/^\s*\d+[.\)]\s+(.*)$/);
                if (match) {
                    result.push(`1. ${processInline(match[1])}`);
                } else {
                    result.push(processInline(line.trim()));
                }
                i++;
                continue;
            }

            if (type === 'table') {
                const tableRows = [line.trim()];
                i++;
                if (i < lines.length && isTableSeparator(lines[i].trim())) {
                    tableRows.push(lines[i].trim());
                    i++;
                }
                while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
                    tableRows.push(lines[i].trim());
                    i++;
                }
                result.push(...tableRows);
                continue;
            }

            if (type === 'table-sep') {
                result.push(line.trim());
                i++;
                continue;
            }

            // Default text
            result.push(processInline(line.trim()));
            i++;
        }

        // Post-process: collapse multiple blank lines
        const cleaned = [];
        let lastBlank = false;
        for (const r of result) {
            if (r === '') {
                if (!lastBlank) cleaned.push('');
                lastBlank = true;
            } else {
                cleaned.push(r);
                lastBlank = false;
            }
        }

        return cleaned.join('\n').trim();
    }
};
