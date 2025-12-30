/**
 * Auto Refresh Hook
 * Periodically refreshes game data
 */
import { useEffect, useRef } from 'react';
import { useStore } from '../store';

const REFRESH_INTERVAL = 30000; // 30 seconds

export function useAutoRefresh() {
    const { fetchGames, checkConnection } = useStore();
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        // Initial fetch
        checkConnection().then((connected) => {
            if (connected) {
                fetchGames();
            }
        });

        // Set up auto-refresh
        intervalRef.current = setInterval(() => {
            fetchGames();
        }, REFRESH_INTERVAL);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, []);
}
