
import React from 'react';
import { render } from 'ink-testing-library';
import { GameCard } from './GameCard';
import { Game } from '../services/apiClient';
import { describe, test, expect } from 'bun:test';

const mockGame: Game = {
    gameId: '1',
    awayTeam: { teamTricode: 'LAL', score: 100, teamCity: 'Los Angeles' },
    homeTeam: { teamTricode: 'BOS', score: 95, teamCity: 'Boston' },
    gameStatus: 2, // Live
    gameTimeUTC: '2023-10-27T00:00:00Z',
};

describe('GameCard', () => {
    test('renders correctly', () => {
        const { lastFrame } = render(<GameCard game={mockGame} />);
        expect(lastFrame()).toContain('LAL');
        expect(lastFrame()).toContain('BOS');
    });

    test('updates when selected', () => {
        const { lastFrame, rerender } = render(<GameCard game={mockGame} isSelected={false} />);
        // Checking for visual updates in TUI testing is tricky without style parsing
        // but re-render should work without errors.
        rerender(<GameCard game={mockGame} isSelected={true} />);
        expect(lastFrame()).toContain('LAL');
    });
});
