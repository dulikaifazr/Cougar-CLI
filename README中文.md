# Cougar CLI

**一个强大的AI编程助手命令行工具**

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)

## 关于项目

Cougar CLI 是基于 [Cline](https://github.com/cline/cline) 项目的衍生作品，由 Cline Bot Inc. 开发。它是一个自主的编码代理，可以创建/编辑文件、执行命令、使用浏览器等，并在每一步都征求你的许可。

这个CLI版本将AI辅助编码的强大功能直接带到你的终端，使其能够无缝集成到你的开发工作流中。

## 功能特性

- 🤖 AI驱动的代码生成和编辑
- 📁 自主文件操作
- 🔧 命令执行能力
- 🌐 浏览器集成
- 💬 交互式聊天界面
- 🔐 安全的API密钥管理
- 🎯 上下文感知的协助
- 📋 会话管理和历史记录

## 系统要求

### 系统环境

- **Node.js**: 版本 18.0.0 或更高
- **npm**: 版本 9.0.0 或更高
- **操作系统**: Windows、macOS 或 Linux

### API要求

- **Claude API密钥** 来自 [Anthropic](https://console.anthropic.com/)
- **支持的模型**: Claude 4.5 Sonnet（当前优化支持此模型）
  - 其他模型可能功能有限

## 快速开始

### 方式1：直接从GitHub安装（推荐）

最快的开始方式：

```bash
npm install -g https://github.com/dulikaifazr/cougar.git
```

然后配置你的API密钥：

```bash
cougar config set api.apiKey <你的API密钥>
cougar config set api.baseUrl https://api.anthropic.com
cougar config set api.modelId claude-4-5-sonnet-20241022
```

开始使用Cougar：

```bash
cougar chat "帮我完成这个任务"
```

### 方式2：克隆后本地安装

如果你更喜欢先克隆仓库：

```bash
git clone https://github.com/dulikaifazr/cougar.git
cd cougar
npm install
npm run build
npm install -g .
```

## 安装步骤

### 第一步：下载和解压

1. 下载 Cougar CLI 仓库的 ZIP 文件
2. 解压到你想要的目录：
   ```bash
   unzip cougar-cli.zip
   cd cougar-cli
   ```

### 第二步：安装依赖

```bash
npm install
```

### 第三步：构建项目

```bash
npm run build
```

这将把 TypeScript 源代码编译到 `dist/` 目录。

## 配置说明

### API密钥设置

Cougar CLI 将配置存储在你的用户主目录中：

**配置文件位置：**
```
~/.cougar/config.json
```

**在 Windows 上：**
```
C:\Users\你的用户名\.cougar\config.json
```

**在 macOS/Linux 上：**
```
~/.cougar/config.json
```

### 设置你的API密钥

1. 从 [Anthropic 控制台](https://console.anthropic.com/) 获取你的 Claude API 密钥

2. 使用你的API凭证配置 Cougar：

```bash
cougar config set api.apiKey <你的API密钥>
cougar config set api.baseUrl https://api.anthropic.com
cougar config set api.modelId claude-4-5-sonnet-20241022
```

3. 验证你的配置：

```bash
cougar config list
```

### 配置选项

```bash
# API 配置
cougar config set api.apiKey <你的API密钥>        # 你的 Claude API 密钥
cougar config set api.baseUrl <API地址>            # API 端点地址
cougar config set api.modelId <模型ID>             # 模型标识符
cougar config set api.temperature <0-1>            # 温度参数（默认：0.7）

# 用户偏好
cougar config set preferences.language zh           # 语言（zh/en）
cougar config set preferences.outputFormat json     # 输出格式（text/json）
```

## 使用方法

### 基本聊天

```bash
cougar chat "帮我创建一个React的待办事项列表组件"
```

### 创建新任务

```bash
cougar chat "/newtask 为用户认证创建一个新功能"
```

### 压缩对话上下文

```bash
cougar chat "/condense 总结一下我们目前的对话"
```

### 总结任务

```bash
cougar chat "/summarize 我们完成了什么？"
```

### 高级选项

```bash
# 使用特定会话
cougar chat "消息" --session 我的会话

# 创建新会话
cougar chat "消息" --new-session

# 自定义系统提示词
cougar chat "消息" -s "你是一个Python专家"

# 启用全局规则
cougar chat "消息" --use-rules

# 启用项目本地规则
cougar chat "消息" --use-local-rules

# 启用工作流
cougar chat "消息" --use-workflows

# 启用工具执行模式（AI可以执行工具）
cougar chat "消息" --tools

# 自动批准工具操作（谨慎使用！）
cougar chat "消息" --tools --auto-approve
```

## 会话管理

### 查看所有会话

```bash
cougar session list
```

### 获取会话信息

```bash
cougar session info <会话ID>
```

### 删除会话

```bash
cougar session delete <会话ID>
```

### 清空会话历史

```bash
cougar session clear <会话ID>
```

### 导出会话

```bash
cougar session export <会话ID>
```

## 全局安装

完成上述安装步骤后，你可以全局安装 Cougar：

```bash
npm install -g .
```

或使用全局安装命令：

```bash
cougar install --global
```

全局安装后，你可以从任何目录使用 `cougar` 命令：

```bash
cougar chat "你的消息"
```

## 项目结构

```
cougar-cli/
├── src/                          # 源代码
│   ├── cli.ts                   # CLI 入口点
│   ├── index.ts                 # 主导出
│   ├── api/                     # API 处理器
│   ├── core/                    # 核心功能
│   │   ├── context/            # 上下文管理
│   │   ├── rules/              # 规则系统
│   │   ├── storage/            # 会话存储
│   │   ├── task/               # 任务执行
│   │   ├── tools/              # 工具处理器
│   │   └── tracking/           # 使用追踪
│   ├── prompts/                # 提示词模板
│   ├── types/                  # TypeScript 类型
│   └── utils/                  # 工具函数
├── scripts/                      # 构建脚本
├── dist/                         # 编译输出（自动生成）
├── package.json                  # 项目依赖
├── tsconfig.json                 # TypeScript 配置
├── LICENSE                       # Apache License 2.0
└── README.md                     # 本文件
```

## 模型支持

### 当前支持

✅ **Claude 4.5 Sonnet**（推荐）
- 完整功能支持
- 优化的性能
- 最适合复杂任务

### 有限支持

⚠️ **其他 Claude 模型**
- 可能功能有限
- 未完全测试
- 使用风险自负

### 配置

```bash
# 设置模型
cougar config set api.modelId claude-4-5-sonnet-20241022

# 查看当前模型
cougar config get api.modelId
```

## 规则和工作流

### 全局规则

在以下位置创建全局规则：
```
~/.cougar/Rules/
```

### 项目本地规则

在你的项目中创建本地规则：
```
.cougarrules/
```

### 使用规则

```bash
# 启用全局规则
cougar chat "消息" --use-rules

# 启用项目本地规则
cougar chat "消息" --use-local-rules

# 启用工作流
cougar chat "消息" --use-workflows
```

## 故障排除

### 配置未找到

**错误：** `Configuration incomplete, please set API configuration first`

**解决方案：**
```bash
cougar config set api.apiKey <你的密钥>
cougar config set api.baseUrl https://api.anthropic.com
cougar config set api.modelId claude-4-5-sonnet-20241022
```

### API连接失败

**错误：** `Failed to connect to API`

**解决方案：**
1. 验证你的API密钥是否正确
2. 检查你的网络连接
3. 验证API端点地址
4. 检查你的API密钥是否有足够的配额

### 构建错误

**错误：** `npm run build 失败`

**解决方案：**
```bash
# 清除缓存并重新安装
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Node.js 版本问题

**错误：** `Node version not supported`

**解决方案：**
```bash
# 检查你的 Node 版本
node --version

# 更新 Node.js 到 18+ 版本
# 访问 https://nodejs.org/ 获取安装说明
```

## 开发

### 监视模式

用于自动重新编译的开发模式：

```bash
npm run dev
```

### 运行测试

```bash
npm run test
```

## 关于本项目

### 原始项目

本项目基于 [Cline](https://github.com/cline/cline) 项目，由 Cline Bot Inc. 开发。

**原始项目地址：** https://github.com/cline/cline

**原始许可证：** Apache License 2.0

### 所做修改

- 将项目名称从 Cline 改为 Cougar
- 适配CLI优先的使用方式
- 优化配置管理
- 增强会话处理
- 简化命令界面

## 许可证

本项目采用 **Apache License 2.0** 许可证。详见 [LICENSE](LICENSE) 文件。

**版权 © 2025 dulikaifazr**

**部分版权 © 2025 Cline Bot Inc.**

## 贡献

欢迎贡献！请随时提交 Pull Request。

## 获取帮助

如有问题、疑问或建议：

1. 查看 [故障排除部分](#故障排除)
2. 查看 GitHub 上的现有问题
3. 创建一个新问题并提供详细信息

## 致谢

- 基于 [Cline](https://github.com/cline/cline) 项目
- 由 [Claude AI](https://www.anthropic.com/) 提供支持
- 使用 [Commander.js](https://github.com/tj/commander.js) 作为CLI框架
- 使用 [Anthropic SDK](https://github.com/anthropics/anthropic-sdk-python)

## 免责声明

这是 Cline 项目的衍生作品。使用、修改或分发本软件时，请确保遵守 Apache License 2.0。

---

**用 ❤️ 为开发者打造**