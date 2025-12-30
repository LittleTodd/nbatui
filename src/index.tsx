/**
 * NBA-TUI Main Application
 * Map-centric view with games positioned at city locations
 */
import React, { useState, useEffect, useMemo } from 'react';
import { render, Box, Text, useInput, useApp } from 'ink';
import Spinner from 'ink-spinner';
import { fetchTodayGames, checkHealth, type Game } from './services/apiClient.js';
import { getCleanMap, US_MAP_WIDTH } from './data/usMap.js';
import { getTeamPosition } from './data/teamCoords.js';

// Get geographic positions for all games
function getGamePositions(games: Game[]): Array<{ idx: number; x: number; y: number }> {
    return games.map((game, idx) => {
        const pos = getTeamPosition(game.homeTeam.teamTricode);
        return { idx, x: pos.x, y: pos.y };
    });
}

// Find nearest game in a given direction
// Direction: 'up' = smaller y, 'down' = larger y, 'left' = smaller x, 'right' = larger x
function findNearestGame(
    games: Game[],
    currentIndex: number,
    direction: 'up' | 'down' | 'left' | 'right'
): number {
    if (games.length <= 1) return currentIndex;

    const positions = getGamePositions(games);
    const current = positions.find(p => p.idx === currentIndex);
    if (!current) return currentIndex;

    let bestIdx = currentIndex;
    let bestScore = Infinity;

    for (const pos of positions) {
        if (pos.idx === currentIndex) continue;

        const dx = pos.x - current.x;
        const dy = pos.y - current.y;

        // Check if this game is in the correct direction
        let isValidDirection = false;
        let primaryDistance = 0;
        let secondaryDistance = 0;

        switch (direction) {
            case 'up':
                // y should be smaller (north)
                isValidDirection = dy < -2; // At least 2% difference
                primaryDistance = Math.abs(dy);
                secondaryDistance = Math.abs(dx);
                break;
            case 'down':
                // y should be larger (south)
                isValidDirection = dy > 2;
                primaryDistance = Math.abs(dy);
                secondaryDistance = Math.abs(dx);
                break;
            case 'left':
                // x should be smaller (west)
                isValidDirection = dx < -2;
                primaryDistance = Math.abs(dx);
                secondaryDistance = Math.abs(dy);
                break;
            case 'right':
                // x should be larger (east)
                isValidDirection = dx > 2;
                primaryDistance = Math.abs(dx);
                secondaryDistance = Math.abs(dy);
                break;
        }

        if (isValidDirection) {
            // Score: prefer closer in primary direction, use secondary as tiebreaker
            const score = primaryDistance + secondaryDistance * 0.3;
            if (score < bestScore) {
                bestScore = score;
                bestIdx = pos.idx;
            }
        }
    }

    // If no game found in that direction, wrap around to opposite side
    if (bestIdx === currentIndex) {
        // Find the game furthest in the opposite direction
        let furthestIdx = currentIndex;
        let furthestValue = -Infinity;

        for (const pos of positions) {
            if (pos.idx === currentIndex) continue;

            let value = 0;
            switch (direction) {
                case 'up': value = pos.y; break;      // Furthest south
                case 'down': value = -pos.y; break;   // Furthest north
                case 'left': value = pos.x; break;    // Furthest east
                case 'right': value = -pos.x; break;  // Furthest west
            }

            if (value > furthestValue) {
                furthestValue = value;
                furthestIdx = pos.idx;
            }
        }
        return furthestIdx;
    }

    return bestIdx;
}

// Convert percentage position to character position
function percentToChar(percent: number, maxChars: number): number {
    return Math.round((percent / 100) * (maxChars - 1));
}

// Create a marker for a game without number prefix
function createGameMarker(game: Game, isSelected: boolean, isHighlighted: boolean = false): string {
    const isLive = game.gameStatus === 2;

    const away = game.awayTeam.teamTricode;
    const home = game.homeTeam.teamTricode;
    const awayScore = game.awayTeam.score;
    const homeScore = game.homeTeam.score;

    if (isSelected) {
        return `[${away} ${awayScore}-${homeScore} ${home}]`;
    } else if (isHighlighted) {
        return `»${away}-${home}«`;
    } else if (isLive) {
        return `● ${away}-${home}`;
    } else {
        return `${away}-${home}`;
    }
}

// Helper to check if game matches filter (only checks Tricodes prefix)
function checkGameMatchesFilter(game: Game, filter: string): boolean {
    if (!filter) return false;
    const lowerFilter = filter.toLowerCase();
    return game.homeTeam.teamTricode.toLowerCase().startsWith(lowerFilter) ||
        game.awayTeam.teamTricode.toLowerCase().startsWith(lowerFilter);
}

// Embed game markers into map lines with collision detection
function embedGamesInMap(
    mapLines: string[],
    games: Game[],
    selectedIndex: number,
    termWidth: number,
    searchFilter: string = ''
): { lines: string[]; gameColors: Map<number, { row: number; col: number; isLive: boolean; isSelected: boolean; isHighlighted: boolean }> } {
    // Clone map lines
    const lines = mapLines.map(l => l.padEnd(termWidth, ' ').slice(0, termWidth));
    const gameColors = new Map<number, { row: number; col: number; isLive: boolean; isSelected: boolean; isHighlighted: boolean }>();

    const maxHeight = lines.length;
    const maxWidth = termWidth;

    // Calculate positions for all games
    const gamesWithPos = games.map((game, idx) => {
        const pos = getTeamPosition(game.homeTeam.teamTricode);
        const isSelected = idx === selectedIndex;
        const isHighlighted = checkGameMatchesFilter(game, searchFilter);
        const marker = createGameMarker(game, isSelected, isHighlighted);
        return {
            game,
            idx,
            row: percentToChar(pos.y, maxHeight),
            col: percentToChar(pos.x, maxWidth),
            markerLen: marker.length,
            isLive: game.gameStatus === 2,
            isSelected,
            isHighlighted,
        };
    });

    // Sort by column to place left-most games first
    gamesWithPos.sort((a, b) => a.col - b.col);

    // Track occupied ranges per row: Map<row, Array<{start, end}>>
    const occupiedRanges = new Map<number, Array<{ start: number; end: number }>>();

    // Place markers with collision detection
    for (const gamePos of gamesWithPos) {
        const { game, idx, markerLen, isLive, isSelected, isHighlighted } = gamePos;
        let { row, col } = gamePos;
        const marker = createGameMarker(game, isSelected, isHighlighted);

        // Ensure within bounds
        col = Math.max(0, Math.min(col, maxWidth - markerLen));
        row = Math.max(0, Math.min(row, maxHeight - 1));

        // Check for collision and find free row
        let attempts = 0;
        while (attempts < maxHeight) {
            const ranges = occupiedRanges.get(row) || [];
            const hasCollision = ranges.some(r =>
                (col < r.end && col + markerLen > r.start)
            );

            if (!hasCollision) break;

            // Try next row down, then wrap
            row = (row + 1) % maxHeight;
            attempts++;
        }

        // Mark this range as occupied
        const ranges = occupiedRanges.get(row) || [];
        ranges.push({ start: col, end: col + markerLen });
        occupiedRanges.set(row, ranges);

        // Insert marker into line
        const line = lines[row];
        if (line) {
            const before = line.slice(0, col);
            const after = line.slice(col + markerLen);
            lines[row] = before + marker + after;

            // Track position for coloring
            gameColors.set(idx, { row, col, isLive, isSelected, isHighlighted });
        }
    }

    return { lines, gameColors };
}

// Map Line component with colored markers
function MapLine({ line, rowIndex, gameColors, games }: {
    line: string;
    rowIndex: number;
    gameColors: Map<number, { row: number; col: number; isLive: boolean; isSelected: boolean; isHighlighted: boolean }>;
    games: Game[];
}) {
    // Find if any game marker is on this row
    const markersOnRow: Array<{ col: number; length: number; isLive: boolean; isSelected: boolean; isHighlighted: boolean; gameIdx: number }> = [];

    gameColors.forEach((pos, gameIdx) => {
        if (pos.row === rowIndex) {
            const marker = createGameMarker(games[gameIdx], pos.isSelected, pos.isHighlighted);
            markersOnRow.push({
                col: pos.col,
                length: marker.length,
                isLive: pos.isLive,
                isSelected: pos.isSelected,
                isHighlighted: pos.isHighlighted,
                gameIdx
            });
        }
    });

    // If no markers, just render dim line
    if (markersOnRow.length === 0) {
        return <Text dimColor>{line}</Text>;
    }

    // Sort markers by column
    markersOnRow.sort((a, b) => a.col - b.col);

    // Build segments
    const segments: React.ReactNode[] = [];
    let lastEnd = 0;

    markersOnRow.forEach((marker, i) => {
        // Add dim text before marker
        if (marker.col > lastEnd) {
            segments.push(
                <Text key={`dim-${i}`} dimColor>
                    {line.slice(lastEnd, marker.col)}
                </Text>
            );
        }

        // Add colored marker
        const markerText = line.slice(marker.col, marker.col + marker.length);
        let color = marker.isLive ? 'green' : 'yellow';
        if (marker.isSelected) color = 'cyan';

        // Highlight logic
        const isHighlighted = marker.isHighlighted;

        segments.push(
            <Text
                key={`marker-${i}`}
                color={isHighlighted ? 'black' : color}
                backgroundColor={isHighlighted ? 'yellow' : undefined}
                bold={marker.isSelected || isHighlighted}
            >
                {markerText}
            </Text>
        );

        lastEnd = marker.col + marker.length;
    });

    // Add remaining dim text
    if (lastEnd < line.length) {
        segments.push(
            <Text key="dim-end" dimColor>
                {line.slice(lastEnd)}
            </Text>
        );
    }

    return <Text>{segments}</Text>;
}

// Selected game detail panel
function GameDetail({ game }: { game: Game }) {
    const isLive = game.gameStatus === 2;

    return (
        <Box
            borderStyle="round"
            borderColor="cyan"
            paddingX={2}
            marginTop={1}
            justifyContent="center"
        >
            <Box flexDirection="column" alignItems="center">
                <Text bold color="cyan">
                    {game.awayTeam.teamCity} {game.awayTeam.teamName} @ {game.homeTeam.teamCity} {game.homeTeam.teamName}
                </Text>
                <Box gap={2}>
                    <Text bold>{game.awayTeam.teamTricode}</Text>
                    <Text bold color="white" backgroundColor={isLive ? "green" : undefined}>
                        {game.awayTeam.score} - {game.homeTeam.score}
                    </Text>
                    <Text bold>{game.homeTeam.teamTricode}</Text>
                </Box>
                <Text color={isLive ? "green" : "gray"}>
                    {isLive && "● LIVE "}{game.gameStatusText}
                </Text>
            </Box>
        </Box>
    );
}

// Main App
function App() {
    const { exit } = useApp();
    const [games, setGames] = useState<Game[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [connected, setConnected] = useState(false);
    const [loading, setLoading] = useState(true);
    const [searchFilter, setSearchFilter] = useState('');
    const [isSearching, setIsSearching] = useState(false);

    const termWidth = process.stdout.columns || 100;
    const termHeight = process.stdout.rows || 40;

    // Load games
    const loadGames = async () => {
        setLoading(true);
        const isConnected = await checkHealth();
        setConnected(isConnected);
        if (isConnected) {
            const data = await fetchTodayGames();
            setGames(data);
        }
        setLoading(false);
    };

    useEffect(() => {
        loadGames();
        const interval = setInterval(loadGames, 30000);
        return () => clearInterval(interval);
    }, []);

    useInput((input, key) => {
        // Global keys
        if (key.escape) {
            setIsSearching(false);
            setSearchFilter('');
            return;
        }

        // Search Mode
        if (isSearching) {
            if (key.return) {
                // Select first highlighted game if any
                // (This logic is simple, ideally we find the first match)
                setIsSearching(false);
                // logic to jump to first match could be adding here:
                const matchIdx = games.findIndex(g => checkGameMatchesFilter(g, searchFilter));
                if (matchIdx !== -1) setSelectedIndex(matchIdx);
                setSearchFilter('');
                return;
            }
            if (key.backspace || key.delete) {
                setSearchFilter(prev => prev.slice(0, -1));
                if (searchFilter.length <= 1 && (key.backspace || key.delete)) {
                    // Optionally exit search if empty? No, keep focus.
                }
                return;
            }
            // Add char to filter
            if (!key.ctrl && !key.meta && input.length === 1) {
                setSearchFilter(prev => prev + input);
            }
            return;
        }

        // Normal Mode
        if (input === 'q') {
            process.exit(0);
        }
        if (input === 'r') loadGames();

        // Search toggle
        if (input === '/') {
            setIsSearching(true);
            return;
        }

        // Tab to cycle through all games (simple sequential)
        if (key.tab) {
            if (key.shift) {
                setSelectedIndex(prev => (prev - 1 + games.length) % Math.max(1, games.length));
            } else {
                setSelectedIndex(prev => (prev + 1) % Math.max(1, games.length));
            }
        }

        // Spatial navigation based on geographic position
        if (key.rightArrow || input === 'l') {
            setSelectedIndex(findNearestGame(games, selectedIndex, 'right'));
        }
        if (key.leftArrow || input === 'h') {
            setSelectedIndex(findNearestGame(games, selectedIndex, 'left'));
        }
        if (key.upArrow || input === 'k') {
            setSelectedIndex(findNearestGame(games, selectedIndex, 'up'));
        }
        if (key.downArrow || input === 'j') {
            setSelectedIndex(findNearestGame(games, selectedIndex, 'down'));
        }
    });

    // Disconnected state
    if (!connected && !loading) {
        return (
            <Box flexDirection="column" padding={2}>
                <Text color="red">✗ Cannot connect to data service</Text>
                <Text dimColor>Run: ./scripts/start-data-service.sh</Text>
                <Text dimColor>Press 'r' to retry, 'q' to quit</Text>
            </Box>
        );
    }

    // Loading state
    if (loading && games.length === 0) {
        return (
            <Box flexDirection="column" padding={2} alignItems="center">
                <Text color="cyan"><Spinner type="dots" /> Loading NBA games...</Text>
            </Box>
        );
    }

    // Calculate map height (leave room for header, detail panel, status bar)
    const mapHeight = Math.min(termHeight - 12, 25);
    const mapLines = getCleanMap().slice(0, mapHeight);

    // Embed games into map
    const { lines: mapWithGames, gameColors } = embedGamesInMap(
        mapLines, games, selectedIndex, Math.min(termWidth - 2, US_MAP_WIDTH), searchFilter
    );

    return (
        <Box flexDirection="column" height={termHeight}>
            {/* Header */}
            <Box justifyContent="center">
                <Text bold color="cyan">🏀 NBA BATTLE MAP 🏀</Text>
            </Box>

            {/* Map with embedded games */}
            <Box flexDirection="column" alignItems="center" flexGrow={1}>
                {mapWithGames.map((line, rowIdx) => (
                    <MapLine
                        key={rowIdx}
                        line={line}
                        rowIndex={rowIdx}
                        gameColors={gameColors}
                        games={games}
                    />
                ))}
            </Box>

            {/* Search Bar / Selected Detail */}
            {isSearching ? (
                <Box
                    borderStyle="round"
                    borderColor="yellow"
                    paddingX={2}
                    marginTop={1}
                    alignSelf="center"
                    width={40}
                    flexDirection="row"
                >
                    <Text>Search: </Text>
                    <Text color="white">{searchFilter}</Text>
                    <Text color="yellow">█</Text>
                </Box>
            ) : (
                games.length > 0 && games[selectedIndex] && (
                    <GameDetail game={games[selectedIndex]} />
                )
            )}

            {/* Status bar */}
            <Box justifyContent="space-between" paddingX={1}>
                <Box>
                    <Text color={connected ? 'green' : 'red'}>
                        {connected ? '● Connected' : '● Disconnected'}
                    </Text>
                    {loading && <Text color="yellow"> <Spinner type="dots" /></Text>}
                </Box>
                <Text dimColor>{games.length} games • /: search | Tab: cycle | ←→↑↓: spatial</Text>
                <Text dimColor>r: refresh | q: quit</Text>
            </Box>
        </Box>
    );
}

render(<App />);
