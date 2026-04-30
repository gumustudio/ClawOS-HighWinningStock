<div align="center">

<img src="frontend/public/favicon.svg" width="80" height="80" alt="ClawOS" />

# ClawOS

### 轻量级私有云桌面 + AI 炒股工作台

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

ClawOS 是一个面向单用户自托管的 Web 桌面系统，用来统一管理 AI 炒股、OpenCode 远程编程、OpenClaw 对话、文件、笔记、音乐、影视、下载、RSS 每日简报和系统监控。

**[> English Docs](README_EN.md)**

<img src=".github/screenshot.png" width="960" alt="ClawOS Desktop Screenshot" />

</div>

---

## 当前定位

ClawOS 不是通用 NAS 面板，而是给个人电脑和 Tailnet 远程访问准备的轻量级私有云桌面。它默认只服务一个人：浏览器进入桌面，打开应用窗口，所有数据保存在本机目录和本机服务里。

当前公开版本重点覆盖：

- **AI 炒股工作台**：中证 500 股票池、A 股全市场自选搜索、45 位专家投票、盘前分析、盘中监控、风控、持仓、交易日志、记忆复盘、模型组表现。
- **OpenCode 远程编程**：在 ClawOS 桌面内嵌 OpenCode Web 前端，通过后端反向代理和二次应用锁访问本机代码环境。
- **RSS 每日简报**：Reader 已收口为 RSS-only，只保留订阅拉取、去重、分类、每日简报、稍后阅读、AI 摘要和翻译。
- **个人效率桌面**：随手小记、滴答清单 lite、下载队列、系统状态、服务监控、文件总管、本地音乐、网易云、影视仓、网盘入口。
- **远程访问友好**：适合通过 Tailscale、WireGuard 或本机反向代理访问，核心服务默认绑定本机回环地址。

## 截图

<div align="center">
<img src=".github/stock-trading-proof.png" width="960" alt="AI 炒股系统说明页面" />
<p><em>AI 炒股系统说明页：盘前分析、开盘自动执行、盘中监控、盘后学习和周/月报时间线。</em></p>
</div>

## 核心功能

| 模块 | 说明 |
|---|---|
| **桌面 Shell** | 顶部状态栏、顶部迷你 Dock、窗口管理、壁纸、通知中心、桌面 Widget、服务状态。 |
| **AI 炒股** | 数据采集、市场状态、候选信号、三流评分、LLM 专家投票、Conviction Filter、持仓风控、交易记录、记忆复盘。 |
| **OpenCode** | 本机 OpenCode Web 服务通过 `/proxy/opencode` 嵌入桌面，后端注入 Basic Auth，前端只拿到受锁 Cookie。 |
| **OpenClaw** | 零侵入嵌入本地 OpenClaw Gateway，用 iframe 代理复用现有 AI 对话能力。 |
| **Reader** | RSS 订阅源拉取、文章去重、分类、每日简报、稍后阅读、AI 摘要、AI 翻译。 |
| **随手小记** | 本地 Markdown 文件、文件夹管理、富文本编辑、图片拖拽、任务列表。 |
| **滴答清单 lite** | 滴答 OAuth、收集箱 Widget、自然语言快速创建任务、任务管理和日历视图。 |
| **音乐与影视** | 本地音乐库、网易云在线播放、歌词、影视搜索、HLS 播放。 |
| **文件与网盘** | FileBrowser 本地文件管理，AList 代理百度和夸克网盘。 |
| **下载管理** | Aria2 RPC 队列、速度、历史、清理和下载目录配置。 |
| **系统监控** | CPU、内存、磁盘、网络、systemd 服务健康、HTTP 性能日志。 |

## 桌面特性

- **顶部迷你 Dock**：嵌入状态栏，像任务栏一样打开、切换和最小化应用；开启后底部 Dock 完全不渲染。
- **窗口管理**：macOS 风格红黄绿按钮，支持关闭、最小化、全屏和焦点切换。
- **桌面 Widget**：滴答收集箱、杭州萧山天气、系统资源、下载队列、正在播放。
- **通知中心**：后端持久化通知、轮询兜底、Toast、本地 optimistic 注入。
- **设置持久化**：Dock、壁纸、Widget、路径、媒体质量等 UI 偏好写入服务端配置。

## AI 炒股说明

AI 炒股模块是一个本地 JSON 持久化的 A 股辅助决策系统，不是券商自动交易程序。它会自动生成信号、监控风险和记录执行，但最终使用者仍需自行承担交易决策责任。

系统当前链路：

| 时间 | 动作 |
|---|---|
| 07:30 | 晨间补充分析：补齐隔夜公告、新闻和舆情，合并到前一交易日 FactPool。 |
| 08:05 | 盘前每日分析：筛选股票池、计算技术/量化/专家评分、生成候选信号。 |
| 09:25 | 盘中监控启动：开始轮询持仓和行情。 |
| 09:31 | 开盘自动执行：按配置处理 `strong_buy` / `buy` / `watch` 信号。 |
| 09:30-15:00 | 实时行情刷新：刷新 `signal.realtime`，前端展示实时价、涨跌幅和 OHLC。 |
| 交易时段 | 盘中风控：止损、止盈、超期持仓、异常波动和板块异动提醒。 |
| 16:00 | 盘后分析：刷新收盘数据、重评持仓、更新模型表现和每日记忆。 |
| 周五/月末 | 自动周报和月报：汇总收益、胜率、回撤、行为画像和模型组表现。 |

历史实盘样例：2026 年 4 月早期运行中，系统记录过 10 笔完整买卖交易，9 笔盈利，平均每笔约 +3.19%。该数据只代表当时个人实盘记录，不构成收益承诺或投资建议。

## 架构

```text
浏览器
  │
  ▼
ClawOS 后端 (:3001)
  ├── 静态 React SPA
  ├── REST API (/api/system/*)
  ├── OpenCode 反向代理 (:4096, 127.0.0.1 only)
  ├── OpenClaw 反向代理 (:18789)
  ├── FileBrowser 反向代理 (:18790)
  ├── Aria2 RPC (:6800)
  └── AList 代理 (:5244)
```

| 层级 | 技术栈 |
|---|---|
| **前端** | React 19 + Vite 8 + TypeScript + Tailwind CSS 4 + Zustand + Framer Motion |
| **后端** | Node.js + Express 5 + TypeScript + Winston 日志 |
| **AI 数据** | Node/TypeScript 主业务 + Python/AKShare 受控子进程补充 A 股数据 |
| **编辑器** | Tiptap 富文本编辑器，Markdown 文件落盘 |
| **集成服务** | OpenCode、OpenClaw、FileBrowser、AList、Aria2、网易云音乐 API |

## 快速开始

### 系统要求

- Linux，推荐 Ubuntu 24.04+。
- Node.js 20+。
- Python 3，AI 炒股数据采集需要 AKShare。
- 可选：Tailscale、OpenCode CLI、OpenClaw、Aria2、AList、FileBrowser。

### 1. 克隆与安装

```bash
git clone https://github.com/gumustudio/ClawOS-HighWinningStock.git
cd ClawOS-HighWinningStock
npm install --prefix frontend
npm install --prefix backend
```

### 2. 配置登录密码

```bash
mkdir -p ~/.clawos
printf 'CLAWOS_PASSWORD=你的密码\n' > ~/.clawos/.env
chmod 600 ~/.clawos/.env
```

### 3. 构建与运行

```bash
./scripts/build.sh
./scripts/start-dev.sh
```

开发模式默认地址：

| 服务 | 地址 |
|---|---|
| 前端 | `http://localhost:5173` |
| 后端 | `http://localhost:3001` |

生产模式：

```bash
./scripts/install-systemd.sh
systemctl --user restart clawos.service
```

## 配置

### 环境变量

| 变量 | 说明 |
|---|---|
| `CLAWOS_PASSWORD` | ClawOS 登录密码，用户名固定为 `clawos`。 |
| `PORT` | 后端监听端口，默认 `3001`。 |
| `OPENCLAW_GATEWAY_TOKEN` | OpenClaw Gateway 认证 token。 |
| `OPENCODE_SERVER_PASSWORD` | OpenCode Web Basic Auth 密码，仅后端读取。 |
| `CLAWOS_OPENCODE_APP_PASSWORD` | ClawOS 内部 OpenCode 应用锁密码，可独立于 OpenCode 服务密码。 |
| `DIDA_CLIENT_ID` / `DIDA_CLIENT_SECRET` | 滴答清单 OAuth 凭据。 |
| `BAIDU_NETDISK_CLIENT_ID` / `BAIDU_NETDISK_CLIENT_SECRET` | 百度网盘 OAuth 凭据。 |

敏感信息必须放在本机环境文件或 systemd `EnvironmentFile`，不要提交到仓库。

### 路径配置

所有工作目录可通过设置界面或 `~/.clawos/config.json` 修改：

```json
{
  "paths": {
    "downloadsDir": "~/下载",
    "musicDownloadsDir": "~/音乐",
    "notesDir": "~/文档/随手小记",
    "readerDir": "~/文档/RSS资讯",
    "stockAnalysisDir": "~/文档/AI炒股分析",
    "videoDownloadsDir": "~/视频"
  }
}
```

## 安全边界

- ClawOS 后端默认只绑定 `127.0.0.1:3001`。
- 所有路由默认受 HTTP Basic Auth 保护，前端提供自定义登录页。
- OpenCode Web 只监听 `127.0.0.1:4096`，通过 ClawOS 后端代理访问。
- `/proxy/opencode` 需要 ClawOS OpenCode 应用锁 Cookie，后端负责注入 OpenCode Basic Auth。
- FileBrowser、音乐媒体流等无法继承浏览器 Basic Auth 的资源使用独立 HttpOnly Cookie。
- Reader 只保留 RSS 订阅链路，不再接收 OpenClaw 本地 inbox 投递。

## 外部服务

所有外部服务都是可选项，不安装时对应应用会显示不可用，核心桌面仍可使用。

| 服务 | 默认端口 | 用途 |
|---|---:|---|
| OpenCode Web | `4096` | 远程编程前端，本机回环监听。 |
| OpenClaw Gateway | `18789` | AI 对话网关。 |
| FileBrowser | `18790` | 本地文件 UI。 |
| Aria2 | `6800` | 下载引擎 RPC。 |
| AList | `5244` | 百度/夸克网盘挂载。 |

## 测试

```bash
npm --prefix backend test
npm --prefix frontend test
npm --prefix backend run build
npm --prefix frontend run build
```

## 目录结构

```text
ClawOS/
├── frontend/           # React 桌面前端
│   ├── src/apps/       # 内置应用
│   ├── src/components/ # Dock、通知、Widget、窗口等组件
│   ├── src/lib/        # API、通知 SDK、服务端配置
│   └── public/         # 壁纸和静态资源
├── backend/            # Express API、代理和业务服务
│   ├── src/routes/     # API 路由
│   ├── src/services/   # AI 炒股、Reader、通知、音乐、下载等服务
│   ├── src/utils/      # 配置、日志、服务探针
│   └── tests/          # 后端测试
├── scripts/            # 构建、部署、systemd 脚本
└── filebrowser/        # FileBrowser 本地集成文件
```

## 常见问题

**不装 Aria2、AList、OpenClaw、OpenCode 能用吗？**

可以。它们都是可选集成，对应应用会显示不可用或需要配置，桌面、设置、Reader、Notes 等核心能力仍可使用。

**怎么远程访问？**

推荐使用 Tailscale 或 WireGuard。不要直接把 `3001`、`4096`、`18789` 暴露到公网。

**怎么更新？**

```bash
git pull
./scripts/build.sh
systemctl --user restart clawos.service
```

## 免责声明

AI 炒股模块只做辅助分析、风险提示和本地记录，不构成投资建议，不保证收益。任何交易决策和资金风险都由使用者自行承担。

## 开源协议

本项目基于 [GNU General Public License v3.0](LICENSE) 开源。

<div align="center">

---

由 [gumustudio](https://github.com/gumustudio) 用心构建

</div>
