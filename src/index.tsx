/**
 * NBA-TUI Main Application
 * Map-centric view with games positioned at city locations
 */
import React, { useState, useEffect } from 'react';
import { render, Box, Text, useInput, useApp } from 'ink';
import Spinner from 'ink-spinner';
import { format, addDays, subDays, isSameDay } from 'date-fns';
import { fetchTodayGames, fetchGamesByDate, checkHealth, fetchPolymarketOdds, getOddsKey, getGameStatusInfo, type Game, type GameOdds } from './services/apiClient.js';
import { getCleanMap, US_MAP_WIDTH } from './data/usMap.js';
import { getTeamPosition } from './data/teamCoords.js';
import { GameDetailPage } from './pages/GameDetailPage.js';
import { StandingsSidebar } from './components/StandingsSidebar.js';

// Get geographic positions for all games
function getGamePositions(games: Game[]): Array<{ idx: number; x: number; y: number }> {
    return games.map((game, idx) => {
        const pos = getTeamPosition(game.homeTeam.teamTricode);
        return { idx, x: pos.x, y: pos.y };
    });
}

// Find nearest game in a given direction
function findNearestGame(
    games: Game[],
    currentIndex: number,
    direction: 'up' | 'down' | 'left' | 'right'
): number {
    if (games.length <= 1) return currentIndex;

    const positions = getGamePositions(games);
    const current = positions.find(p => p.idx === currentIndex);
    // If current selected game is not in list (e.g. filtered out or weird state), default to 0
    if (!current) return 0;

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
                isValidDirection = dy < -2;
                primaryDistance = Math.abs(dy);
                secondaryDistance = Math.abs(dx);
                break;
            case 'down':
                isValidDirection = dy > 2;
                primaryDistance = Math.abs(dy);
                secondaryDistance = Math.abs(dx);
                break;
            case 'left':
                isValidDirection = dx < -2;
                primaryDistance = Math.abs(dx);
                secondaryDistance = Math.abs(dy);
                break;
            case 'right':
                isValidDirection = dx > 2;
                primaryDistance = Math.abs(dx);
                secondaryDistance = Math.abs(dy);
                break;
        }

        if (isValidDirection) {
            const score = primaryDistance + secondaryDistance * 0.3;
            if (score < bestScore) {
                bestScore = score;
                bestIdx = pos.idx;
            }
        }
    }

    // Wrap around logic if no game found in direction
    if (bestIdx === currentIndex) {
        let furthestIdx = currentIndex;
        let furthestValue = -Infinity;

        for (const pos of positions) {
            if (pos.idx === currentIndex) continue;
            let value = 0;
            switch (direction) {
                case 'up': value = pos.y; break;
                case 'down': value = -pos.y; break;
                case 'left': value = pos.x; break;
                case 'right': value = -pos.x; break;
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
function createGameMarker(game: Game, isSelected: boolean, isHighlighted: boolean = false, odds?: GameOdds): string {
    const isLive = game.gameStatus === 2;
    const isFinal = game.gameStatus === 3;
    const isFuture = game.gameStatus === 1;

    const away = game.awayTeam.teamTricode;
    const home = game.homeTeam.teamTricode;
    const awayScore = game.awayTeam.score;
    const homeScore = game.homeTeam.score;

    let content = '';

    if (isFuture) {
        // Future: Display team names, odds shown via DetailPanel instead
        // Keep map marker clean - just team codes
        content = `${away}-${home}`;
    } else {
        // Live or Final: "AWY 100-90 HME" or "100-90"
        // Space is tight on map.
        // Format: "AWY SSS-SSS HME" might be too long.
        // Let's stick to "AWY-HME" if we can't fit scores?
        // User asked: "For past games, please showing both score."
        // Let's try compact: "AWY(100)-HME(90)" or "100-90"
        // Actually, existing logic was just "AWY-HME".
        // Let's force score display if space permits or just minimal.

        // If selected, we show full detail in the Detail box anyway.
        // For the marker, let's try to fit score? 
        // Marker length affects collision. 
        // Let's try: "AWY 100-90 HME" is very long (15 chars).
        // Maybe just "100-90" if finalized? But then we lose team names.
        // User request: "If it's past game, please showing both score."
        // Maybe he means in the DETAIL view? Or on the map?
        // "Right click on map display next day... left click display previous day and result."
        // Implies on the map.

        // Let's try compact score: "LAL 102-99 BOS"
        content = `${away} ${awayScore}-${homeScore} ${home}`;
    }

    // Add live indicator prefix if game is live (blinking handled by MapLine render)
    const livePrefix = isLive ? '●● ' : '';

    if (isSelected) {
        return `${livePrefix}[${content}]`;
    } else if (isHighlighted) {
        return `${livePrefix}»${content}«`;
    } else if (isLive) {
        return `●● ${content}`;
    } else {
        return content;
    }
}

// Helper to check if game matches filter
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
    const lines = mapLines.map(l => l.padEnd(termWidth, ' ').slice(0, termWidth));
    const gameColors = new Map<number, { row: number; col: number; isLive: boolean; isSelected: boolean; isHighlighted: boolean }>();

    const maxHeight = lines.length;
    const maxWidth = termWidth;

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

    gamesWithPos.sort((a, b) => a.col - b.col);

    const occupiedRanges = new Map<number, Array<{ start: number; end: number }>>();

    for (const gamePos of gamesWithPos) {
        const { idx, markerLen, isLive, isSelected, isHighlighted } = gamePos;
        let { row, col } = gamePos;
        const marker = createGameMarker(gamePos.game, isSelected, isHighlighted);

        col = Math.max(0, Math.min(col, maxWidth - markerLen));
        row = Math.max(0, Math.min(row, maxHeight - 1));

        const MIN_GAP = 3; // Minimum characters between games on the same line

        let attempts = 0;
        while (attempts < maxHeight) {
            const ranges = occupiedRanges.get(row) || [];
            const hasCollision = ranges.some(r =>
                // Check intersection with padding
                (col < r.end + MIN_GAP && col + markerLen > r.start - MIN_GAP)
            );

            if (!hasCollision) break;
            row = (row + 1) % maxHeight;
            attempts++;
        }

        const ranges = occupiedRanges.get(row) || [];
        ranges.push({ start: col, end: col + markerLen });
        occupiedRanges.set(row, ranges);

        const line = lines[row];
        if (line) {
            const before = line.slice(0, col);
            const after = line.slice(col + markerLen);
            lines[row] = before + marker + after;
            gameColors.set(idx, { row, col, isLive, isSelected, isHighlighted });
        }
    }

    return { lines, gameColors };
}

// Map Line component with colored markers
import { TEAM_BG_COLORS } from './data/teamColors.js';

function MapLine({ line, rowIndex, gameColors, games, odds, liveDotVisible }: {
    line: string;
    rowIndex: number;
    gameColors: Map<number, { row: number; col: number; isLive: boolean; isSelected: boolean; isHighlighted: boolean }>;
    games: Game[];
    odds: Record<string, GameOdds>;
    liveDotVisible: boolean;
}) {
    // Find if any game marker is on this row
    const markersOnRow: Array<{ col: number; length: number; isLive: boolean; isSelected: boolean; isHighlighted: boolean; gameIdx: number; content: string }> = [];

    gameColors.forEach((pos, gameIdx) => {
        if (pos.row === rowIndex) {
            const game = games[gameIdx];
            if (!game) return;
            // Lookup odds for this game - try multiple date keys due to timezone differences
            // Polymarket uses endDate (often +1 day from gameTimeUTC)
            const gameDate = game.gameTimeUTC?.slice(0, 10) || '';
            let gameOdds = odds[getOddsKey(game.awayTeam.teamTricode, game.homeTeam.teamTricode, gameDate)];

            // If not found, try +1 day (Polymarket often uses next day as endDate)
            if (!gameOdds && gameDate) {
                const nextDay = new Date(gameDate);
                nextDay.setDate(nextDay.getDate() + 1);
                const nextDayStr = nextDay.toISOString().slice(0, 10);
                gameOdds = odds[getOddsKey(game.awayTeam.teamTricode, game.homeTeam.teamTricode, nextDayStr)];
            }

            const marker = createGameMarker(game, pos.isSelected, pos.isHighlighted, gameOdds);
            markersOnRow.push({
                col: pos.col,
                length: marker.length,
                isLive: pos.isLive,
                isSelected: pos.isSelected,
                isHighlighted: pos.isHighlighted,
                gameIdx,
                content: marker
            });
        }
    });

    if (markersOnRow.length === 0) {
        return <Text dimColor>{line}</Text>;
    }

    markersOnRow.sort((a, b) => a.col - b.col);

    const segments: React.ReactNode[] = [];
    let lastEnd = 0;

    markersOnRow.forEach((marker, i) => {
        if (marker.col > lastEnd) {
            segments.push(
                <Text key={`dim-${i}`} dimColor>
                    {line.slice(lastEnd, marker.col)}
                </Text>
            );
        }

        const rawContent = marker.content;
        const game = games[marker.gameIdx];
        const away = game.awayTeam.teamTricode;
        const home = game.homeTeam.teamTricode;

        const awayColor = TEAM_BG_COLORS[away] || '#333';
        const homeColor = TEAM_BG_COLORS[home] || '#333';

        const markerElements: React.ReactNode[] = [];

        const renderText = (text: string, key: string, bg?: string) => {
            if (!text) return null;

            const isFinal = game.gameStatus === 3;
            const isFuture = game.gameStatus === 1;

            // Determine base color based on game state
            // 🟢 Live: green
            // ⚪ Scheduled: gray (dim)
            // 🔵 Finished: blue
            let finalColor = marker.isLive ? 'green' : (isFinal ? 'blue' : 'gray');
            let finalBg = undefined;
            let finalBold = marker.isSelected;
            let finalDim = isFuture && !marker.isHighlighted && !marker.isSelected;

            if (marker.isHighlighted) {
                finalBg = 'yellow';
                finalColor = 'black';
                finalBold = true;
                finalDim = false;
            } else if (bg) {
                finalBg = bg;
                finalColor = '#ffffff'; // Explicit hex white for badges
                finalBold = true;       // Explicit bold for badges
                finalDim = false;
            } else if (marker.isSelected) {
                finalColor = 'cyan';
                finalBold = true;
                finalDim = false;
            }

            return (
                <Text
                    key={key}
                    color={finalColor}
                    backgroundColor={finalBg}
                    bold={finalBold}
                >
                    {text}
                </Text>
            );
        };

        // Replace blinking dot placeholder for live games
        let displayContent = rawContent;
        if (marker.isLive && rawContent.startsWith('●●')) {
            const dot = liveDotVisible ? '●' : '○';
            displayContent = dot + rawContent.slice(2); // Replace ●● with single blinking dot
        }

        const parts1 = displayContent.split(away);

        if (parts1.length >= 2) {
            const preAway = parts1[0];
            const postAway = parts1.slice(1).join(away);

            markerElements.push(renderText(preAway, `pre-${i}`));
            markerElements.push(renderText(` ${away} `, `away-${i}`, awayColor));

            const parts2 = postAway.split(home);
            if (parts2.length >= 2) {
                const mid = parts2[0];
                const postHome = parts2.slice(1).join(home);

                markerElements.push(renderText(mid, `mid-${i}`));
                markerElements.push(renderText(` ${home} `, `home-${i}`, homeColor));
                markerElements.push(renderText(postHome, `post-${i}`));
            } else {
                markerElements.push(renderText(postAway, `rest-${i}`));
            }
        } else {
            markerElements.push(renderText(displayContent, `full-${i}`));
        }

        segments.push(
            <Text key={`marker-wrap-${i}`}>
                {markerElements}
            </Text>
        );

        lastEnd = marker.col + marker.length;
    });

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
function GameDetail({ game, odds, currentIndex, totalGames }: { game: Game; odds?: GameOdds; currentIndex: number; totalGames: number }) {
    const { text: statusText, isLive, isFinal } = getGameStatusInfo(game);
    const isFuture = game.gameStatus === 1;

    // Blinking animation for live indicator
    const [dotVisible, setDotVisible] = useState(true);
    useEffect(() => {
        if (!isLive) return;
        const timer = setInterval(() => {
            setDotVisible(v => !v);
        }, 500);
        return () => clearInterval(timer);
    }, [isLive]);

    return (
        <Box
            borderStyle="round"
            borderColor="cyan"
            paddingX={2}
            marginTop={1}
            justifyContent="center"
        >
            <Box flexDirection="column" alignItems="center">
                {/* Pagination Indicator */}
                <Box marginBottom={1}>
                    <Text dimColor>◀ </Text>
                    <Text bold color="yellow">{currentIndex + 1}</Text>
                    <Text dimColor>/{totalGames}</Text>
                    <Text dimColor> ▶</Text>
                </Box>

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
                {/* Show odds for future games */}
                {isFuture && odds && odds.awayOdds > 0 && (
                    <Box gap={1}>
                        <Text color="yellow">📊 Odds:</Text>
                        <Text color="white">{game.awayTeam.teamTricode}</Text>
                        <Text color="green" bold>{odds.awayOdds.toFixed(2)}</Text>
                        <Text color="gray">|</Text>
                        <Text color="green" bold>{odds.homeOdds.toFixed(2)}</Text>
                        <Text color="white">{game.homeTeam.teamTricode}</Text>
                    </Box>
                )}
                <Text color={isLive ? "green" : "gray"}>
                    {isLive && (dotVisible ? "● " : "○ ")}{isLive && "LIVE "}{statusText}
                </Text>
            </Box>
        </Box>
    );
}

// Main App
function App() {
    const { exit } = useApp();
    const [games, setGames] = useState<Game[]>([]);
    const [currentDate, setCurrentDate] = useState<Date>(new Date());
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [connected, setConnected] = useState(false);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<'map' | 'detail'>('map');
    const [searchFilter, setSearchFilter] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [showStandings, setShowStandings] = useState(false);
    const [odds, setOdds] = useState<Record<string, GameOdds>>({});

    // Global blinking state for live game indicator
    const [liveDotVisible, setLiveDotVisible] = useState(true);
    useEffect(() => {
        const hasLiveGames = games.some(g => g.gameStatus === 2);
        if (!hasLiveGames) return;
        const timer = setInterval(() => {
            setLiveDotVisible(v => !v);
        }, 500);
        return () => clearInterval(timer);
    }, [games]);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

    const loadGamesForDate = async (date: Date, isBackgroundRefresh = false) => {
        // Only show loading indicator on initial load or date change, not on background refresh
        if (!isBackgroundRefresh) {
            setLoading(true);
        }

        // Timezone Adjustment Logic:
        // NBA games roughly happen 7pm - 1am ET (US).
        // - In US (UTC-5 to UTC-8): This is the 'Same Day'.
        // - In Europe/Asia (UTC+0 to UTC+8): This is 'Next Day' morning.
        // So for users East of Atlantic (Offset <= 0), 'Today' in local time corresponds to 'Yesterday' in NBA Schedule.
        // JS getTimezoneOffset() returns +ve for West of UTC (US=300), -ve for East (China=-480).

        const offset = new Date().getTimezoneOffset();
        let queryDate = date;
        const isViewingToday = isSameDay(date, new Date());

        if (offset <= 0) {
            // East of UTC (Europe, Asia) -> Shift back 1 day to get the "Morning" games
            queryDate = subDays(date, 1);
        }

        const dateStr = format(queryDate, 'yyyy-MM-dd');

        // For real-time data: use fetchTodayGames when viewing today (has live scores)
        // For historical data: use fetchGamesByDate
        const gamesPromise = isViewingToday
            ? fetchTodayGames()  // Real-time live scores
            : fetchGamesByDate(dateStr);  // Historical/scheduled data

        const [gamesData, oddsData] = await Promise.all([
            gamesPromise,
            fetchPolymarketOdds()
        ]);

        setGames(gamesData);
        setOdds(oddsData);
        if (!isBackgroundRefresh) {
            setLoading(false);
        }
        setLastUpdated(new Date());

        // Only reset selection on initial load, not on refresh
        if (!isBackgroundRefresh && gamesData.length > 0) setSelectedIndex(0);
    };

    const checkConnection = async () => {
        const isHealthy = await checkHealth();
        setConnected(isHealthy);
    };

    // Initial load & Date change
    useEffect(() => {
        loadGamesForDate(currentDate);
        checkConnection();
    }, [currentDate]);

    // Auto-refresh (when there are live games or viewing today)
    useEffect(() => {
        const timer = setInterval(() => {
            // Refresh if viewing today OR if there are any live games in current view
            const hasLiveGames = games.some(g => g.gameStatus === 2);
            if (isSameDay(currentDate, new Date()) || hasLiveGames) {
                loadGamesForDate(currentDate, true);  // Background refresh - no loading indicator
                checkConnection();
            }
        }, 30000);
        return () => clearInterval(timer);
    }, [currentDate, games]);

    useInput((input, key) => {
        if (view === 'detail') return;

        if (key.escape || input === 'q') {
            exit();
            return;
        }

        if (isSearching) {
            if (key.return) {
                setIsSearching(false);
                // Update selection to the first matching game
                if (searchFilter) {
                    const filter = searchFilter.toLowerCase();
                    const foundIdx = games.findIndex(g =>
                        g.homeTeam.teamTricode.toLowerCase().includes(filter) ||
                        g.homeTeam.teamCity.toLowerCase().includes(filter) ||
                        g.homeTeam.teamName.toLowerCase().includes(filter) ||
                        g.awayTeam.teamTricode.toLowerCase().includes(filter) ||
                        g.awayTeam.teamCity.toLowerCase().includes(filter) ||
                        g.awayTeam.teamName.toLowerCase().includes(filter)
                    );
                    if (foundIdx !== -1) {
                        setSelectedIndex(foundIdx);
                        // Also open detail immediately to satisfy "Enter is view detail"? 
                        // User said: "press enter should view detail... but it views current..."
                        // This implies they pressed Enter hoping to view.
                        // Let's make it auto-view for better UX if they typed something specific.
                        if (games.length > 0) setView('detail');
                    }
                }
            } else if (key.backspace || key.delete) {
                setSearchFilter(prev => prev.slice(0, -1));
            } else if (input.length === 1 && !key.ctrl && !key.meta) {
                setSearchFilter(prev => prev + input);
            }
            return;
        }

        if (input === '/') {
            setIsSearching(true);
            return;
        }

        if (input === 'r') {
            // Manual refresh - use background mode to prevent flicker
            loadGamesForDate(currentDate, true);
            return;
        }

        if (input === 's') {
            setShowStandings(prev => !prev);
            return;
        }

        if (key.return) {
            if (games.length > 0) {
                setView('detail');
            }
            return;
        }

        if (key.upArrow) {
            setSelectedIndex(prev => (prev > 0 ? prev - 1 : games.length - 1));
        }

        if (key.downArrow) {
            setSelectedIndex(prev => (prev < games.length - 1 ? prev + 1 : 0));
        }

        if (key.leftArrow) {
            setCurrentDate(prev => subDays(prev, 1));
        }

        if (key.rightArrow) {
            setCurrentDate(prev => addDays(prev, 1));
        }
    });

    const termWidth = process.stdout.columns || 100;
    const termHeight = process.stdout.rows || 40;

    // Resolution check
    const minMapWidth = 100;
    const minFullWidth = 165;
    const minHeight = 40;

    const isMapCramped = termWidth < minMapWidth || termHeight < minHeight;
    const isSidebarCramped = showStandings && termWidth < minFullWidth;

    let warningHeight = 0;
    if (isMapCramped || isSidebarCramped) {
        warningHeight += 2; // borders
        warningHeight += 1; // title
        if (isMapCramped) warningHeight += 1;
        if (isSidebarCramped) warningHeight += 1;
        warningHeight += 1; // margin bottom
    }

    if (view === 'detail' && games[selectedIndex]) {
        return <GameDetailPage game={games[selectedIndex]} onBack={() => setView('map')} />;
    }

    const availableHeight = termHeight - 12 - warningHeight;
    const mapHeight = Math.max(0, Math.min(availableHeight, 25));
    const mapLines = getCleanMap().slice(0, mapHeight);

    const { lines: mapWithGames, gameColors } = embedGamesInMap(
        mapLines, games, selectedIndex, Math.min(termWidth - 2, US_MAP_WIDTH), searchFilter
    );

    const dateDisplay = isSameDay(currentDate, new Date()) ? 'TODAY' : format(currentDate, 'yyyy-MM-dd');

    return (
        <Box flexDirection="column" height={termHeight}>
            {/* Resolution Warning */}
            {(isMapCramped || isSidebarCramped) && (
                <Box borderStyle="double" borderColor="red" flexDirection="column" alignItems="center" marginBottom={1}>
                    <Text color="red" bold>⚠️  Resolution Warning</Text>
                    {isMapCramped && <Text>Map requires {minMapWidth}x{minHeight} (Current: {termWidth}x{termHeight})</Text>}
                    {isSidebarCramped && <Text>Sidebar requires width {minFullWidth} (Current: {termWidth})</Text>}
                </Box>
            )}

            {/* Header */}
            <Box justifyContent="center" flexDirection="column" alignItems="center">
                <Text bold color="cyan">🏀 NBA BATTLE MAP 🏀</Text>
                <Text bold color="yellow">📅 {dateDisplay} 📅</Text>
            </Box>

            {/* Main Content Area */}
            <Box flexDirection="row" flexGrow={1} justifyContent="center" marginTop={1}>
                {/* Map */}
                <Box flexDirection="column" alignItems="center">
                    {games.length === 0 && !loading ? (
                        /* Empty State */
                        <Box
                            flexDirection="column"
                            alignItems="center"
                            justifyContent="center"
                            height={mapHeight}
                            borderStyle="round"
                            borderColor="gray"
                            paddingX={4}
                            paddingY={2}
                        >
                            <Text bold color="yellow">🏀 No Games Scheduled 🏀</Text>
                            <Box marginTop={1}>
                                <Text dimColor>No NBA games found for this date.</Text>
                            </Box>
                            <Box marginTop={1}>
                                <Text dimColor>Use </Text>
                                <Text color="cyan" bold>← →</Text>
                                <Text dimColor> to browse other dates</Text>
                            </Box>
                        </Box>
                    ) : (
                        /* Map with games */
                        mapWithGames.map((line, rowIdx) => (
                            <MapLine
                                key={rowIdx}
                                line={line}
                                rowIndex={rowIdx}
                                gameColors={gameColors}
                                games={games}
                                odds={odds}
                                liveDotVisible={liveDotVisible}
                            />
                        ))
                    )}

                    {/* Search / Selection Overlay */}
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
                        games.length > 0 && games[selectedIndex] && (() => {
                            const game = games[selectedIndex];
                            const gameDate = game.gameTimeUTC?.slice(0, 10) || '';
                            let gameOdds = odds[getOddsKey(game.awayTeam.teamTricode, game.homeTeam.teamTricode, gameDate)];
                            if (!gameOdds && gameDate) {
                                const nextDay = new Date(gameDate);
                                nextDay.setDate(nextDay.getDate() + 1);
                                const nextDayStr = nextDay.toISOString().slice(0, 10);
                                gameOdds = odds[getOddsKey(game.awayTeam.teamTricode, game.homeTeam.teamTricode, nextDayStr)];
                            }
                            return <GameDetail game={game} odds={gameOdds} currentIndex={selectedIndex} totalGames={games.length} />;
                        })()
                    )}
                </Box>

                {/* Sidebar */}
                <StandingsSidebar visible={showStandings} />
            </Box>

            {/* Status Bar */}
            <Box justifyContent="space-between" paddingX={1} marginTop={1}>
                <Box>
                    <Text color={connected ? 'green' : 'red'}>
                        {connected ? '● Connected' : '● Disconnected'}
                    </Text>
                    {loading && <Text color="yellow"> <Spinner type="dots" /></Text>}
                </Box>
                <Text dimColor>{games.length} games • ←/→: date | ↑/↓: select | s: standings | Enter: detail</Text>
                <Text dimColor>r: refresh | q: quit</Text>
            </Box>
        </Box>
    );
}

render(<App />);
