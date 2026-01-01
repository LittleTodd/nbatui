
import { create } from 'zustand';
import { type Game, type GameOdds, fetchTodayGames, fetchGamesByDate, checkHealth, fetchPolymarketOdds, getOddsKey } from '../services/apiClient.js';
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

        const offset = new Date().getTimezoneOffset();
        let queryDate = date;
        const isViewingToday = isSameDay(date, new Date());

        if (offset <= 0) {
            queryDate = subDays(date, 1);
        }

        const dateStr = format(queryDate, 'yyyy-MM-dd');

        // Check if the date is DEEP in the past
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfYesterday = subDays(startOfToday, 1);
        const isPastDate = queryDate.getTime() < startOfYesterday.getTime();

        const gamesPromise = isViewingToday
            ? fetchTodayGames()
            : fetchGamesByDate(dateStr);

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
    }
}));
