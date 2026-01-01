
import type { Game, GameOdds } from '../services/apiClient.js';
import type { HeatData } from '../hooks/useSocialHeat.js';
import { getTeamPosition } from '../data/teamCoords.js';

// Convert percentage position to character position
export function percentToChar(percent: number, maxChars: number): number {
    return Math.round((percent / 100) * (maxChars - 1));
}

// Create a marker for a game without number prefix
export function createGameMarker(game: Game, isSelected: boolean, isHighlighted: boolean = false, odds?: GameOdds, heat?: HeatData): string {
    const isLive = game.gameStatus === 2;
    const isFuture = game.gameStatus === 1;

    const away = game.awayTeam.teamTricode;
    const home = game.homeTeam.teamTricode;
    const awayScore = game.awayTeam.score;
    const homeScore = game.homeTeam.score;

    let content = '';

    if (isFuture) {
        content = `${away}-${home}`;
    } else {
        content = `${away} ${awayScore}-${homeScore} ${home}`;
    }

    // Add live indicator prefix if game is live
    const livePrefix = isLive ? '●● ' : '';

    // Add Heat Icon to marker if very hot
    const heatSuffix = (heat?.level === 'fire' || heat?.level === 'hot') ? ' 🔥' : '';

    if (isSelected) {
        return `${livePrefix}[${content}${heatSuffix}]`;
    } else if (isHighlighted) {
        return `${livePrefix}»${content}${heatSuffix}«`;
    } else if (isLive) {
        return `●● ${content}${heatSuffix}`;
    } else {
        return `${content}${heatSuffix}`;
    }
}

// Helper to check if game matches filter
export function checkGameMatchesFilter(game: Game, filter: string): boolean {
    if (!filter) return false;
    const lowerFilter = filter.toLowerCase();
    return game.homeTeam.teamTricode.toLowerCase().startsWith(lowerFilter) ||
        game.homeTeam.teamCity.toLowerCase().startsWith(lowerFilter) ||
        game.homeTeam.teamName.toLowerCase().startsWith(lowerFilter) ||
        game.awayTeam.teamTricode.toLowerCase().startsWith(lowerFilter) ||
        game.awayTeam.teamCity.toLowerCase().startsWith(lowerFilter) ||
        game.awayTeam.teamName.toLowerCase().startsWith(lowerFilter);
}

export interface GameColor {
    row: number;
    col: number;
    isLive: boolean;
    isSelected: boolean;
    isHighlighted: boolean;
    heat?: HeatData;
}

// Embed game markers into map lines with collision detection
export function embedGamesInMap(
    mapLines: string[],
    games: Game[],
    selectedIndex: number,
    termWidth: number,
    searchFilter: string = '',
    heatMap: Record<string, HeatData> = {}
): { lines: string[]; gameColors: Map<number, GameColor> } {
    const lines = mapLines.map(l => l.padEnd(termWidth, ' ').slice(0, termWidth));
    const gameColors = new Map<number, GameColor>();

    const maxHeight = lines.length;
    const maxWidth = termWidth;

    const gamesWithPos = games.map((game, idx) => {
        const pos = getTeamPosition(game.homeTeam.teamTricode);
        const isSelected = idx === selectedIndex;
        // Note: We duplicate the filter logic here essentially by calling the helper, 
        // passing the full game object is safest.
        // We need to ensure searching covers city/name too, previously checkGameMatchesFilter used tricode only in some versions?
        // Let's ensure checkGameMatchesFilter is robust (I updated it above to include city/name).
        const isHighlighted = checkGameMatchesFilter(game, searchFilter);
        const heat = heatMap[game.gameId];
        const marker = createGameMarker(game, isSelected, isHighlighted, undefined, heat);
        return {
            game,
            idx,
            row: percentToChar(pos.y, maxHeight),
            col: percentToChar(pos.x, maxWidth),
            markerLen: marker.length,
            isLive: game.gameStatus === 2,
            isSelected,
            isHighlighted,
            heat
        };
    });

    gamesWithPos.sort((a, b) => a.col - b.col);

    const occupiedRanges = new Map<number, Array<{ start: number; end: number }>>();

    for (const gamePos of gamesWithPos) {
        const { idx, markerLen, isLive, isSelected, isHighlighted, heat } = gamePos;
        let { row, col } = gamePos;
        const marker = createGameMarker(gamePos.game, isSelected, isHighlighted, undefined, heat);

        col = Math.max(0, Math.min(col, maxWidth - markerLen));
        row = Math.max(0, Math.min(row, maxHeight - 1));

        const MIN_GAP = 3;

        let attempts = 0;
        while (attempts < maxHeight) {
            const ranges = occupiedRanges.get(row) || [];
            const hasCollision = ranges.some(r =>
                (col < r.end + MIN_GAP && col + markerLen > r.start - MIN_GAP)
            );

            if (!hasCollision) break;
            row = (row + 1) % maxHeight;
            attempts++;
        }

        const ranges = occupiedRanges.get(row) || [];
        ranges.push({ start: col, end: col + markerLen });
        occupiedRanges.set(row, ranges);

        const line = lines[row];
        if (line) {
            const before = line.slice(0, col);
            const after = line.slice(col + markerLen);
            lines[row] = before + marker + after;
            gameColors.set(idx, { row, col, isLive, isSelected, isHighlighted, heat });
        }
    }

    return { lines, gameColors };
}
