# plaintxt2md · AI 纯文本转 Markdown

> 把"复制出来就乱掉"的纯文本，一键还原成结构清晰的 Markdown。

一个由大模型驱动的智能排版工具：粘贴任意纯文本，自动识别它属于哪种文档场景，再针对性地转换为规范的 Markdown。支持表格还原、代码块语言标注、会议待办提取等，并提供 **Chrome 浏览器插件** 和 **网页版** 两种形态。

**中文** | [English](#plaintxt2md--ai-plain-text-to-markdown)

---

更新前端了<img width="1669" height="1959" alt="image" src="https://github.com/user-attachments/assets/5b01d32a-0f43-4a58-8390-5c8e569869d8" />


## 📚 目录

- [核心特性](#-核心特性)
- [快速开始](#-快速开始最新版-chrome-插件)
- [五种场景智能识别](#-五种场景智能识别)
- [测试与实验](#-测试与实验)
- [项目动机](#-项目动机)
- [插件使用说明](#-插件使用说明)
- [项目结构](#-项目结构)
- [后续规划](#-后续规划)

---

## ✨ 核心特性

- **🧠 场景自适应**：内置 5 种常见文档场景的差异化处理，可手动选择，也可默认自动识别。
- **📊 表格还原**：表格类内容直接复制粘贴会丢失格式，本工具转换后可识别并重建为 Markdown 表格。
- **⚡ 转换方式**：Chrome 插件为 AI 智能转换（场景识别在浏览器本地完成，转换调用大模型，需联网 + API Key）；网页版额外提供无需联网的本地规则引擎转换。
- **🧩 两种形态**：Chrome 浏览器插件（推荐，最新版）+ 纯前端网页版。

---

## 🚀 快速开始（最新版 · Chrome 插件）

最新版（带场景分类器）位于 [`plaintext-to-markdown-chrome`](plaintext-to-markdown-chrome/) 目录。

1. 下载本仓库并解压。
2. 打开 Chrome 浏览器，访问 `chrome://extensions/`。
3. 开启右上角的 **「开发者模式」**。
4. 点击 **「加载已解压的扩展程序」**，选择 `plaintext-to-markdown-chrome` 文件夹。
5. 安装完成，开始使用 🎉

> 插件的详细使用说明见 [`plaintext-to-markdown-chrome/README.md`](plaintext-to-markdown-chrome/README.md)。

---

## 🎯 五种场景智能识别

工具会根据文本特征自动判断场景，并套用对应的转换策略；你也可以在界面里手动指定。

| 场景 | 说明 |
|------|------|
| **表格 / 数据报告** | 含大量数字、对齐列式数据时，重建为 Markdown 表格，而非丢成一堆纯文本。 |
| **代码片段** | 检测代码主体，用 fenced code block 包裹并标注编程语言。 |
| **会议记录** | 识别日期、议程、待办，待办自动转为 GitHub 任务列表 `- [ ]`。 |
| **技术文档** | 混合了代码、配置和说明的技术文本，规范化为带语言标注的文档。 |
| **通用文章** | 普通正文，做标题分级、分段与强调等基础排版。 |

### 表格类

> 表格类如果直接复制粘贴纯文本保留不了格式，转换后可以识别。

<img width="3556" height="1859" alt="image" src="https://github.com/user-attachments/assets/f6d83063-302b-4038-a6a8-52ea2b3f746e" />

### 数据报告类

<img width="1920" height="822" alt="image" src="https://github.com/user-attachments/assets/17aa979e-ed0f-4c3f-9696-d1516e334e5f" />

<img width="2202" height="1193" alt="image" src="https://github.com/user-attachments/assets/4822a57b-1d2b-4a92-ad23-8e1cb804add7" />

### 代码类

<img width="2177" height="1142" alt="image" src="https://github.com/user-attachments/assets/2a41562f-0ade-4491-a657-194c6405653f" />

### 会议类

<img width="2156" height="1625" alt="image" src="https://github.com/user-attachments/assets/1572d578-314c-40eb-9411-a7389fe50239" />

---

## 🔬 测试与实验

### 分类准确率

> 场景分类达到 95%+ 准确率。

<img width="2442" height="1793" alt="image" src="https://github.com/user-attachments/assets/747394a4-9314-4227-8ed6-dd854de829ab" />

### 消融实验

> 消融实验证实：针对场景定制的分类 prompt，相比通用 prompt 具有明显优越性。

<img width="2618" height="1711" alt="image" src="https://github.com/user-attachments/assets/1e7015b4-f818-4346-ae16-5fbaa086ce60" />

---

## 💡 项目动机

日常工作中，把文档从一个地方复制到另一个地方，格式往往会全部丢失——表格塌成纯文本、代码缩进错乱、层级结构消失。

<img width="1252" height="501" alt="image" src="https://github.com/user-attachments/assets/202e88d7-a0ef-4196-8502-337376d9a6f1" />

<img width="1153" height="620" alt="image" src="https://github.com/user-attachments/assets/733aaed9-41d9-4aa1-83ab-3c8a4f75a292" />

这个应用避免了此类问题，后续会做成浏览器插件并且支持思维导图结构输出。

---

## 🧩 插件使用说明

<img width="1920" height="1080" alt="image" src="https://github.com/user-attachments/assets/711912e8-ac7a-4a6c-b2f9-920050228cf9" />

使用 AI 模式需要获取 API Key。现已支持多家 OpenAI 兼容供应商：**阿里通义千问、Kimi（Moonshot）、DeepSeek、智谱 GLM**，在设置里下拉切换即可，各家 Key 独立保存。

<img width="1867" height="924" alt="image" src="https://github.com/user-attachments/assets/41bc0064-7183-4dca-b797-110fb6b5a22c" />

<img width="1119" height="803" alt="image" src="https://github.com/user-attachments/assets/79974f93-950c-4c6b-bc87-67c8b786321f" />

<img width="1857" height="890" alt="image" src="https://github.com/user-attachments/assets/d2cd9062-8fff-431e-89cb-f52d0c4c9d89" />

> 具体怎么用，在 [`plaintext-to-markdown-chrome`](plaintext-to-markdown-chrome/) 文件夹里有额外的 README。

---

## 📦 项目结构

| 目录 | 说明 |
|------|------|
| [`plaintext-to-markdown-chrome/`](plaintext-to-markdown-chrome/) | Chrome 浏览器插件（带场景分类器，推荐使用）。 |
| [`plaintext-to-markdown-github/`](plaintext-to-markdown-github/) | 纯前端网页版，双击 `index.html` 即可打开。 |
| [`privacy-policy/`](privacy-policy/) | 隐私政策页面。 |

---

## 🔭 后续规划

- [ ] 上架 Chrome 应用商店
- [ ] 支持思维导图结构输出
- [x] 接入多家大模型供应商（阿里通义千问 / Kimi / DeepSeek / 智谱 GLM）
- [ ] 接入更多供应商与自定义 OpenAI 兼容端点

---

## 📄 许可证

MIT License

---

<a name="english"></a>

# plaintxt2md · AI Plain Text to Markdown

> Turn messy "copy-pasted" plain text back into clean, structured Markdown.

[中文](#plaintxt2md--ai-纯文本转-markdown) | **English**

An LLM-powered formatting tool: paste any plain text, and it automatically detects which kind of document the text is, then converts it to well-structured Markdown with the right strategy. It restores tables, annotates code blocks with their language, extracts meeting action items, and ships as both a **Chrome extension** and a **web app**.

## ✨ Key Features

- **🧠 Scene-adaptive** — 5 built-in document scenes with tailored handling; auto-detected by default, or pick one manually.
- **📊 Table restoration** — Tables lose their formatting when copied as plain text; this tool detects and rebuilds them as Markdown tables.
- **⚡ Conversion** — The Chrome extension uses AI conversion (scene detection runs locally in the browser; conversion calls the LLM, so it needs network + an API Key). The web app additionally offers offline local rule-engine conversion.
- **🧩 Two form factors** — Chrome extension (recommended, latest) + a pure-frontend web app.

## 🚀 Quick Start (Latest · Chrome Extension)

The latest version (with the scene classifier) lives in [`plaintext-to-markdown-chrome`](plaintext-to-markdown-chrome/).

1. Download and unzip this repository.
2. Open Chrome and go to `chrome://extensions/`.
3. Enable **Developer mode** (top-right).
4. Click **Load unpacked** and select the `plaintext-to-markdown-chrome` folder.
5. Done 🎉

## 🎯 Five Auto-Detected Scenes

| Scene | What it does |
|-------|--------------|
| **Table / Data report** | Rebuilds aligned, number-heavy columns into Markdown tables instead of dumping plain text. |
| **Code snippet** | Detects the code body and wraps it in a fenced code block with a language tag. |
| **Meeting notes** | Recognizes dates, agenda, and action items; turns to-dos into GitHub task lists `- [ ]`. |
| **Technical doc** | Normalizes text mixing code, config, and prose into language-tagged Markdown. |
| **General prose** | Applies basic formatting: heading levels, paragraphs, and emphasis. |

## 🔬 Testing & Experiments

- **Classification accuracy:** 95%+ across scenes.
- **Ablation study:** scene-specific classification prompts clearly outperform a generic prompt.

(See the screenshots in the Chinese section above.)

## 💡 Motivation

Copying documents from one place to another usually destroys their formatting — tables collapse into plain text, code indentation breaks, and the structure disappears. This app avoids that, and will later add browser-extension polish and mind-map structured output.

## 🧩 Extension Notes

AI mode requires an API Key. Multiple OpenAI-compatible providers are supported — **Alibaba Qwen, Kimi (Moonshot), DeepSeek, and Zhipu GLM** — switchable from a dropdown in settings, with each provider's key stored separately. A detailed guide lives in the [`plaintext-to-markdown-chrome`](plaintext-to-markdown-chrome/) folder.

## 🔭 Roadmap

- [ ] Publish to the Chrome Web Store
- [ ] Mind-map structured output
- [x] Support multiple LLM providers (Qwen / Kimi / DeepSeek / Zhipu GLM)
- [ ] Support more providers and custom OpenAI-compatible endpoints

## 📄 License

MIT License
