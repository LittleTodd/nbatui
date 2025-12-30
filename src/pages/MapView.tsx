/**
 * MapView Page
 * Main view showing NBA games on a geographic map
 */
import { useStore } from '../store';
import { GameCard } from '../components/GameCard';
import { StatusBar } from '../components/StatusBar';
import { GameList } from '../components/GameList';
import { useKeyboard } from '../hooks/useKeyboard';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { getTeamPosition } from '../data/teamCoords';
import { US_MAP_WIDTH, US_MAP_HEIGHT, getCleanMap } from '../data/usMap';

export function MapView() {
    const { games, selectedGameIndex, dataServiceConnected, isLoading } = useStore();

    // Initialize hooks
    useKeyboard();
    useAutoRefresh();

    // Get terminal dimensions (fallback values)
    const termWidth = process.stdout?.columns || 120;
    const termHeight = process.stdout?.rows || 40;

    // Check if we have enough space for map view
    const hasSpaceForMap = termWidth >= 100 && termHeight >= 35;

    // Loading state
    if (!dataServiceConnected && isLoading) {
        return (
            <box flexDirection="column" alignItems="center" justifyContent="center" height={termHeight}>
                <text color="yellow">⟳ Connecting to data service...</text>
                <text dimColor>Make sure the Python service is running on port 8765</text>
            </box>
        );
    }

    // Disconnected state
    if (!dataServiceConnected) {
        return (
            <box flexDirection="column" alignItems="center" justifyContent="center" height={termHeight}>
                <text color="red">✗ Cannot connect to data service</text>
                <text dimColor>Run: ./scripts/start-data-service.sh</text>
                <text dimColor>Press 'r' to retry or 'q' to quit</text>
            </box>
        );
    }

    // Use list view if terminal is too small
    if (!hasSpaceForMap) {
        return (
            <box flexDirection="column" height={termHeight}>
                <GameList />
                <StatusBar />
            </box>
        );
    }

    // Full map view
    return (
        <box flexDirection="column" height={termHeight}>
            {/* Header */}
            <box justifyContent="center" paddingY={1}>
                <text bold color="cyan">🏀 NBA BATTLE MAP 🏀</text>
            </box>

            {/* Main content: Map with game cards */}
            <box flexDirection="column" flexGrow={1} alignItems="center">
                <MapWithGames
                    games={games}
                    selectedIndex={selectedGameIndex}
                    width={Math.min(termWidth, US_MAP_WIDTH)}
                    height={Math.min(termHeight - 5, US_MAP_HEIGHT)}
                />
            </box>

            {/* Status bar */}
            <StatusBar />
        </box>
    );
}

interface MapWithGamesProps {
    games: ReturnType<typeof useStore>['games'];
    selectedIndex: number;
    width: number;
    height: number;
}

function MapWithGames({ games, selectedIndex, width, height }: MapWithGamesProps) {
    const mapLines = getCleanMap();

    // Render map with game cards below
    return (
        <box flexDirection="column">
            {/* Map background */}
            {mapLines.slice(0, height).map((line, rowIndex) => (
                <box key={rowIndex}>
                    <text dimColor>
                        {line.slice(0, width)}
                    </text>
                </box>
            ))}

            {/* Game cards below map */}
            {games.length > 0 && (
                <box flexDirection="row" flexWrap="wrap" justifyContent="center" gap={1} marginTop={1}>
                    {games.map((game, index) => (
                        <GameCard
                            key={game.gameId}
                            game={game}
                            isSelected={index === selectedIndex}
                            compact={games.length > 6}
                        />
                    ))}
                </box>
            )}

            {games.length === 0 && (
                <box justifyContent="center" marginTop={1}>
                    <text dimColor>No games scheduled for today</text>
                </box>
            )}
        </box>
    );
}
