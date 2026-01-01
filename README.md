# 🏀 NBA-TUI (Battle Map)

**The ultimate terminal-based NBA command center for hackers and data nerds.**  
**终极 NBA 命令行观赛中心 - 专为极客打造。**

![NBA-TUI Demo](https://github.com/user-attachments/assets/placeholder.png)

## ✨ Why is this cool? / 项目亮点

Most sports apps are boring lists. **NBA-TUI** visualizes the league geographically and socially.
也就是说，绝大多数体育App都是枯燥的列表。**NBA-TUI** 将比赛以地理可视化和社交热度的形式呈现，带给你不一样的上帝视角。

### 🗺️ Interactive Battle Map (互动战图)
- **Geographic Visualization**: Games are rendered on a terminal-rendered US map at the actual city locations.
- **地理可视化**: 比赛被渲染在终端绘制的美国地图上，精确对应球队城市位置。
- **Live Status Aura**: Markers pulse for live games and glow based on **Social Heat** (Reddit/Twitter buzz).
- **实时状态光环**: 比赛标记会根据实时状态脉动，并根据**社交热度**（Reddit/Twitter讨论量）发出不同颜色的光芒，“火热”的比赛一目了然。

### 🧠 Smart & Nerd Stats (硬核数据)
- **Strict Timezone Logic**: No more "missing games" due to timezone confusion. We calculate the exact Local Midnight vs ET offset to ensure you see the correct games for *your* day.
- **严格时区逻辑**: 告别因时差导致的“比赛消失”。我们采用精确的本地午夜至东部时间转换逻辑，确保无论你在地球何处，都能看到正确的当日比赛。
- **Polymarket Odds**: Integrated real-time win probabilities from prediction markets, not just traditional bookies.
- **Polymarket 赔率**: 集成来自预测市场的实时胜率数据，不仅仅是传统博彩赔率。

### 🚨 Clutch Alerts (关键时刻预警)
- **Crunch Time Mode**: If a game is in the 4th Quarter with a score difference of ≤5, the map marker flashes red to demand your attention.
- **关键时刻模式**: 当比赛进入第四节且分差≤5分时，地图标记会闪烁红色警报，提醒你立即关注。

---

## 🚀 Quick Start / 快速开始

We provide a one-click script to set up both the Python Backend (Data Service) and the Node/Bun Frontend.
我们提供了一键脚本来配置 Python 后端（数据服务）和 Node/Bun 前端。

### Prerequisites / 前置要求
- **Python 3.9+**
- **Bun** (or Node.js) - *The script will offer to install Bun if missing.*

### Installation / 安装

```bash
# 1. Clone the repo
git clone https://github.com/yourusername/nba-tui.git
cd nba-tui

# 2. Run Setup Script (Installs dependencies for Python & Bun)
# 2. 运行安装脚本 (自动安装 Python 和 Bun 依赖)
chmod +x setup.sh
./setup.sh
```

### Usage / 使用

```bash
# Run the app (Launches Backend & Frontend)
# 启动应用 (同时启动后端和前端)
./start.sh
```

---

## 🎮 Controls / 操作指南

| Key / 按键 | Action / 动作 |
| :--- | :--- |
| **← / →** | Change Date (Previous/Next Day) <br> 切换日期 (前一天/后一天) |
| **↑ / ↓** | Select Game (Navigate the map) <br> 选择比赛 (在地图上导航) |
| **Enter** | View Game Details (Boxscore, Play-by-Play) <br> 查看比赛详情 (数据统计, 文字直播) |
| **/** | Search (Filter games by team/city) <br> 搜索 (按球队/城市过滤) |
| **s** | Toggle Standings Sidebar <br> 切换积分榜侧边栏 |
| **r** | Force Refresh <br> 强制刷新 |
| **q / Esc** | Quit <br> 退出 |

---

## 🛠️ Architecture / 架构

- **Frontend**: React + Ink (Terminal UI), Zustand (State), Bun.
- **Backend**: Python FastAPI, SQLite (Caching), NBA API, Reddit/Twitter Scrapers.
- **Design**: "Perplexity-style" clean aesthetic for local management tools.

Enjoy the game. 🏀
享受比赛。
