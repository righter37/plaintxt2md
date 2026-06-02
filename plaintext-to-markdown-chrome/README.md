# AI Text to Markdown - Chrome Extension

🤖 Chrome 浏览器扩展，将纯文本智能转换为 Markdown 格式。

## ✨ 功能特点

- **🎯 智能场景识别**：场景判断在浏览器本地完成（分类准确率 95%+），再套用针对性的转换策略
- **🧠 AI 智能转换**：调用阿里云 DashScope 大模型，按识别出的场景分析文本结构
- **📝 右键菜单**：选中网页文字，右键一键转换
- **📐 侧边栏模式**：更大界面，适合复杂文档处理
- **🎯 快捷键**：
  - `Ctrl+Shift+M` 打开弹出窗口
  - `Ctrl+Shift+S` 打开侧边栏

## 🎯 智能场景识别

不同类型的文本需要不同的排版策略。本扩展会先识别文本场景，再用对应的 prompt 转换，避免"一套通用规则套所有内容"导致的格式丢失。场景可自动识别，也可在界面手动指定。

| 场景 | 处理策略 |
|------|----------|
| **数据报告 / 表格** | 对齐的列式数据、时间序列重建为 Markdown 表格 |
| **代码片段** | 代码主体用 fenced code block 包裹并标注编程语言，说明文字保留在块外 |
| **会议记录** | 识别议程与待办，Action items 转为 GitHub 任务列表 `- [ ]` |
| **技术文档** | 混合代码、配置与说明的文本，规范化为带语言标注的文档 |
| **通用文章** | 普通正文，做标题分级、分段与强调等基础排版 |

> 📊 仓库内提供了两个测试页面：`test-classifier.html`（分类准确率测试）和 `test-ablation.html`（分类 prompt 对比通用 prompt 的消融实验）。

## 🚀 安装方法

### 方法一：开发者模式加载（推荐）

1. 下载并解压本扩展文件夹
2. 打开 Chrome 浏览器，访问 `chrome://extensions/`
3. 开启右上角的「开发者模式」
4. 点击「加载已解压的扩展程序」
5. 选择本扩展所在的文件夹
6. 安装完成！🎉

### 方法二：Chrome 应用商店（待发布）

等待上架后可直接从商店安装。

## 🔧 配置说明

### 1. 获取 API Key

1. 访问 [阿里云 DashScope](https://dashscope.aliyun.com/)
2. 注册/登录账号
3. 进入控制台创建 API Key
4. 复制 Key

### 2. 配置扩展

1. 点击扩展图标打开弹出窗口
2. 点击「设置」按钮
3. 在 API Key 栏粘贴你的 Key
4. 选择 AI 模型（Turbo/Plus/Max）
5. 点击「测试连接」验证配置

## 📖 使用指南

### 基础使用

1. **点击扩展图标** - 打开弹出窗口
2. **粘贴文本** - 在输入框粘贴纯文本
3. **确认场景** - 扩展会自动识别文档场景，也可手动指定
4. **点击转换** - 等待 AI 转换完成
5. **复制/下载** - 获取 Markdown 结果

### 右键菜单使用

1. 在任意网页**选中文字**
2. **右键点击**选中的文字
3. 选择「📝 转换为 Markdown」
4. 扩展会自动打开并带入选中的文字

### 侧边栏使用

1. 按 `Ctrl+Shift+S` 或点击「在侧边栏打开」
2. 在更大的界面中操作
3. 支持「获取页面选中文字」按钮
4. 支持源码/预览/分屏三种视图

## 🛠️ 开发信息

### 文件结构

```
chrome-extension/
├── manifest.json      # 扩展配置文件
├── popup.html         # 弹出窗口界面
├── popup.js           # 弹出窗口逻辑
├── popup.css          # 弹出窗口样式
├── sidepanel.html     # 侧边栏界面
├── sidepanel.js       # 侧边栏逻辑
├── sidepanel.css      # 侧边栏样式
├── background.js      # 后台脚本（右键菜单、快捷键）
├── content.js         # 内容脚本（页面交互）
├── icons/             # 图标文件夹
│   ├── icon16.png     # 16x16 图标
│   ├── icon48.png     # 48x48 图标
│   └── icon128.png    # 128x128 图标
└── README.md          # 本说明文件
```

### 需要准备的图标

扩展需要以下尺寸的图标：
- `icons/icon16.png` - 16x16（工具栏图标）
- `icons/icon48.png` - 48x48（扩展管理页面）
- `icons/icon128.png` - 128x128（Chrome 商店）

可以使用 [Figma](https://figma.com)、[Canva](https://canva.com) 或 [Icon Generator](https://icon-generator.net) 生成。

### 权限说明

扩展需要以下权限：
- `storage` - 保存 API Key 等设置
- `activeTab` - 获取当前标签页选中的文字
- `contextMenus` - 创建右键菜单
- `sidePanel` - 使用侧边栏功能
- `https://dashscope.aliyuncs.com/*` - 访问 DashScope API

## ⚠️ 注意事项

1. **API Key 安全**
   - API Key 仅存储在本地浏览器中
   - 不会上传到任何第三方服务器
   - 不要与他人分享你的 API Key

2. **网络要求**
   - 文本转换由 AI 完成，需要联网访问 DashScope 并配置 API Key
   - 仅场景识别（分类器）在浏览器本地运行，无需联网

3. **快捷键冲突**
   - 如果快捷键与其他扩展冲突，可在 chrome://extensions/shortcuts 中修改

## 🐛 故障排除

| 问题 | 解决方案 |
|------|----------|
| 无法加载扩展 | 确保已开启开发者模式，选择正确的文件夹 |
| API 连接失败 | 检查 API Key 是否正确，网络是否畅通 |
| 右键菜单不显示 | 刷新页面后重试，或重新安装扩展 |
| 侧边栏无法打开 | 确保 Chrome 版本 >= 114 |

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 PR！

---

**Made with ❤️ and AI**
