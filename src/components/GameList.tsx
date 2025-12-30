/**
 * GameList Component  
 * Shows all games in a scrollable list format
 * Used as fallback when map view doesn't fit
 */
import { useStore } from '../store';
import { GameCard } from './GameCard';

export function GameList() {
    const { games, selectedGameIndex } = useStore();

    if (games.length === 0) {
        return (
            <box flexDirection="column" alignItems="center" justifyContent="center" flexGrow={1}>
                <text dimColor>No games scheduled for today</text>
            </box>
        );
    }

    return (
        <box flexDirection="column" alignItems="center" gap={1} paddingY={1}>
            <text bold color="cyan">🏀 Today's Games</text>
            <box flexDirection="row" flexWrap="wrap" gap={1} justifyContent="center">
                {games.map((game, index) => (
                    <GameCard
                        key={game.gameId}
                        game={game}
                        isSelected={index === selectedGameIndex}
                    />
                ))}
            </box>
        </box>
    );
}
