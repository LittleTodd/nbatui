
import { create } from 'zustand';
import { type Game, type GameOdds, fetchTodayGames, fetchGamesByDate, checkHealth, fetchPolymarketOdds, getOddsKey, type SocialHeat as HeatData } from '../services/apiClient.js';
import { format, subDays, isSameDay } from 'date-fns';

interface GameState {
    games: Game[];
    odds: Record<string, GameOdds>;
    currentDate: Date;
    selectedIndex: number;
    connected: boolean;
    loading: boolean;
    lastUpdated: Date;

    // Actions
    setGames: (games: Game[]) => void;
    setCurrentDate: (date: Date) => void;
    setSelectedIndex: (index: number) => void;
    setLoading: (loading: boolean) => void;
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
    currentDate: new Date(),
    selectedIndex: 0,
    connected: false,
    loading: true,
    lastUpdated: new Date(),

    setGames: (games) => set({ games }),
    setCurrentDate: (date) => set({ currentDate: date }),
    setSelectedIndex: (index) => set({ selectedIndex: index }),
    setLoading: (loading) => set({ loading }),

    checkConnection: async () => {
        const isHealthy = await checkHealth();
        set({ connected: isHealthy });
    },

    loadGamesForDate: async (date: Date, isBackgroundRefresh = false) => {
        if (!isBackgroundRefresh) {
            set({ loading: true });
        }

        // Precise Calculation: Map "Local Day" to "NBA Day"
        // We take the Midnight of the selected Local Date, and see what date it is in ET (New York).
        // This handles all timezones (Asia, Europe, etc.) accurately.

        // 1. Get timestamp of Local Midnight
        const localMidnight = new Date(date);
        localMidnight.setHours(0, 0, 0, 0);

        // 2. Format to ET Date String (YYYY-MM-DD)
        const etDateStr = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'America/New_York',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(localMidnight);

        // Check if the date is DEEP in the past (using local date relative to now)
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfYesterday = subDays(startOfToday, 1);
        const isPastDate = date.getTime() < startOfYesterday.getTime();

        const gamesPromise = fetchGamesByDate(etDateStr);

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

            set({
                games: gamesData,
                odds: oddsData,
                lastUpdated: new Date(),
                loading: false
            });

            if (!isBackgroundRefresh && gamesData.length > 0) {
                set({ selectedIndex: 0 });
            }

            // Trigger background heat fetch
            get().fetchHeatForGames();

        } catch (error) {
            console.error("Failed to load games:", error);
            set({ loading: false });
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

        if (direction === 'up') {
            set({ selectedIndex: selectedIndex > 0 ? selectedIndex - 1 : games.length - 1 });
        } else {
            set({ selectedIndex: selectedIndex < games.length - 1 ? selectedIndex + 1 : 0 });
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

    // Fetch heat for all current games (in parallel)
    fetchHeatForGames: async () => {
        const { games } = get();
        if (games.length === 0) return;

        const { fetchGameHeat } = await import('../services/apiClient.js');

        const heatMap: Record<string, HeatData> = {};

        // Use Promise.all to fetch in parallel
        await Promise.all(games.map(async (game) => {
            // Skip old games (simple 6 month check here or rely on backend return empty)
            // Backend handles 6 month check now, returns empty/cold.
            // But we can skip fetch if we want to save bandwidth.
            // Let's just fetch, backend is fast with cache.
            const gameDateStr = game.gameTimeUTC?.slice(0, 10);
            if (!gameDateStr) return;

            const heat = await fetchGameHeat(
                game.awayTeam.teamTricode,
                game.homeTeam.teamTricode,
                game.gameStatus,
                gameDateStr
            );

            if (heat) {
                // Determine level if not provided by backend (backend provides it)
                heatMap[game.gameId] = heat;
            }
        }));

        set({ socialHeat: heatMap });
    },
}));
