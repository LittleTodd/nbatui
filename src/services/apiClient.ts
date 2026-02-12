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
        const data = (await res.json()) as HealthResponse;
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
        const data = (await res.json()) as GamesResponse;
        return data.games;
    } catch {
        // Silently fail - don't log to terminal (causes flicker)
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
        const data = (await res.json()) as GamesResponse;
        return data.games;
    } catch {
        // Silently fail
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
        const data = (await res.json()) as GamesResponse;
        return data.games;
    } catch {
        // Silently fail
        return [];
    }
}

/**
 * Parse ET time from gameStatusText (e.g., "6:00 pm ET") and convert to local timezone
 * @param statusText - Status text containing ET time (e.g., "6:00 pm ET")
 * @param gameDate - Date string in YYYY-MM-DD format
 * @returns Formatted local time string (e.g., "7:00 am") or empty string if parsing fails
 */
function getNthSundayOfMonth(year: number, month: number, nth: number): number {
    const firstDay = new Date(Date.UTC(year, month - 1, 1)).getUTCDay(); // 0 = Sunday
    const firstSunday = firstDay === 0 ? 1 : 8 - firstDay;
    return firstSunday + (nth - 1) * 7;
}

function isEasternDaylightTime(year: number, month: number, day: number, hour24: number): boolean {
    // US Eastern DST:
    // starts: second Sunday in March at 2:00 AM local time
    // ends:   first Sunday in November at 2:00 AM local time
    if (month < 3 || month > 11) return false;
    if (month > 3 && month < 11) return true;

    if (month === 3) {
        const secondSunday = getNthSundayOfMonth(year, 3, 2);
        if (day > secondSunday) return true;
        if (day < secondSunday) return false;
        return hour24 >= 2;
    }

    const firstSunday = getNthSundayOfMonth(year, 11, 1);
    if (day < firstSunday) return true;
    if (day > firstSunday) return false;
    return hour24 < 2;
}

export function parseETTimeToLocal(statusText: string, gameDate: string): string {
    if (!statusText || !gameDate) return '';

    // Match patterns like "6:00 pm ET", "12:30 am ET", "1:00 pm et"
    const match = statusText.match(/(\d{1,2}):(\d{2})\s*(am|pm)\s*et/i);
    if (!match) return '';

    try {
        let hours = parseInt(match[1] || '0', 10);
        const minutes = parseInt(match[2] || '0', 10);
        const isPM = (match[3] || '').toLowerCase() === 'pm';

        // Convert to 24-hour format
        if (isPM && hours !== 12) hours += 12;
        if (!isPM && hours === 12) hours = 0;

        const [yearStr, monthStr, dayStr] = gameDate.split('-');
        const year = parseInt(yearStr || '', 10);
        const month = parseInt(monthStr || '', 10);
        const day = parseInt(dayStr || '', 10);
        if (!year || !month || !day) return '';

        // Resolve ET offset from DST rules for this local ET date/time.
        const isDst = isEasternDaylightTime(year, month, day, hours);
        const etOffsetHours = isDst ? -4 : -5;

        // Convert local ET clock time to UTC, then render in user's local timezone.
        const utcMs = Date.UTC(year, month - 1, day, hours - etOffsetHours, minutes, 0);
        const etDate = new Date(utcMs);

        // Check if date is valid
        if (isNaN(etDate.getTime())) return '';

        // Format to local time in 12-hour format
        return etDate.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        }).toLowerCase();
    } catch {
        return '';
    }
}

/**
 * Convert UTC game time to user's local timezone in 12-hour format
 * @param gameTimeUTC - ISO 8601 UTC time string (e.g., "2026-01-01T18:00:00Z")
 * @returns Formatted local time string (e.g., "2:00 am")
 */
export function formatGameTimeLocal(gameTimeUTC: string): string {
    if (!gameTimeUTC) return '';

    try {
        // Check if this is just a date (ends with T00:00:00) - if so, return empty
        // as the real time is probably in gameStatusText
        // Note: The API returns dates without Z suffix, so we check the string directly
        if (gameTimeUTC.endsWith('T00:00:00') || gameTimeUTC.endsWith('T00:00:00Z')) {
            return '';
        }

        const date = new Date(gameTimeUTC);
        if (isNaN(date.getTime())) return '';

        // Use Intl.DateTimeFormat to get local time in 12-hour format
        return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        }).toLowerCase();
    } catch {
        return '';
    }
}

/**
 * Get game status display info
 */
export function getGameStatusInfo(game: Game): { text: string; isLive: boolean; isFinal: boolean } {
    const isLive = game.gameStatus === 2;
    const isFinal = game.gameStatus === 3;
    const isScheduled = game.gameStatus === 1;

    let text = game.gameStatusText;

    // For scheduled games, convert time to local timezone
    if (isScheduled) {
        // First try to use gameTimeUTC if it has actual time (not just midnight)
        if (game.gameTimeUTC) {
            const localTime = formatGameTimeLocal(game.gameTimeUTC);
            if (localTime) {
                text = localTime;
            } else {
                // gameTimeUTC is just a date, parse time from gameStatusText
                const gameDate = game.gameTimeUTC.slice(0, 10);
                const parsedTime = parseETTimeToLocal(game.gameStatusText, gameDate);
                if (parsedTime) {
                    text = parsedTime;
                }
                // else keep original gameStatusText
            }
        }
    } else if (isLive && game.period > 0) {
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
    } catch {
        return null;
    }
}

export interface PlayByPlayAction {
    actionNumber: number;
    clock: string;
    period: number;
    periodType: string;
    description: string;
    teamTricode?: string;
    playerNameI?: string;
    scoreHome: string;
    scoreAway: string;
    actionType: string;
    shotResult?: string;
}

export interface PlayByPlayResponse {
    actions: PlayByPlayAction[];
}

export async function fetchPlayByPlay(gameId: string, gameStatus?: number): Promise<PlayByPlayResponse | null> {
    try {
        let url = `${BASE_URL}/games/${gameId}/playbyplay`;
        // Pass status to backend for caching completed games
        if (gameStatus !== undefined) {
            url += `?status=${gameStatus}`;
        }
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as PlayByPlayResponse;
    } catch {
        return null;
    }
}

export interface ScoreCurvePoint {
    time: number;
    homeScore: number;
    awayScore: number;
    period: number;
}

export interface ScoreCurveData {
    points: ScoreCurvePoint[];
    homeTeam: string;
    awayTeam: string;
}

export async function fetchScoreCurve(gameId: string): Promise<ScoreCurveData | null> {
    try {
        const res = await fetch(`${BASE_URL}/games/${gameId}/score-curve`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as ScoreCurveData;
    } catch {
        return null;
    }
}





export async function fetchStandings(): Promise<any> {
    try {
        const res = await fetch(`${BASE_URL}/games/standings`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch {
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
    volume?: number;
    awayTokenId?: string;
    homeTokenId?: string;
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
        const data = (await res.json()) as OddsResponse;
        return data.odds;
    } catch {
        return {};
    }
}

/**
 * Get odds key for a game (used for matching)
 */
export function getOddsKey(awayTricode: string, homeTricode: string, date: string): string {
    return `${awayTricode}_${homeTricode}_${date}`;
}

export interface PricePoint {
    t: number; // timestamp
    p: number; // price
}

export interface HistoryResponse {
    history: PricePoint[];
    count: number;
}

/**
 * Fetch historical prices for a CLOB token
 */
export async function fetchTokenHistory(clobId: string): Promise<PricePoint[]> {
    try {
        const res = await fetch(`${BASE_URL}/api/polymarket/history/${clobId}`);
        if (!res.ok) return [];
        const data = (await res.json()) as HistoryResponse;
        return data.history;
    } catch {
        return [];
    }
}

export interface Candidate {
    name: string;
    probability: number;
}

export interface PropsResponse {
    props: Record<string, Candidate[]>;
}

export async function fetchPolymarketProps(): Promise<Record<string, Candidate[]>> {
    try {
        const res = await fetch(`${BASE_URL}/api/polymarket/props`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as PropsResponse;
        return data.props;
    } catch {
        return {};
    }
}

export interface SocialHeat {
    count: number;
    level: 'cold' | 'warm' | 'hot' | 'fire';
    trending: boolean;
    url?: string;
}

export interface Tweet {
    id: string;
    text: string;
    user: string;
    likes: number;
}

export interface TweetsResponse {
    tweets: Tweet[];
}


export async function fetchGameHeat(team1: string, team2: string, status?: number, date?: string, gameId?: string): Promise<SocialHeat | null> {
    try {
        let url = `${BASE_URL}/social/heat/${team1}/${team2}`;
        const params = new URLSearchParams();
        if (status) params.append('status', status.toString());
        if (date) params.append('date', date);
        if (gameId) params.append('game_id', gameId);

        if (params.size > 0) url += `?${params.toString()}`;

        const res = await fetch(url);
        if (!res.ok) return null;
        return (await res.json()) as SocialHeat;
    } catch {
        return null;
    }
}

/**
 * Fetch top tweets/comments for a game
 */
export async function fetchGameTweets(team1: string, team2: string, status?: number, date?: string, gameId?: string): Promise<Tweet[]> {
    try {
        let url = `${BASE_URL}/social/tweets/${team1}/${team2}`;
        const params = new URLSearchParams();
        if (status) params.append('status', status.toString());
        if (date) params.append('date', date);
        if (gameId) params.append('game_id', gameId);

        if (params.size > 0) url += `?${params.toString()}`;

        const res = await fetch(url);
        if (!res.ok) return [];
        const data = (await res.json()) as TweetsResponse;
        return data.tweets;
    } catch {
        return [];
    }
}

// ==================== TEAM DATA ====================

export interface PlayerStats {
    gp: number;
    ppg: number;
    rpg: number;
    apg: number;
    spg: number;
    bpg: number;
    fgPct: number;
    fg3Pct: number;
    ftPct: number;
    min: number;
}

export interface RosterPlayer {
    playerId: number;
    name: string;
    num: string;
    position: string;
    height: string;
    weight: string;
    age: number;
    exp: string;
    school: string;
    stats?: PlayerStats;
}

export interface Coach {
    coachId: number;
    name: string;
    type: string;
    isAssistant: number;
}

export interface TeamRoster {
    teamId: number;
    players: RosterPlayer[];
    coaches: Coach[];
}

export interface GameLogEntry {
    gameId: string;
    date: string;
    matchup: string;
    result: 'W' | 'L';
    wins: number;
    losses: number;
    points: number;
    oppPoints: number;  // Opponent's score
    plusMinus: number;
    fgm: number;
    fga: number;
    fgPct: number;
    fg3m: number;
    fg3a: number;
    fg3Pct: number;
    ftm: number;
    fta: number;
    ftPct: number;
    reb: number;
    ast: number;
    stl: number;
    blk: number;
    tov: number;
}

export interface TeamGamelog {
    teamId: number;
    games: GameLogEntry[];
    streak: number;
    streakType: 'W' | 'L' | '';
}

export interface TeamBackground {
    nickname: string;
    city: string;
    arena: string;
    arenaCapacity: string;
    owner: string;
    gm: string;
    headCoach: string;
    dLeagueAffiliate: string;
    yearFounded: number;
}

export interface TeamSeasonInfo {
    seasonYear: string;
    teamCity: string;
    teamName: string;
    tricode: string;
    conference: string;
    division: string;
    wins: number;
    losses: number;
    pct: number;
    confRank: number;
    divRank: number;
}

export interface TeamSeasonRanks {
    ptsRank: number;
    ptsPg: number;
    rebRank: number;
    rebPg: number;
    astRank: number;
    astPg: number;
    oppPtsRank: number;
    oppPtsPg: number;
}

export interface RetiredNumber {
    playerId: number;
    player: string;
    jersey: string;
    position: string;
}

export interface HallOfFamer {
    playerId: number;
    player: string;
    position: string;
    year: number;
}

export interface TeamInfo {
    teamId: number;
    background: TeamBackground;
    seasonInfo: TeamSeasonInfo;
    seasonRanks: TeamSeasonRanks;
    championships: { year: number }[];
    confTitles: { year: number }[];
    divTitles: { year: number }[];
    retiredNumbers: RetiredNumber[];
    hallOfFame: HallOfFamer[];
}

/**
 * Fetch team roster with player stats
 */
export async function fetchTeamRoster(teamId: number): Promise<TeamRoster | null> {
    try {
        const res = await fetch(`${BASE_URL}/games/team/${teamId}/roster`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as TeamRoster;
    } catch {
        return null;
    }
}

/**
 * Fetch team's recent game log
 */
export async function fetchTeamGamelog(teamId: number, lastN: number = 10): Promise<TeamGamelog | null> {
    try {
        const res = await fetch(`${BASE_URL}/games/team/${teamId}/gamelog?last_n=${lastN}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as TeamGamelog;
    } catch {
        return null;
    }
}

/**
 * Fetch team details and season info
 */
export async function fetchTeamInfo(teamId: number): Promise<TeamInfo | null> {
    try {
        const res = await fetch(`${BASE_URL}/games/team/${teamId}/info`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as TeamInfo;
    } catch {
        return null;
    }
}
