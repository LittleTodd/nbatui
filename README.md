# 🏀 NBA-TUI
终端 NBA 观赛工具 | Terminal-based NBA viewer

![Terminal](https://img.shields.io/badge/Terminal-TUI-green) ![React](https://img.shields.io/badge/React-Ink-blue) ![Python](https://img.shields.io/badge/Python-FastAPI-yellow)

![Screenshot](/src/gif/screenshot.png)

---

## 🔥 最近更新 | What's New

### ✨ 新功能 | New Features
- **全新配色系统 (Enhanced Team Colors)**: 为所有 30 支球队更新了高对比度、更美观的终端配色方案。
  - Updated high-contrast, stylized color schemes for all 30 NBA teams.
- **获胜概率 & 比赛标签 (Win Probability & Labels)**: 新增赛前获胜概率条及季后赛/常规赛标签。
  - Added pre-game win probability bars and game type indicators.
- **动态比分效果 (Breathing Score)**: 进行中比赛的比分增加呼吸灯动画效果。
  - Added breathing animation for live scores.

### 🚀 改进 | Improvements
- **性能优化 (Performance)**: 文字直播 (Play-by-Play) 刷新率优化为 15 秒（仅在活跃时）。
  - Optimized Play-by-Play refresh rate to 15s (active only).
- **UI 交互**: 
  - 改进球员数据卡片 (Player Stats Card)：布局更紧凑，支持 `Esc` 快速关闭，优化焦点管理。
  - Refined Player Stats Card: compact layout, `Esc` to close, better focus management.
  - 优化在场球员 (LiveOnCourt) 面板对齐及切换体验。
  - Improved alignment and switching experience for LiveOnCourt panel.

### 🐛 修复 | Bug Fixes
- **时区显示**: 修复比赛时间未正确显示为本地时间的问题。
  - Fixed game time display issues (local timezone).
- **图表逻辑**: 修正 Lead Tracker 图表在 "Underdog" 领先时的填充逻辑错误。
  - Corrected filling logic for Lead Tracker charts when underdog leads.
- **稳定性**: 修复长时间停留在详情页导致的界面卡死问题。
  - Fixed app freeze issue after long duration on detail page.
- **数据展示**: 
  - 修正罚球文字直播顺序颠倒问题。
  - Fixed reversed order of free throw play-by-play events.
  - 修复地图模式下部分球队（如 OKC）颜色暗淡的问题。
  - Fixed dim colors for specific teams on map view.

---

## 功能 | Features

### 地图视图 | Map View
- 比赛按实际城市位置显示在 ASCII 美国地图上
- Games displayed on ASCII US map at actual city locations
- 进行中的比赛显示绿色闪烁标记
- Live games show blinking green indicator
- 支持日期切换浏览历史和未来赛程
- Navigate between dates for past/future schedules

### 比赛详情 | Game Detail
- 按节得分表 (Scoring by Quarter)
- 球队数据对比 (Team Stats Comparison)
- Top 10 球员表现 (Top 10 Performers)
- Reddit r/nba 热门评论 (Social Buzz from r/nba)

### 数据源 | Data Sources
- NBA 官方 API (实时比分、球员统计)
- NBA Official API (live scores, player stats)
- Reddit r/nba (社交热度、评论)
- Reddit r/nba (social heat, comments)
- Polymarket (预测市场赔率)
- Polymarket (prediction market odds)

---

## 安装 | Installation

### 前置要求 | Prerequisites
- Python 3.9+
- Bun (或 Node.js)

### 安装步骤 | Steps

```bash
# 克隆仓库 | Clone repo
git clone https://github.com/yourusername/nba-tui.git
cd nba-tui

# 运行安装脚本 | Run setup script
chmod +x setup.sh
./setup.sh
```

---

## 启动 | Usage

```bash
# 启动应用 | Start app
./start.sh
```

---

## 操作 | Controls

| 按键 Key | 功能 Action |
|----------|-------------|
| `← / →` | 切换日期 Change date |
| `↑ / ↓` | 选择比赛 Select game |
| `Enter` | 查看详情 View detail |
| `/` | 搜索球队 Search team |
| `s` | 切换积分榜 Toggle standings |
| `r` | 刷新数据 Refresh |
| `q / Esc` | 退出 Quit |

---

## 技术栈 | Tech Stack

| 组件 Component | 技术 Technology |
|----------------|-----------------|
| 前端 Frontend | React + Ink, Zustand, Bun |
| 后端 Backend | Python FastAPI |
| 缓存 Cache | SQLite |
| 数据 Data | nba_api, Reddit API |

---

## 项目结构 | Structure

```
nba-tui/
├── src/                    # 前端 React/Ink 代码
│   ├── components/         # UI 组件
│   ├── pages/              # 页面 (Map, Detail)
│   ├── store/              # Zustand 状态管理
│   └── services/           # API 客户端
├── data-service/           # Python 后端
│   ├── main.py             # FastAPI 入口
│   ├── services/           # NBA/Reddit 服务
│   ├── routers/            # API 路由
│   └── cache.db            # SQLite 缓存
├── setup.sh                # 安装脚本
└── start.sh                # 启动脚本
```

---

## 缓存策略 | Caching

- 已结束比赛的 boxscore 永久缓存
- Completed game boxscores are cached permanently
- Social 数据在比赛结束 2 小时后缓存
- Social data cached 2 hours after game ends
- 进行中比赛使用 Live API 获取实时比分
- Live games use Live API for real-time scores

---

## License

MIT
