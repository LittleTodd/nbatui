
import { create } from 'zustand';
import { type Game, type GameOdds, fetchGamesByDate, checkHealth, fetchPolymarketOdds, consumeApiDiagnostics, type ApiClientDiagnostic, type SocialHeat as HeatData } from '../services/apiClient.js';
import { format, subDays, isSameDay } from 'date-fns';
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

    // Actions
    setGames: (games: Game[]) => void;
    setCurrentDate: (date: Date) => void;
    setSelectedIndex: (index: number) => void;
    setLoading: (loading: boolean) => void;
    setDataWarning: (warning: string | null, details?: string[]) => void;
    checkConnection: () => Promise<void>;
    loadGamesForDate: (date: Date, isBackgroundRefresh?: boolean) => Promise<void>;
    refreshGames: () => Promise<void>;
    moveSelection: (direction: 'up' | 'down') => void;
    changeDate: (direction: 'prev' | 'next') => void;

    // Social Heat
    socialHeat: Record<string, HeatData>;
    fetchHeatForGames: () => Promise<void>;
}

export const useGameStore = create<GameState>((set, get) => ({
    games: [],
    odds: {},
    currentDate: new Date(), // Use local date; loadGamesForDate handles ET timezone conversion
    selectedIndex: 0,
    connected: false,
    loading: true,
    lastUpdated: new Date(),
    dataWarning: null,
    dataWarningDetails: [],

    setGames: (games) => set({ games }),
    setCurrentDate: (date) => set({ currentDate: date }),
    setSelectedIndex: (index) => set({ selectedIndex: index }),
    setLoading: (loading) => set({ loading }),
    setDataWarning: (warning, details = []) => set({ dataWarning: warning, dataWarningDetails: details }),

    checkConnection: async () => {
        const isHealthy = await checkHealth();
        set({ connected: isHealthy });

        const diagnostics = consumeApiDiagnostics();
        if (diagnostics.length > 0) {
            const latest = diagnostics[diagnostics.length - 1];
            const recent = diagnostics.slice(-3).map(d => `${d.operation} (${d.message})`);
            set({
                dataWarning: `Connection issue: ${latest.message}`,
                dataWarningDetails: recent
            });
            return;
        }
    },

    loadGamesForDate: async (date: Date, isBackgroundRefresh = false) => {
        if (!isBackgroundRefresh) {
            set({ loading: true });
        }

        // Use local date directly - backend handles timezone conversion
        // Format: YYYY-MM-DD in user's local timezone
        const localDateStr = format(date, 'yyyy-MM-dd');

        // Check if the date is in the past (skip odds for past dates)
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

            let newSelectedIndex = 0;
            const currentSelectedIndex = get().selectedIndex;
            // Determine the new selected index
            if (isBackgroundRefresh) {
                // Try to persist the currently selected game
                const currentGames = get().games;
                const selectedGameId = currentGames[currentSelectedIndex]?.gameId;

                if (selectedGameId) {
                    const foundIndex = gamesData.findIndex(g => g.gameId === selectedGameId);
                    if (foundIndex !== -1) {
                        newSelectedIndex = foundIndex;
                    } else {
                        // Game no longer exists (rare), keep index bounded
                        newSelectedIndex = Math.min(currentSelectedIndex, Math.max(0, gamesData.length - 1));
                    }
                } else {
                    newSelectedIndex = Math.min(currentSelectedIndex, Math.max(0, gamesData.length - 1));
                }
            } else {
                // New date or manual load, reset to 0
                newSelectedIndex = 0;
            }

            set({
                games: gamesData,
                odds: oddsData,
                lastUpdated: new Date(),
                loading: false,
                selectedIndex: newSelectedIndex
            });

            const diagnostics = consumeApiDiagnostics();
            if (diagnostics.length > 0) {
                const latest = diagnostics[diagnostics.length - 1];
                const recent = diagnostics.slice(-3).map(d => `${d.operation} (${d.message})`);
                set({
                    dataWarning: `Data degraded: ${latest.operation}`,
                    dataWarningDetails: recent
                });
            } else {
                set({ dataWarning: null, dataWarningDetails: [] });
            }

            // Trigger background heat fetch
            get().fetchHeatForGames();

        } catch (error) {
            console.error("Failed to load games:", error);
            set({ loading: false, dataWarning: 'Data load failed', dataWarningDetails: ['loadGamesForDate exception'] });
        }
    },

    refreshGames: async () => {
        const { currentDate, loadGamesForDate, checkConnection } = get();
        await loadGamesForDate(currentDate, true);
        await checkConnection();
    },

    moveSelection: (direction) => {
        const { selectedIndex, games } = get();
        if (games.length === 0) return;

        // Sort games by Y coordinate (top to bottom on map)
        // Using homeTeam's position as the reference
        const sortedByY = [...games].map((game, originalIndex) => ({
            game,
            originalIndex,
            y: getTeamPosition(game.homeTeam.teamTricode).y
        })).sort((a, b) => a.y - b.y);

        // Find current game's position in the sorted list
        const currentSortedIndex = sortedByY.findIndex(g => g.originalIndex === selectedIndex);

        let newSortedIndex: number;
        if (direction === 'up') {
            // Move to game higher on map (lower Y value)
            newSortedIndex = currentSortedIndex > 0 ? currentSortedIndex - 1 : sortedByY.length - 1;
        } else {
            // Move to game lower on map (higher Y value)
            newSortedIndex = currentSortedIndex < sortedByY.length - 1 ? currentSortedIndex + 1 : 0;
        }

        // Set the new selected index using the original array index
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
        // Changing date triggers useEffect in component usually, but here we might want to trigger load directly
        // However, standard pattern is to update state and let React effect handle data fetching?
        // OR we handle it here. Let's start by just setting date, and we'll call loadGamesForDate in a store subscription or component effect.
        set({ currentDate: newDate });
    },

    // Heat Map State
    socialHeat: {},

    setSocialHeat: (heatMap: Record<string, HeatData>) => set({ socialHeat: heatMap }),

    // Fetch heat for current games (with rate limiting to avoid Reddit 429)
    fetchHeatForGames: async () => {
        const { games } = get();
        if (games.length === 0) return;

        const { fetchGameHeat } = await import('../services/apiClient.js');

        const heatMap: Record<string, HeatData> = {};

        // Fetch sequentially with delay to avoid Reddit rate limiting (429)
        // Limit to first 3 games for map overview heat display
        const gamesToFetch = games.slice(0, 3);

        for (const game of gamesToFetch) {
            // Skip scheduled games - no Reddit Game Thread exists yet
            if (game.gameStatus === 1) continue;

            const gameDateStr = game.gameTimeUTC?.slice(0, 10);
            if (!gameDateStr) continue;

            try {
                const heat = await fetchGameHeat(
                    game.awayTeam.teamName,
                    game.homeTeam.teamName,
                    game.gameStatus,
                    gameDateStr,
                    game.gameId
                );

                if (heat) {
                    heatMap[game.gameId] = heat;
                }
            } catch {
                // Silently skip on error
            }

            // Small delay between requests to respect Reddit rate limits
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        set({ socialHeat: heatMap });

        const diagnostics = consumeApiDiagnostics();
        if (diagnostics.length > 0) {
            const latest = diagnostics[diagnostics.length - 1];
            const recent = diagnostics.slice(-3).map((d: ApiClientDiagnostic) => `${d.operation} (${d.message})`);
            set({
                dataWarning: `Social data unavailable for some games`,
                dataWarningDetails: recent
            });
        }
    },
}));
