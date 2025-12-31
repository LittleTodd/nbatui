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
import { useSocialHeat, type HeatData } from './hooks/useSocialHeat.js';
import { HeatIndicator } from './components/HeatIndicator.js';

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
function createGameMarker(game: Game, isSelected: boolean, isHighlighted: boolean = false, odds?: GameOdds, heat?: HeatData): string {
    const isLive = game.gameStatus === 2;
    const isFuture = game.gameStatus === 1;

    const away = game.awayTeam.teamTricode;
    const home = game.homeTeam.teamTricode;
    const awayScore = game.awayTeam.score;
    const homeScore = game.homeTeam.score;

    let content = '';

    if (isFuture) {
        content = `${away}-${home}`;
    } else {
        content = `${away} ${awayScore}-${homeScore} ${home}`;
    }

    // Add live indicator prefix if game is live
    const livePrefix = isLive ? '●● ' : '';

    // Add Heat Icon to marker if very hot
    const heatSuffix = (heat?.level === 'fire' || heat?.level === 'hot') ? ' 🔥' : '';

    if (isSelected) {
        return `${livePrefix}[${content}${heatSuffix}]`;
    } else if (isHighlighted) {
        return `${livePrefix}»${content}${heatSuffix}«`;
    } else if (isLive) {
        return `●● ${content}${heatSuffix}`;
    } else {
        return `${content}${heatSuffix}`;
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
    searchFilter: string = '',
    heatMap: Record<string, HeatData> = {}
): { lines: string[]; gameColors: Map<number, { row: number; col: number; isLive: boolean; isSelected: boolean; isHighlighted: boolean; heat?: HeatData }> } {
    const lines = mapLines.map(l => l.padEnd(termWidth, ' ').slice(0, termWidth));
    const gameColors = new Map<number, { row: number; col: number; isLive: boolean; isSelected: boolean; isHighlighted: boolean; heat?: HeatData }>();

    const maxHeight = lines.length;
    const maxWidth = termWidth;

    const gamesWithPos = games.map((game, idx) => {
        const pos = getTeamPosition(game.homeTeam.teamTricode);
        const isSelected = idx === selectedIndex;
        const isHighlighted = checkGameMatchesFilter(game, searchFilter);
        const heat = heatMap[game.gameId];
        const marker = createGameMarker(game, isSelected, isHighlighted, undefined, heat);
        return {
            game,
            idx,
            row: percentToChar(pos.y, maxHeight),
            col: percentToChar(pos.x, maxWidth),
            markerLen: marker.length,
            isLive: game.gameStatus === 2,
            isSelected,
            isHighlighted,
            heat
        };
    });

    gamesWithPos.sort((a, b) => a.col - b.col);

    const occupiedRanges = new Map<number, Array<{ start: number; end: number }>>();

    for (const gamePos of gamesWithPos) {
        const { idx, markerLen, isLive, isSelected, isHighlighted, heat } = gamePos;
        let { row, col } = gamePos;
        const marker = createGameMarker(gamePos.game, isSelected, isHighlighted, undefined, heat);

        col = Math.max(0, Math.min(col, maxWidth - markerLen));
        row = Math.max(0, Math.min(row, maxHeight - 1));

        const MIN_GAP = 3;

        let attempts = 0;
        while (attempts < maxHeight) {
            const ranges = occupiedRanges.get(row) || [];
            const hasCollision = ranges.some(r =>
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
            gameColors.set(idx, { row, col, isLive, isSelected, isHighlighted, heat });
        }
    }

    return { lines, gameColors };
}

// Map Line component with colored markers
import { TEAM_BG_COLORS } from './data/teamColors.js';

function MapLine({ line, rowIndex, gameColors, games, odds, liveDotVisible }: {
    line: string;
    rowIndex: number;
    gameColors: Map<number, { row: number; col: number; isLive: boolean; isSelected: boolean; isHighlighted: boolean; heat?: HeatData }>;
    games: Game[];
    odds: Record<string, GameOdds>;
    liveDotVisible: boolean;
}) {
    const markersOnRow: Array<{ col: number; length: number; isLive: boolean; isSelected: boolean; isHighlighted: boolean; gameIdx: number; content: string; heat?: HeatData }> = [];

    gameColors.forEach((pos, gameIdx) => {
        if (pos.row === rowIndex) {
            const game = games[gameIdx];
            if (!game) return;
            const gameDate = game.gameTimeUTC?.slice(0, 10) || '';
            let gameOdds = odds[getOddsKey(game.awayTeam.teamTricode, game.homeTeam.teamTricode, gameDate)];

            if (!gameOdds && gameDate) {
                const nextDay = new Date(gameDate);
                nextDay.setDate(nextDay.getDate() + 1);
                const nextDayStr = nextDay.toISOString().slice(0, 10);
                gameOdds = odds[getOddsKey(game.awayTeam.teamTricode, game.homeTeam.teamTricode, nextDayStr)];
            }

            const marker = createGameMarker(game, pos.isSelected, pos.isHighlighted, gameOdds, pos.heat);
            markersOnRow.push({
                col: pos.col,
                length: marker.length,
                isLive: pos.isLive,
                isSelected: pos.isSelected,
                isHighlighted: pos.isHighlighted,
                gameIdx,
                content: marker,
                heat: pos.heat
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
                // Team Color Block - Always prioritize this for the tricode background
                finalBg = bg;
                finalColor = '#ffffff'; // White text on team color
                finalBold = true;
                finalDim = false;
            } else if (marker.heat?.level === 'fire' || marker.heat?.level === 'hot') {
                // Hot games get special text color for scores/info
                finalColor = marker.heat.level === 'fire' ? 'red' : 'orange';
                finalBold = true;
                if (marker.isSelected) {
                    finalColor = 'cyan';
                }
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

        let displayContent = rawContent;
        if (marker.isLive && rawContent.startsWith('●●')) {
            const dot = liveDotVisible ? '●' : '○';
            displayContent = dot + rawContent.slice(2);
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
function GameDetail({ game, odds, currentIndex, totalGames, heat }: { game: Game; odds?: GameOdds; currentIndex: number; totalGames: number; heat?: HeatData }) {
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

    // Border color reacts to heat
    let borderColor = 'cyan';
    if (heat?.level === 'fire') borderColor = 'red';
    else if (heat?.level === 'hot') borderColor = 'orange';

    return (
        <Box
            borderStyle="round"
            borderColor={borderColor}
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

                {/* Social Heat Indicator */}
                {heat && heat.level !== 'cold' && (
                    <Box marginTop={0}>
                        <HeatIndicator level={heat.level} count={heat.count} />
                    </Box>
                )}

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

    // Social Heat Hook
    const heatMap = useSocialHeat(games, odds);

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


    // Helper to robustly find odds across potential date boundaries
    const findGameOdds = (game: Game, odds: Record<string, GameOdds>) => {
        if (!game || !odds) return undefined;
        const gameDate = game.gameTimeUTC?.slice(0, 10) || '';
        if (!gameDate) return undefined;

        // Try exact match
        let key = getOddsKey(game.awayTeam.teamTricode, game.homeTeam.teamTricode, gameDate);
        if (odds[key]) return odds[key];

        // Try next day (common for late games or timezone shifts)
        const nextDay = new Date(gameDate);
        nextDay.setDate(nextDay.getDate() + 1);
        const nextDayStr = nextDay.toISOString().slice(0, 10);
        key = getOddsKey(game.awayTeam.teamTricode, game.homeTeam.teamTricode, nextDayStr);
        if (odds[key]) return odds[key];

        // Try previous day
        const prevDay = new Date(gameDate);
        prevDay.setDate(prevDay.getDate() - 1);
        const prevDayStr = prevDay.toISOString().slice(0, 10);
        key = getOddsKey(game.awayTeam.teamTricode, game.homeTeam.teamTricode, prevDayStr);
        return odds[key];
    };

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

    const loadGamesForDate = async (date: Date, isBackgroundRefresh = false) => {
        if (!isBackgroundRefresh) {
            setLoading(true);
        }

        const offset = new Date().getTimezoneOffset();
        let queryDate = date;
        const isViewingToday = isSameDay(date, new Date());

        if (offset <= 0) {
            queryDate = subDays(date, 1);
        }

        const dateStr = format(queryDate, 'yyyy-MM-dd');

        // Check if the date is DEEP in the past (2 days ago or more)
        // We allow "Yesterday" because timezones might mean Yesterday is actually the active game day.
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfYesterday = subDays(startOfToday, 1);

        // Treat as "Past" only if it's strictly before Yesterday
        const isPastDate = queryDate.getTime() < startOfYesterday.getTime();

        // For real-time data: use fetchTodayGames when viewing today (has live scores)
        // For historical data: use fetchGamesByDate
        const gamesPromise = isViewingToday
            ? fetchTodayGames()
            : fetchGamesByDate(dateStr);

        let gamesData: Game[];
        let oddsData: Record<string, GameOdds> = {};

        if (isPastDate) {
            // Optimization: Don't fetch odds for historical games (older than yesterday)
            [gamesData] = await Promise.all([gamesPromise]);
        } else {
            // Fetch odds for Today, Yesterday, and Future
            [gamesData, oddsData] = await Promise.all([
                gamesPromise,
                fetchPolymarketOdds()
            ]);
        }

        setGames(gamesData);
        setOdds(oddsData);
        if (!isBackgroundRefresh) {
            setLoading(false);
        }
        setLastUpdated(new Date());

        if (!isBackgroundRefresh && gamesData.length > 0) setSelectedIndex(0);
    };

    const checkConnection = async () => {
        const isHealthy = await checkHealth();
        setConnected(isHealthy);
    };

    useEffect(() => {
        loadGamesForDate(currentDate);
        checkConnection();
    }, [currentDate]);

    useEffect(() => {
        const timer = setInterval(() => {
            const hasLiveGames = games.some(g => g.gameStatus === 2);
            if (isSameDay(currentDate, new Date()) || hasLiveGames) {
                loadGamesForDate(currentDate, true);
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

    const minMapWidth = 100;
    const minFullWidth = 165;
    const minHeight = 40;

    const isMapCramped = termWidth < minMapWidth || termHeight < minHeight;
    const isSidebarCramped = showStandings && termWidth < minFullWidth;

    let warningHeight = 0;
    if (isMapCramped || isSidebarCramped) {
        warningHeight += 2;
        warningHeight += 1;
        if (isMapCramped) warningHeight += 1;
        if (isSidebarCramped) warningHeight += 1;
        warningHeight += 1;
    }

    if (view === 'detail' && games[selectedIndex]) {
        return <GameDetailPage game={games[selectedIndex]} onBack={() => setView('map')} />;
    }

    const availableHeight = termHeight - 12 - warningHeight;
    const mapHeight = Math.max(0, Math.min(availableHeight, 25));
    const mapLines = getCleanMap().slice(0, mapHeight);

    const { lines: mapWithGames, gameColors } = embedGamesInMap(
        mapLines, games, selectedIndex, Math.min(termWidth - 2, US_MAP_WIDTH), searchFilter, heatMap
    );

    const dateDisplay = isSameDay(currentDate, new Date()) ? 'TODAY' : format(currentDate, 'yyyy-MM-dd');

    return (
        <Box flexDirection="column" height={termHeight}>
            {(isMapCramped || isSidebarCramped) && (
                <Box borderStyle="double" borderColor="red" flexDirection="column" alignItems="center" marginBottom={1}>
                    <Text color="red" bold>⚠️  Resolution Warning</Text>
                    {isMapCramped && <Text>Map requires {minMapWidth}x{minHeight} (Current: {termWidth}x{termHeight})</Text>}
                    {isSidebarCramped && <Text>Sidebar requires width {minFullWidth} (Current: {termWidth})</Text>}
                </Box>
            )}

            <Box justifyContent="center" flexDirection="column" alignItems="center">
                <Text bold color="cyan">🏀 NBA BATTLE MAP 🏀</Text>
                <Text bold color="yellow">📅 {dateDisplay} 📅</Text>
            </Box>

            <Box flexDirection="row" flexGrow={1} justifyContent="center" marginTop={1}>
                <Box flexDirection="column" alignItems="center">
                    {games.length === 0 && !loading ? (
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
                            // Pass heat to detail
                            const gameHeat = heatMap[game.gameId];
                            return <GameDetail game={game} odds={gameOdds} currentIndex={selectedIndex} totalGames={games.length} heat={gameHeat} />;
                        })()
                    )}
                </Box>

                <StandingsSidebar visible={showStandings} />
            </Box>

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
