/**
 * Global State Store using Zustand
 * Manages app state including games, selected game, and UI state
 */
import { create } from 'zustand';
import { Game, fetchTodayGames, checkHealth } from '../services/apiClient';

interface AppState {
    // Data
    games: Game[];
    selectedGameIndex: number;

    // UI State
    isLoading: boolean;
    error: string | null;
    dataServiceConnected: boolean;
    lastRefresh: Date | null;

    // Actions
    setGames: (games: Game[]) => void;
    selectGame: (index: number) => void;
    selectNextGame: () => void;
    selectPrevGame: () => void;
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
    setConnected: (connected: boolean) => void;

    // Async Actions
    fetchGames: () => Promise<void>;
    checkConnection: () => Promise<boolean>;
}

export const useStore = create<AppState>((set, get) => ({
    // Initial State
    games: [],
    selectedGameIndex: 0,
    isLoading: false,
    error: null,
    dataServiceConnected: false,
    lastRefresh: null,

    // Setters
    setGames: (games) => set({ games, lastRefresh: new Date() }),
    selectGame: (index) => set({ selectedGameIndex: index }),

    selectNextGame: () => {
        const { games, selectedGameIndex } = get();
        if (games.length === 0) return;
        const nextIndex = (selectedGameIndex + 1) % games.length;
        set({ selectedGameIndex: nextIndex });
    },

    selectPrevGame: () => {
        const { games, selectedGameIndex } = get();
        if (games.length === 0) return;
        const prevIndex = selectedGameIndex === 0 ? games.length - 1 : selectedGameIndex - 1;
        set({ selectedGameIndex: prevIndex });
    },

    setLoading: (isLoading) => set({ isLoading }),
    setError: (error) => set({ error }),
    setConnected: (dataServiceConnected) => set({ dataServiceConnected }),

    // Async Actions
    fetchGames: async () => {
        set({ isLoading: true, error: null });
        try {
            const games = await fetchTodayGames();
            set({ games, isLoading: false, lastRefresh: new Date() });
        } catch (error) {
            set({
                error: error instanceof Error ? error.message : 'Failed to fetch games',
                isLoading: false
            });
        }
    },

    checkConnection: async () => {
        const connected = await checkHealth();
        set({ dataServiceConnected: connected });
        return connected;
    },
}));
