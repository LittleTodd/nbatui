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

// Adjustments for better TUI visibility (Contrast with White text)
export const TEAM_BG_COLORS: Record<string, string> = {
    'ATL': '#E03A3E',
    'BOS': '#007A33',
    'BKN': '#333333', // Dark Gray instead of Black
    'CHA': '#00788C', // Teal looks better
    'CHI': '#CE1141',
    'CLE': '#6F263D',
    'DAL': '#00538C',
    'DEN': '#0E2240',
    'DET': '#C8102E',
    'GSW': '#1D428A',
    'HOU': '#CE1141',
    'IND': '#002D62', // Pacers Blue (Yellow text is hard on yellow bg) - Use their Navy
    'LAC': '#C8102E',
    'LAL': '#552583',
    'MEM': '#5D76A9',
    'MIA': '#98002E',
    'MIL': '#00471B',
    'MIN': '#236192', // Lighter Blue
    'NOP': '#0C2340',
    'NYK': '#006BB6',
    'OKC': '#007AC1',
    'ORL': '#0077C0',
    'PHI': '#006BB6',
    'PHX': '#1D1160',
    'POR': '#E03A3E',
    'SAC': '#5A2D81',
    'SAS': '#888888', // Grey for Spurs
    'TOR': '#CE1141',
    'UTA': '#002B5C',
    'WAS': '#002B5C',
};
