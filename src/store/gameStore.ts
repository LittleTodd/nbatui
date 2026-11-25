
import { create } from 'zustand';
import { type Game, type GameOdds, fetchGamesByDate, checkHealth, fetchPolymarketOdds, consumeApiDiagnostics } from '../services/apiClient.js';
import { format, subDays } from 'date-fns';
import { getTeamPosition } from '../data/teamCoords.js';

interface GameState {
    games: Game[];
    odds: Record<string, GameOdds>;
    currentDate: Date;
    selectedIndex: number;
    connected: boolean;
    loading: boolean;
    lastUpdated: Date;
    dataWarning: string | null;
    dataWarningDetails: string[];
    spoilerFree: boolean;

    // Actions
    setGames: (games: Game[]) => void;
    setCurrentDate: (date: Date) => void;
    setSelectedIndex: (index: number) => void;
    setLoading: (loading: boolean) => void;
    setDataWarning: (warning: string | null, details?: string[]) => void;
    toggleSpoilerFree: () => void;
    checkConnection: () => Promise<void>;
    loadGamesForDate: (date: Date, isBackgroundRefresh?: boolean) => Promise<void>;
    refreshGames: () => Promise<void>;
    moveSelection: (direction: 'up' | 'down') => void;
    changeDate: (direction: 'prev' | 'next') => void;
}

// Track request sequence to prevent out-of-order race conditions when switching dates rapidly
let activeLoadSequence = 0;

function jsonEqual(a: unknown, b: unknown): boolean {
    try {
        return JSON.stringify(a) === JSON.stringify(b);
    } catch {
        return false;
    }
}

export const useGameStore = create<GameState>((set, get) => ({
    games: [],
    odds: {},
    currentDate: new Date(),
    selectedIndex: 0,
    connected: false,
    loading: true,
    lastUpdated: new Date(),
    dataWarning: null,
    dataWarningDetails: [],
    spoilerFree: false,

    setGames: (games) => set({ games }),
    setCurrentDate: (date) => set({ currentDate: date }),
    setSelectedIndex: (index) => set({ selectedIndex: index }),
    setLoading: (loading) => set({ loading }),
    setDataWarning: (warning, details = []) => set({ dataWarning: warning, dataWarningDetails: details }),
    toggleSpoilerFree: () => set((state) => ({ spoilerFree: !state.spoilerFree })),

    checkConnection: async () => {
        const isHealthy = await checkHealth();
        const prev = get();

        if (isHealthy) {
            if (!prev.connected) {
                set({ connected: true });
            }
            return;
        }

        const nextWarning = 'Connection issue: data-service unreachable';
        if (prev.connected || prev.dataWarning !== nextWarning) {
            set({
                connected: false,
                dataWarning: nextWarning,
                dataWarningDetails: ['Health check failed']
            });
        }
    },

    loadGamesForDate: async (date: Date, isBackgroundRefresh = false) => {
        const requestSeq = ++activeLoadSequence;
        if (!isBackgroundRefresh) {
            // Keep currentDate synchronized whenever a non-background load (e.g. 't' Jump to Today) is triggered
            set({ loading: true, currentDate: date });
        }

        const localDateStr = format(date, 'yyyy-MM-dd');

        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfYesterday = subDays(startOfToday, 1);
        const isPastDate = date.getTime() < startOfYesterday.getTime();

        const gamesPromise = fetchGamesByDate(localDateStr);

        let gamesData: Game[] = [];
        let oddsData: Record<string, GameOdds> = {};

        try {
            if (isPastDate) {
                [gamesData] = await Promise.all([gamesPromise]);
            } else {
                [gamesData, oddsData] = await Promise.all([
                    gamesPromise,
                    fetchPolymarketOdds()
                ]);
            }

            if (requestSeq !== activeLoadSequence) {
                return;
            }

            const prev = get();
            const diagnostics = consumeApiDiagnostics();
            const gamesFetchFailed = diagnostics.some(d => d.operation === 'fetchGamesByDate');

            // Preserve existing games on transient background refresh failure so active Detail View is never unmounted/deadlocked
            if (isBackgroundRefresh && gamesFetchFailed && gamesData.length === 0 && prev.games.length > 0) {
                const latest = diagnostics[diagnostics.length - 1];
                const recent = diagnostics.slice(-3).map(d => `${d.operation} (${d.message})`);
                const nextWarning = latest ? `Stale data: ${latest.operation}` : 'Stale data: refresh failed';
                if (prev.loading || prev.dataWarning !== nextWarning) {
                    set({
                        loading: false,
                        dataWarning: nextWarning,
                        dataWarningDetails: recent
                    });
                }
                return;
            }

            let newSelectedIndex = 0;
            const currentSelectedIndex = prev.selectedIndex;
            if (isBackgroundRefresh) {
                const selectedGameId = prev.games[currentSelectedIndex]?.gameId;
                if (selectedGameId) {
                    const foundIndex = gamesData.findIndex(g => g.gameId === selectedGameId);
                    if (foundIndex !== -1) {
                        newSelectedIndex = foundIndex;
                    } else {
                        newSelectedIndex = Math.min(currentSelectedIndex, Math.max(0, gamesData.length - 1));
                    }
                } else {
                    newSelectedIndex = Math.min(currentSelectedIndex, Math.max(0, gamesData.length - 1));
                }
            } else {
                newSelectedIndex = 0;
            }

            // Compute next warning state so everything commits in ONE atomic set() call
            let nextWarning: string | null = prev.dataWarning;
            let nextWarningDetails: string[] = prev.dataWarningDetails;
            if (diagnostics.length > 0) {
                const latest = diagnostics[diagnostics.length - 1];
                const recent = diagnostics.slice(-3).map(d => `${d.operation} (${d.message})`);
                if (latest) {
                    nextWarning = `Data degraded: ${latest.operation}`;
                    nextWarningDetails = recent;
                }
            } else if (prev.connected) {
                nextWarning = null;
                nextWarningDetails = [];
            }

            // On background refresh, preserve object references and skip set() entirely if nothing changed
            // to prevent unnecessary full-screen Ink re-renders / flicker.
            const gamesUnchanged = isBackgroundRefresh && jsonEqual(prev.games, gamesData);
            const oddsUnchanged = isBackgroundRefresh && jsonEqual(prev.odds, oddsData);
            const indexUnchanged = newSelectedIndex === prev.selectedIndex;
            const warningUnchanged = nextWarning === prev.dataWarning;

            if (isBackgroundRefresh && gamesUnchanged && oddsUnchanged && indexUnchanged && warningUnchanged && !prev.loading) {
                return;
            }

            set({
                games: gamesUnchanged ? prev.games : gamesData,
                odds: oddsUnchanged ? prev.odds : oddsData,
                lastUpdated: new Date(),
                loading: false,
                selectedIndex: newSelectedIndex,
                dataWarning: nextWarning,
                dataWarningDetails: nextWarningDetails,
            });
        } catch (error) {
            if (requestSeq !== activeLoadSequence) {
                return;
            }
            const errorMsg = error instanceof Error ? error.message : String(error);
            set({
                loading: false,
                dataWarning: 'Data load failed',
                dataWarningDetails: [`loadGamesForDate exception: ${errorMsg}`]
            });
        }
    },

    refreshGames: async () => {
        const { currentDate, loadGamesForDate, checkConnection } = get();
        await checkConnection();
        await loadGamesForDate(currentDate, true);
    },

    moveSelection: (direction) => {
        const { selectedIndex, games } = get();
        if (games.length === 0) return;

        const sortedByY = [...games].map((game, originalIndex) => ({
            game,
            originalIndex,
            y: getTeamPosition(game.homeTeam.teamTricode).y
        })).sort((a, b) => a.y - b.y);

        const currentSortedIndex = sortedByY.findIndex(g => g.originalIndex === selectedIndex);

        let newSortedIndex: number;
        if (direction === 'up') {
            newSortedIndex = currentSortedIndex > 0 ? currentSortedIndex - 1 : sortedByY.length - 1;
        } else {
            newSortedIndex = currentSortedIndex < sortedByY.length - 1 ? currentSortedIndex + 1 : 0;
        }

        const newGame = sortedByY[newSortedIndex];
        if (newGame) {
            set({ selectedIndex: newGame.originalIndex });
        }
    },

    changeDate: (direction) => {
        const { currentDate } = get();
        const newDate = new Date(currentDate);
        if (direction === 'prev') {
            newDate.setDate(newDate.getDate() - 1);
        } else {
            newDate.setDate(newDate.getDate() + 1);
        }
        set({ currentDate: newDate });
    },
}));
