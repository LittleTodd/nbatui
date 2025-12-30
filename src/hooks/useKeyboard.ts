/**
 * Keyboard Hook
 * Handles keyboard input for navigation and actions
 */
import { useKeyboard as useOpenTUIKeyboard } from '@opentui/react';
import { useStore } from '../store';

export function useKeyboard() {
    const { selectNextGame, selectPrevGame, fetchGames, checkConnection } = useStore();

    useOpenTUIKeyboard((key) => {
        const keyName = key.name?.toLowerCase() || '';

        // Navigation
        if (keyName === 'right' || keyName === 'l') {
            selectNextGame();
        }
        if (keyName === 'left' || keyName === 'h') {
            selectPrevGame();
        }
        if (keyName === 'down' || keyName === 'j') {
            selectNextGame();
        }
        if (keyName === 'up' || keyName === 'k') {
            selectPrevGame();
        }

        // Actions
        if (keyName === 'r') {
            checkConnection().then(() => fetchGames());
        }

        // Quit
        if (keyName === 'q') {
            process.exit(0);
        }
    });
}
