# 🏀 NBA-TUI
终端 NBA 观赛工具 | Terminal-based NBA viewer

![Terminal](https://img.shields.io/badge/Terminal-TUI-green) ![React](https://img.shields.io/badge/React-Ink-blue) ![Python](https://img.shields.io/badge/Python-FastAPI-yellow)

![Screenshot](/src/gif/screenshot.png)

---

## 🔥 最近更新 | What's New

### ✨ 新功能 | New Features
- **球队详情中心 (Team Detail Hub)**: 在积分榜中选中球队即可查看详细信息，包含：
  - Select a team in Standings to view detailed info hub:
  - 🏀 **阵容 (Roster)**: 球员名单及详细数据 (Player list & stats)
  - 📊 **战绩 (Record)**: 近期比赛结果与赛季排名 (Recent games & rankings)
  - 🏆 **信息 (Info)**: 球队历史荣誉与背景 (Team history & background)
- **动画速度调节 (Glitch Speed Control)**: 根据喜好调整界面故障艺术动画的速度。
  - Adjustable speed settings for UI glitch animations.

### 🚀 改进 | Improvements
- **缓存优化 (Smart Caching)**: 实现了球队详情数据的智能缓存，大幅提升浏览速度。
  - Implemented smart caching for team details to enhance navigation speed.

### 🐛 修复 | Bug Fixes
- **数据显示 (Data Display)**: 修复比分和日期的显示问题及 UI 布局微调。
  - Fixed score, date display issues and minor UI layout tweaks.

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

### 球队中心 | Team Hub
- 完整阵容名单与球员数据
- Full roster list with player statistics
- 赛季战绩走势与近期比赛结果
- Season record trends & recent game results
- 球队历史荣誉墙
- Team history & honors wall

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
| `← / →` | 切换日期/标签 Change date/tab |
| `↑ / ↓` | 选择比赛/滚动 Select/Scroll |
| `Enter` | 查看详情 View detail |
| `Tab` | 切换视图/页面 Switch View/Tab |
| `1 / 2 / 3` | 详情页标签 Quick Tabs |
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
