
import { getTeamPosition } from '../data/teamCoords.js';
import type { Game } from '../services/apiClient.js';

// Get geographic positions for all games
export function getGamePositions(games: Game[]): Array<{ idx: number; x: number; y: number }> {
    return games.map((game, idx) => {
        const pos = getTeamPosition(game.homeTeam.teamTricode);
        return { idx, x: pos.x, y: pos.y };
    });
}

// Find nearest game in a given direction
export function findNearestGame(
    games: Game[],
    currentIndex: number,
    direction: 'up' | 'down' | 'left' | 'right'
): number {
    if (games.length <= 1) return currentIndex;

    const positions = getGamePositions(games);
    const current = positions.find(p => p.idx === currentIndex);
    // If current selected game is not in list (e.g. filtered out or weird state), default to 0
    if (!current) return 0;

    let bestIdx = currentIndex;
    let bestScore = Infinity;

    for (const pos of positions) {
        if (pos.idx === currentIndex) continue;

        const dx = pos.x - current.x;
        const dy = pos.y - current.y;

        // Check if this game is in the correct direction
        let isValidDirection = false;
        let primaryDistance = 0;
        let secondaryDistance = 0;

        switch (direction) {
            case 'up':
                isValidDirection = dy < -2;
                primaryDistance = Math.abs(dy);
                secondaryDistance = Math.abs(dx);
                break;
            case 'down':
                isValidDirection = dy > 2;
                primaryDistance = Math.abs(dy);
                secondaryDistance = Math.abs(dx);
                break;
            case 'left':
                isValidDirection = dx < -2;
                primaryDistance = Math.abs(dx);
                secondaryDistance = Math.abs(dy);
                break;
            case 'right':
                isValidDirection = dx > 2;
                primaryDistance = Math.abs(dx);
                secondaryDistance = Math.abs(dy);
                break;
        }

        if (isValidDirection) {
            const score = primaryDistance + secondaryDistance * 0.3;
            if (score < bestScore) {
                bestScore = score;
                bestIdx = pos.idx;
            }
        }
    }

    // Wrap around logic if no game found in direction
    if (bestIdx === currentIndex) {
        let furthestIdx = currentIndex;
        let furthestValue = -Infinity;

        for (const pos of positions) {
            if (pos.idx === currentIndex) continue;
            let value = 0;
            switch (direction) {
                case 'up': value = pos.y; break;
                case 'down': value = -pos.y; break;
                case 'left': value = pos.x; break;
                case 'right': value = -pos.x; break;
            }
            if (value > furthestValue) {
                furthestValue = value;
                furthestIdx = pos.idx;
            }
        }
        bestIdx = furthestIdx;
    }

    return bestIdx;
}
