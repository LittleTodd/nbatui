/**
 * NBA Team Colors
 * Official primary and secondary colors for all 30 teams
 * Colors are in hex format for terminal RGB support
 */

export interface TeamColors {
    primary: string;
    secondary: string;
    name: string;
}

export const teamColors: Record<string, TeamColors> = {
    // Western Conference
    // Pacific Division
    LAL: { primary: '#552583', secondary: '#FDB927', name: 'Lakers' },
    LAC: { primary: '#C8102E', secondary: '#1D428A', name: 'Clippers' },
    GSW: { primary: '#1D428A', secondary: '#FFC72C', name: 'Warriors' },
    SAC: { primary: '#5A2D81', secondary: '#63727A', name: 'Kings' },
    PHX: { primary: '#1D1160', secondary: '#E56020', name: 'Suns' },

    // Northwest Division
    DEN: { primary: '#0E2240', secondary: '#FEC524', name: 'Nuggets' },
    MIN: { primary: '#0C2340', secondary: '#236192', name: 'Timberwolves' },
    OKC: { primary: '#007AC1', secondary: '#EF3B24', name: 'Thunder' },
    POR: { primary: '#E03A3E', secondary: '#000000', name: 'Trail Blazers' },
    UTA: { primary: '#002B5C', secondary: '#00471B', name: 'Jazz' },

    // Southwest Division
    DAL: { primary: '#00538C', secondary: '#002B5E', name: 'Mavericks' },
    HOU: { primary: '#CE1141', secondary: '#000000', name: 'Rockets' },
    MEM: { primary: '#5D76A9', secondary: '#12173F', name: 'Grizzlies' },
    NOP: { primary: '#0C2340', secondary: '#C8102E', name: 'Pelicans' },
    SAS: { primary: '#C4CED4', secondary: '#000000', name: 'Spurs' },

    // Eastern Conference
    // Atlantic Division
    BOS: { primary: '#007A33', secondary: '#BA9653', name: 'Celtics' },
    BKN: { primary: '#000000', secondary: '#FFFFFF', name: 'Nets' },
    NYK: { primary: '#006BB6', secondary: '#F58426', name: 'Knicks' },
    PHI: { primary: '#006BB6', secondary: '#ED174C', name: 'Sixers' },
    TOR: { primary: '#CE1141', secondary: '#000000', name: 'Raptors' },

    // Central Division
    CHI: { primary: '#CE1141', secondary: '#000000', name: 'Bulls' },
    CLE: { primary: '#860038', secondary: '#FDBB30', name: 'Cavaliers' },
    DET: { primary: '#C8102E', secondary: '#1D42BA', name: 'Pistons' },
    IND: { primary: '#002D62', secondary: '#FDBB30', name: 'Pacers' },
    MIL: { primary: '#00471B', secondary: '#EEE1C6', name: 'Bucks' },

    // Southeast Division
    ATL: { primary: '#E03A3E', secondary: '#C1D32F', name: 'Hawks' },
    CHA: { primary: '#1D1160', secondary: '#00788C', name: 'Hornets' },
    MIA: { primary: '#98002E', secondary: '#F9A01B', name: 'Heat' },
    ORL: { primary: '#0077C0', secondary: '#C4CED4', name: 'Magic' },
    WAS: { primary: '#002B5C', secondary: '#E31837', name: 'Wizards' },
};

/**
 * Get ANSI color code from hex (simplified - uses closest 256 color)
 */
export function hexToAnsi(hex: string): number {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);

    // Convert to 256-color palette (simplified)
    if (r === g && g === b) {
        // Grayscale
        if (r < 8) return 16;
        if (r > 248) return 231;
        return Math.round((r - 8) / 247 * 24) + 232;
    }

    // Color cube
    const rIdx = Math.round(r / 255 * 5);
    const gIdx = Math.round(g / 255 * 5);
    const bIdx = Math.round(b / 255 * 5);
    return 16 + 36 * rIdx + 6 * gIdx + bIdx;
}

/**
 * Get team colors with fallback
 */
export function getTeamColors(tricode: string): TeamColors {
    return teamColors[tricode] || { primary: '#808080', secondary: '#404040', name: 'Unknown' };
}
