export const TEAM_COLORS: Record<string, string> = {
    // Atlantic
    'BOS': '#007A33', // Celtics Green
    'BKN': '#000000', // Nets Black (Text needs to be white) - adjust to dark gray for visibility on black term? #2D2D2D
    'NYK': '#F58426', // Knicks Orange (Blue background #006BB6 is standard but orange stands out more? Or use Blue?)
    // User screenshot shows color blocks. Usually Primary Color.
    // NYK Primary is Blue #006BB6
    'PHI': '#006BB6', // 76ers Blue
    'TOR': '#CE1141', // Raptors Red

    // Central
    'CHI': '#CE1141', // Bulls Red
    'CLE': '#860038', // Cavs Wine
    'DET': '#C8102E', // Pistons Red
    'IND': '#FDBB30', // Pacers Yellow
    'MIL': '#00471B', // Bucks Green

    // Southeast
    'ATL': '#C1D32F', // Hawks Volt Green or Red #E03A3E? Screenshot shows MIL distinct green. ATL usually Red.
    // Let's use Red for ATL: #E03A3E.
    'CHA': '#1D1160', // Hornets Purple (Teal #00788C is also good)
    'MIA': '#98002E', // Heat Red
    'ORL': '#0077C0', // Magic Blue
    'WAS': '#002B5C', // Wizards Navy

    // Northwest
    'DEN': '#0E2240', // Nuggets Midnight Blue (Yellow #FEC524)
    'MIN': '#0C2340', // Timberwolves Blue (Green #78BE20)
    'OKC': '#007AC1', // Thunder Blue
    'POR': '#E03A3E', // Blazers Red
    'UTA': '#002B5C', // Jazz Navy (Yellow #F9A01B)

    // Pacific
    'GSW': '#1D428A', // Warriors Blue
    'LAC': '#C8102E', // Clippers Red (Blue #1D428A)
    'LAL': '#552583', // Lakers Purple (Gold #FDB927)
    'PHX': '#1D1160', // Suns Purple (Orange #E56020)
    'SAC': '#5A2D81', // Kings Purple

    // Southwest
    'DAL': '#00538C', // Mavs Blue
    'HOU': '#CE1141', // Rockets Red
    'MEM': '#5D76A9', // Grizzlies Blue
    'NOP': '#0C2340', // Pelicans Navy (Red #C8102E, Gold #85714D)
    'SAS': '#C4CED4', // Spurs Silver (Black #000000) - Silver/Grey background
};

// Team background colors for TUI
export const TEAM_BG_COLORS: Record<string, string> = {
    'ATL': '#C8102E', // 红
    'BOS': '#007A33', // 绿
    'BKN': '#000000', // 黑
    'CHA': '#00788C', // 蓝绿
    'CHI': '#CE1141', // 红
    'CLE': '#6F263D', // 酒红
    'DAL': '#00538C', // 蓝
    'DEN': '#0E2240', // 深蓝
    'DET': '#1D428A', // 蓝
    'GSW': '#1D428A', // 蓝
    'HOU': '#CE1141', // 红
    'IND': '#002D62', // 深蓝
    'LAC': '#C8102E', // 红
    'LAL': '#552583', // 紫
    'MEM': '#12173F', // 深蓝
    'MIA': '#98002E', // 深红
    'MIL': '#00471B', // 深绿
    'MIN': '#0C2340', // 深蓝
    'NOP': '#0C2340', // 深蓝
    'NYK': '#006BB6', // 蓝
    'OKC': '#007AC1', // 蓝
    'ORL': '#0077C0', // 蓝
    'PHI': '#006BB6', // 蓝
    'PHX': '#1D1160', // 紫
    'POR': '#000000', // 黑
    'SAC': '#5A2D81', // 紫
    'SAS': '#000000', // 黑
    'TOR': '#CE1141', // 红
    'UTA': '#002B5C', // 深蓝
    'WAS': '#002B5C', // 深蓝
};

// Team text colors for TUI
export const TEAM_TEXT_COLORS: Record<string, string> = {
    'ATL': '#FFCD00', // 黄
    'BOS': '#FFFFFF', // 白
    'BKN': '#FFFFFF', // 白
    'CHA': '#FFFFFF', // 白
    'CHI': '#000000', // 黑
    'CLE': '#FDB927', // 金
    'DAL': '#B8C4CA', // 银
    'DEN': '#FEC524', // 金
    'DET': '#FFFFFF', // 白
    'GSW': '#FFC72C', // 黄
    'HOU': '#FDB927', // 金 (Clutch City)
    'IND': '#FDBB30', // 黄
    'LAC': '#FFFFFF', // 白
    'LAL': '#FDB927', // 金
    'MEM': '#5D76A9', // 浅蓝
    'MIA': '#F9A01B', // 橙
    'MIL': '#F0EBD2', // 奶油
    'MIN': '#78BE20', // 荧光绿
    'NOP': '#85714D', // 铜金
    'NYK': '#F58426', // 橙
    'OKC': '#EF3B24', // 橙红
    'ORL': '#C4CED4', // 银
    'PHI': '#FFFFFF', // 白
    'PHX': '#E56020', // 橙
    'POR': '#E03A3E', // 红
    'SAC': '#63727A', // 银
    'SAS': '#C4CED4', // 银
    'TOR': '#000000', // 黑
    'UTA': '#F9A01B', // 黄
    'WAS': '#E31837', // 红
};
