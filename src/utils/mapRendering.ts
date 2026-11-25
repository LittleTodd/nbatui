
import type { Game, GameOdds } from '../services/apiClient.js';
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
    isCrunchTime: boolean = false,
    spoilerFree: boolean = false
): string {
    const isLive = game.gameStatus === 2;
    const isFuture = game.gameStatus === 1;

    const away = game.awayTeam.teamTricode;
    const home = game.homeTeam.teamTricode;
    const awayScore = spoilerFree ? '?' : game.awayTeam.score;
    const homeScore = spoilerFree ? '?' : game.homeTeam.score;

    let content = '';

    if (isFuture) {
        content = ` ${away} - ${home} `;
        if (isSelected && odds && !spoilerFree) {
            const prob = Math.round(Math.max(odds.homeProb, odds.awayProb));
            const fav = odds.homeProb > odds.awayProb ? home : away;
            content += `(${fav} ${prob}%)`;
        }
    } else {
        content = ` ${away} ${awayScore}-${homeScore} ${home} `;
        if (isSelected && isLive) {
            content += `[${game.gameStatusText}]`;
        }
    }

    // Use 1-column prefixes so marker.length matches terminal cell width
    const livePrefix = isLive ? '● ' : '';

    if (isSelected) {
        return `▶ ${livePrefix}[${content}]`;
    } else if (isHighlighted) {
        return `${livePrefix}»${content}«`;
    } else if (isCrunchTime) {
        return `! ${content}`;
    } else if (isLive) {
        return `● ${content}`;
    } else {
        return content;
    }
}

// Helper to check if game matches filter (unified .includes() with Enter search selection)
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
    isCrunchTime?: boolean;
}

// Embed game markers into map lines with collision detection
export function embedGamesInMap(
    mapLines: string[],
    games: Game[],
    selectedIndex: number,
    termWidth: number,
    searchFilter: string = '',
    spoilerFree: boolean = false
): { lines: string[]; gameColors: Map<number, GameColor> } {
    const lines = mapLines.map(l => l.padEnd(termWidth, ' ').slice(0, termWidth));
    const gameColors = new Map<number, GameColor>();

    const maxHeight = lines.length;
    const maxWidth = termWidth;
    if (maxHeight === 0) return { lines, gameColors };

    const gamesWithPos = games.map((game, idx) => {
        const pos = getTeamPosition(game.homeTeam.teamTricode);
        const isSelected = idx === selectedIndex;
        const isHighlighted = checkGameMatchesFilter(game, searchFilter);

        let isCrunchTime = false;
        if (game.gameStatus === 2 && game.period >= 4 && Math.abs(game.homeTeam.score - game.awayTeam.score) <= 5) {
            if (game.gameClock) {
                const ptMatch = game.gameClock.match(/PT(\d+)M/);
                if (ptMatch) {
                    const minutes = parseInt(ptMatch[1] ?? '0', 10);
                    if (minutes < 3) isCrunchTime = true;
                } else if (game.gameClock.includes(':')) {
                    const parts = game.gameClock.split(':');
                    const minutes = parseInt(parts[0] ?? '0', 10);
                    if (minutes < 3) isCrunchTime = true;
                } else if (game.period > 4) {
                    isCrunchTime = true;
                }
            }
        }

        const marker = createGameMarker(game, isSelected, isHighlighted, undefined, isCrunchTime, spoilerFree);

        return {
            game,
            idx,
            marker,
            row: percentToChar(pos.y, maxHeight),
            col: percentToChar(pos.x, maxWidth),
            markerLen: marker.length,
            isLive: game.gameStatus === 2,
            isSelected,
            isHighlighted,
            isCrunchTime
        };
    });

    gamesWithPos.sort((a, b) => a.col - b.col);

    const occupiedRanges = new Map<number, Array<{ start: number; end: number }>>();

    for (const gamePos of gamesWithPos) {
        const { idx, marker, markerLen, isLive, isSelected, isHighlighted, isCrunchTime } = gamePos;
        let { row, col } = gamePos;

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
            gameColors.set(idx, { row, col, isLive, isSelected, isHighlighted, isCrunchTime });
        }
    }

    return { lines, gameColors };
}
