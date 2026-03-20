# AI Plain Text to Markdown Converter

🤖 一个由大模型驱动的智能文本转 Markdown 工具，支持本地规则引擎和 AI 智能分析双模式。

[English README](#english-readme) | [中文说明](#中文说明)

---

## 中文说明

### ✨ 功能特性

- **🧠 AI 智能转换**：接入阿里云 DashScope 大模型，智能识别文档结构
- **⚡ 本地转换**：无需网络，使用本地规则引擎快速转换
- **🔍 智能识别**：
  - 自动识别标题层级（H1-H6）
  - 检测代码块并标注编程语言
  - 识别表格、列表、链接
  - 智能分段和强调标记
- **🎨 多种输出风格**：标准 Markdown / GitHub 风格 / 简洁风格 / 详细风格
- **📊 实时预览**：支持源码/预览/分屏三种视图
- **📁 文件操作**：支持导入 TXT/MD 文件、拖拽上传、一键下载

### 🚀 快速开始

#### 方式一：直接打开（最简单）
双击 `index.html` 文件，用浏览器打开即可使用。

#### 方式二：本地服务器（推荐）
```bash
# 进入项目目录
cd plaintext-to-markdown-github

# 启动本地服务器（Python 3）
python -m http.server 8080

# 或用 Node.js
npx serve

# 或用 PHP
php -S localhost:8080
```

然后在浏览器访问：`http://localhost:8080`

### 🔧 配置 AI 功能

1. 点击右上角的 **"设置"** 按钮
2. 在 **API Key** 栏填入你的阿里云 DashScope API Key
3. 点击 **"测试连接"** 验证是否配置成功

> 💡 **获取 API Key**：
> 1. 访问 [阿里云 DashScope](https://dashscope.aliyun.com/)
> 2. 注册/登录账号
> 3. 在控制台创建 API Key
> 4. 复制 Key 粘贴到设置中

### 📝 使用指南

1. **选择模式**：点击 "本地转换" 或 "AI 智能转换"
2. **粘贴文本**：在左侧输入框粘贴纯文本内容
3. **调整选项**（可选）：
   - AI 模式：选择模型、输出风格
   - 本地模式：勾选转换选项
4. **点击转换**：等待 AI 分析或即时转换
5. **查看结果**：在右侧查看 Markdown 源码或预览效果
6. **导出**：点击复制或下载按钮保存结果

### 🎯 转换示例

**输入（纯文本）：**
```
Project Overview
================

Introduction
    Project Goals
        - Improve efficiency by 25%
        - Reduce costs
        
Code Example
    function calculateTotal(items) {
        return items.reduce((sum, item) => sum + item.price, 0);
    }
```

**输出（Markdown）：**
```markdown
# Project Overview

## Introduction

### Project Goals

- Improve efficiency by 25%
- Reduce costs

### Code Example

```javascript
function calculateTotal(items) {
    return items.reduce((sum, item) => sum + item.price, 0);
}
```
```

### ⌨️ 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl + Enter` | 开始转换 |
| `Ctrl + S` | 下载结果 |

### 🛠️ 技术栈

- **纯前端实现**：HTML + CSS + JavaScript
- **UI 框架**：Tailwind CSS
- **Markdown 渲染**：Marked.js
- **AI API**：阿里云 DashScope（通义千问）

### 📦 项目结构

```
plaintext-to-markdown-github/
├── index.html      # 主应用文件（单文件完整应用）
├── README.md       # 本说明文件
└── .gitignore      # Git 忽略文件
```

### ⚠️ 注意事项

1. **API Key 安全**：
   - API Key 仅存储在浏览器本地，不会上传到任何服务器
   - 不要将你的 API Key 提交到 GitHub（本仓库已移除默认 Key）

2. **浏览器兼容性**：
   - 推荐使用 Chrome、Edge、Firefox 最新版本
   - 需要支持 ES6+ 的现代浏览器

3. **网络要求**：
   - 本地模式：无需网络
   - AI 模式：需要连接互联网访问 DashScope API

### 📄 许可证

MIT License - 自由使用和修改

---

## English README

### ✨ Features

- **🧠 AI-Powered Conversion**: Integrated with Alibaba Cloud DashScope LLM for intelligent document structure analysis
- **⚡ Local Conversion**: Fast offline conversion using local rule engine
- **🔍 Smart Recognition**:
  - Auto-detect heading levels (H1-H6)
  - Detect code blocks with language annotation
  - Recognize tables, lists, and links
  - Smart paragraph segmentation
- **🎨 Multiple Output Styles**: Standard / GitHub / Minimal / Detailed Markdown
- **📊 Real-time Preview**: Source / Preview / Split-screen views
- **📁 File Operations**: Import TXT/MD files, drag-and-drop upload, one-click download

### 🚀 Quick Start

#### Option 1: Direct Open (Easiest)
Double-click `index.html` to open in browser.

#### Option 2: Local Server (Recommended)
```bash
cd plaintext-to-markdown-github
python -m http.server 8080
```
Then visit: `http://localhost:8080`

### 🔧 Configure AI Feature

1. Click **"Settings"** button (top right)
2. Enter your DashScope API Key in the **API Key** field
3. Click **"Test Connection"** to verify

> 💡 **Get API Key**:
> 1. Visit [Alibaba Cloud DashScope](https://dashscope.aliyun.com/)
> 2. Sign up / Log in
> 3. Create API Key in console
> 4. Copy and paste into settings

### 🛠️ Tech Stack

- **Pure Frontend**: HTML + CSS + JavaScript
- **UI Framework**: Tailwind CSS
- **Markdown Renderer**: Marked.js
- **AI API**: Alibaba Cloud DashScope (Qwen)

### ⚠️ Notes

1. **API Key Security**:
   - API Key is stored locally in browser only
   - Never commit your API Key to GitHub (removed from this repo)

2. **Browser Support**:
   - Recommended: Latest Chrome, Edge, Firefox
   - Requires modern browser with ES6+ support

### 📄 License

MIT License - Free to use and modify

---

## 🤝 Contributing

欢迎提交 Issue 和 PR！

Issues and PRs are welcome!

## ⭐ Star History

如果这个项目对你有帮助，请给个 Star ⭐

If this project helps you, please give it a Star ⭐
