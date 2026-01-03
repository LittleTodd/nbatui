
import type { Game, GameOdds } from '../services/apiClient.js';
import type { HeatData } from '../hooks/useSocialHeat.js';
import { getTeamPosition } from '../data/teamCoords.js';

// Convert percentage position to character position
export function percentToChar(percent: number, maxChars: number): number {
    return Math.round((percent / 100) * (maxChars - 1));
}

// Create a marker for a game without number prefix
export function createGameMarker(
    game: Game,
    isSelected: boolean,
    isHighlighted: boolean = false,
    odds?: GameOdds,
    heat?: HeatData,
    isCrunchTime: boolean = false
): string {
    const isLive = game.gameStatus === 2;
    const isFuture = game.gameStatus === 1;

    const away = game.awayTeam.teamTricode;
    const home = game.homeTeam.teamTricode;
    const awayScore = game.awayTeam.score;
    const homeScore = game.homeTeam.score;

    let content = '';

    if (isFuture) {
        content = `${away}-${home}`;
        // Hover Stat: Odds
        if (isSelected && odds) {
            const spread = odds.homeOdds < 0 ? odds.homeOdds : `+${odds.homeOdds}`; // Simplified logic, usually we use spread from Odds object, but here we only have probabilities in some versions?
            // Actually GameOdds has homeOdds / awayOdds which might be probabilities or moneyline.
            // Let's assume we want to show probability for now or simple spread if available.
            // Our GameOdds interface has 'awayOdds', 'homeOdds'.
            // Let's show "52%" probability?
            const prob = Math.round(Math.max(odds.homeProb, odds.awayProb));
            const fav = odds.homeProb > odds.awayProb ? home : away;
            content += ` (${fav} ${prob}%)`;
        }
    } else {
        content = `${away} ${awayScore}-${homeScore} ${home}`;
        // Hover Stat: Detailed Status
        if (isSelected && isLive) {
            content += ` [${game.gameStatusText}]`;
        }
    }

    // Add live indicator prefix if game is live
    const livePrefix = isLive ? '●● ' : '';

    // Add Heat Icon to marker if very hot
    const heatSuffix = (heat?.level === 'fire' || heat?.level === 'hot') ? ' 🔥' : '';

    if (isSelected) {
        return `${livePrefix}[${content}${heatSuffix}]`;
    } else if (isHighlighted) {
        return `${livePrefix}»${content}${heatSuffix}«`;
    } else if (isCrunchTime) {
        return `❗ ${content}${heatSuffix}`;
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
    return game.homeTeam.teamTricode.toLowerCase().includes(lowerFilter) ||
        game.homeTeam.teamCity.toLowerCase().includes(lowerFilter) ||
        game.homeTeam.teamName.toLowerCase().includes(lowerFilter) ||
        game.awayTeam.teamTricode.toLowerCase().includes(lowerFilter) ||
        game.awayTeam.teamCity.toLowerCase().includes(lowerFilter) ||
        game.awayTeam.teamName.toLowerCase().includes(lowerFilter);
}

export interface GameColor {
    row: number;
    col: number;
    isLive: boolean;
    isSelected: boolean;
    isHighlighted: boolean;
    heat?: HeatData;
    isCrunchTime?: boolean;
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

        // Crunch Time Logic: 4th Qtr or OT, score diff <= 5
        const isCrunchTime = game.gameStatus === 2 &&
            game.period >= 4 &&
            Math.abs(game.homeTeam.score - game.awayTeam.score) <= 5;

        // Pass isCrunchTime to marker builder if we want it in text, 
        // OR just keep it in GameColor for component level styling.
        // Let's add a "!" prefix in text if crunch time?
        const marker = createGameMarker(game, isSelected, isHighlighted, undefined, heat, isCrunchTime);

        return {
            game,
            idx,
            row: percentToChar(pos.y, maxHeight),
            col: percentToChar(pos.x, maxWidth),
            markerLen: marker.length,
            isLive: game.gameStatus === 2,
            isSelected,
            isHighlighted,
            heat,
            isCrunchTime
        };
    });

    gamesWithPos.sort((a, b) => a.col - b.col);

    const occupiedRanges = new Map<number, Array<{ start: number; end: number }>>();

    for (const gamePos of gamesWithPos) {
        const { idx, markerLen, isLive, isSelected, isHighlighted, heat, isCrunchTime } = gamePos;
        let { row, col } = gamePos;
        const marker = createGameMarker(gamePos.game, isSelected, isHighlighted, undefined, heat, isCrunchTime);

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
            gameColors.set(idx, { row, col, isLive, isSelected, isHighlighted, heat, isCrunchTime });
        }
    }

    return { lines, gameColors };
}
