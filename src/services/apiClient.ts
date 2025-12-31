/**
 * API Client for NBA Data Service
 * Fetches game data from the Python FastAPI backend
 */

const BASE_URL = process.env.DATA_SERVICE_URL || 'http://localhost:8765';

export interface Team {
    teamId: number;
    teamName: string;
    teamCity: string;
    teamTricode: string;
    score: number;
}

export interface Game {
    gameId: string;
    gameStatus: number; // 1=Scheduled, 2=InProgress, 3=Final
    gameStatusText: string;
    period: number;
    gameClock: string;
    gameTimeUTC: string;
    homeTeam: Team;
    awayTeam: Team;
}

export interface GamesResponse {
    games: Game[];
    count: number;
}

export interface HealthResponse {
    status: string;
    service: string;
}

/**
 * Check if data service is available
 */
export async function checkHealth(): Promise<boolean> {
    try {
        const res = await fetch(`${BASE_URL}/health`, {
            signal: AbortSignal.timeout(3000)
        });
        const data: HealthResponse = await res.json();
        return data.status === 'ok';
    } catch {
        return false;
    }
}

/**
 * Fetch today's games
 */
export async function fetchTodayGames(): Promise<Game[]> {
    try {
        const res = await fetch(`${BASE_URL}/games/today`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: GamesResponse = await res.json();
        return data.games;
    } catch (error) {
        console.error('Failed to fetch games:', error);
        return [];
    }
}

/**
 * Fetch games for a specific date (YYYY-MM-DD)
 */
export async function fetchGamesByDate(date: string): Promise<Game[]> {
    try {
        const res = await fetch(`${BASE_URL}/games/date/${date}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: GamesResponse = await res.json();
        return data.games;
    } catch (error) {
        console.error(`Failed to fetch games for ${date}:`, error);
        return [];
    }
}

/**
 * Fetch live games only
 */
export async function fetchLiveGames(): Promise<Game[]> {
    try {
        const res = await fetch(`${BASE_URL}/games/live`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: GamesResponse = await res.json();
        return data.games;
    } catch (error) {
        console.error('Failed to fetch live games:', error);
        return [];
    }
}

/**
 * Get game status display info
 */
export function getGameStatusInfo(game: Game): { text: string; isLive: boolean; isFinal: boolean } {
    const isLive = game.gameStatus === 2;
    const isFinal = game.gameStatus === 3;

    let text = game.gameStatusText;
    if (isLive && game.period > 0) {
        const periodText = game.period <= 4 ? `Q${game.period}` : `OT${game.period - 4}`;
        text = game.gameClock ? `${periodText} ${game.gameClock}` : periodText;
    }

    return { text, isLive, isFinal };
}

export async function fetchBoxScore(gameId: string): Promise<any> {
    try {
        const res = await fetch(`${BASE_URL}/games/${gameId}/boxscore`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (error) {
        console.error('Failed to fetch boxscore:', error);
        return null;
    }
}

export async function fetchPlayByPlay(gameId: string): Promise<any> {
    try {
        const res = await fetch(`${BASE_URL}/games/${gameId}/playbyplay`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (error) {
        console.error('Failed to fetch playbyplay:', error);
        return null;
    }
}

export async function fetchStandings(): Promise<any> {
    try {
        const res = await fetch(`${BASE_URL}/games/standings`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (error) {
        console.error('Failed to fetch standings:', error);
        return null;
    }
}

export interface GameOdds {
    awayTeam: string;
    homeTeam: string;
    awayOdds: number;
    homeOdds: number;
    awayProb: number;
    homeProb: number;
    date: string;
    source: string;
}

export interface OddsResponse {
    odds: Record<string, GameOdds>;
    count: number;
}

/**
 * Fetch Polymarket odds for all upcoming games
 */
export async function fetchPolymarketOdds(): Promise<Record<string, GameOdds>> {
    try {
        const res = await fetch(`${BASE_URL}/api/polymarket/odds`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: OddsResponse = await res.json();
        return data.odds;
    } catch (error) {
        console.error('Failed to fetch Polymarket odds:', error);
        return {};
    }
}

/**
 * Get odds key for a game (used for matching)
 */
export function getOddsKey(awayTricode: string, homeTricode: string, date: string): string {
    return `${awayTricode}_${homeTricode}_${date}`;
}
