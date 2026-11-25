/**
 * NBA-TUI Main Application
 * Map-centric and Scoreboard List views with responsive terminal sizing
 */
import React, { useState, useEffect, useMemo } from 'react';
import { render, Box, Text, useInput, useApp } from 'ink';
import BasketballSpinner from './components/BasketballSpinner.js';
import { format, isSameDay } from 'date-fns';
import { findGameOdds } from './services/apiClient.js';
import { getCleanMap, US_MAP_WIDTH, US_MAP_HEIGHT } from './data/usMap.js';
import { GameDetailPage } from './pages/GameDetailPage.js';
import { StandingsSidebar } from './components/StandingsSidebar.js';
import { ScoreboardList } from './components/ScoreboardList.js';
import { HelpOverlay } from './components/HelpOverlay.js';

import { embedGamesInMap, checkGameMatchesFilter } from './utils/mapRendering.js';
import { MapLine } from './components/MapLine.js';
import { ClutchTicker, evaluateGameClutch } from './components/ClutchTicker.js';
import { resetTerminalTitle } from './utils/terminalTitle.js';
import { useTerminalSize } from './hooks/useTerminalSize.js';

import { GameDetail } from './components/GameDetail.js';
import { Header, Footer } from './components/Layout.js';

import { useGameStore } from './store/gameStore.js';

function getLocalTimezoneAbbr(): string {
    try {
        return Intl.DateTimeFormat(undefined, { timeZoneName: 'short' })
            .formatToParts(new Date())
            .find(p => p.type === 'timeZoneName')?.value || '';
    } catch {
        return '';
    }
}

function App() {
    const { exit } = useApp();
    const { columns: termWidth, rows: termHeight } = useTerminalSize();

    // Store State
    const games = useGameStore(state => state.games);
    const currentDate = useGameStore(state => state.currentDate);
    const selectedIndex = useGameStore(state => state.selectedIndex);
    const connected = useGameStore(state => state.connected);
    const loading = useGameStore(state => state.loading);
    const lastUpdated = useGameStore(state => state.lastUpdated);
    const odds = useGameStore(state => state.odds);
    const dataWarning = useGameStore(state => state.dataWarning);
    const spoilerFree = useGameStore(state => state.spoilerFree);

    // Store Actions
    const loadGamesForDate = useGameStore(state => state.loadGamesForDate);
    const checkConnection = useGameStore(state => state.checkConnection);
    const setSelectedIndex = useGameStore(state => state.setSelectedIndex);
    const moveSelection = useGameStore(state => state.moveSelection);
    const changeDate = useGameStore(state => state.changeDate);
    const toggleSpoilerFree = useGameStore(state => state.toggleSpoilerFree);

    // Local UI State
    const [view, setView] = useState<'map' | 'detail'>('map');
    const [preferredViewMode, setPreferredViewMode] = useState<'map' | 'list'>('map');
    const [searchFilter, setSearchFilter] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [searchNotice, setSearchNotice] = useState<string | null>(null);
    const [showStandings, setShowStandings] = useState(false);
    const [standingsModalOpen, setStandingsModalOpen] = useState(false);
    const [showHelp, setShowHelp] = useState(false);

    const hasLiveGames = useMemo(() => games.some(g => g.gameStatus === 2), [games]);
    const tzLabel = useMemo(() => getLocalTimezoneAbbr(), []);

    // Auto-switch to compact list on narrow/short terminals (e.g. tmux / VS Code split panes)
    const isTerminalNarrow = termWidth < 80 || termHeight < 24;
    const effectiveViewMode: 'map' | 'list' = isTerminalNarrow ? 'list' : preferredViewMode;

    // Global blinking state for live game indicator (depends on boolean hasLiveGames, not games ref)
    const [liveDotVisible, setLiveDotVisible] = useState(true);
    useEffect(() => {
        if (!hasLiveGames) return;
        const timer = setInterval(() => {
            setLiveDotVisible(v => !v);
        }, 500);
        return () => clearInterval(timer);
    }, [hasLiveGames]);

    // Wave animation state: only tick when US Map is actually visible
    const [waveFrame, setWaveFrame] = useState(0);
    const isMapVisible = view === 'map' && effectiveViewMode === 'map' && !showStandings && !showHelp && games.length > 0;
    useEffect(() => {
        if (!isMapVisible) return;
        const timer = setInterval(() => {
            setWaveFrame(f => (f + 1) % 4);
        }, 1000);
        return () => clearInterval(timer);
    }, [isMapVisible]);

    // Clear transient search notice after 2.5s
    useEffect(() => {
        if (!searchNotice) return;
        const timer = setTimeout(() => setSearchNotice(null), 2500);
        return () => clearTimeout(timer);
    }, [searchNotice]);

    // Initial Load & Connection Check
    useEffect(() => {
        loadGamesForDate(currentDate);
        checkConnection();
    }, [currentDate]);

    // Background Refresh
    useEffect(() => {
        const timer = setInterval(() => {
            if (isSameDay(currentDate, new Date()) || hasLiveGames) {
                loadGamesForDate(currentDate, true);
                checkConnection();
            }
        }, 30000);
        return () => clearInterval(timer);
    }, [currentDate, hasLiveGames]);

    // Recover automatically if games becomes empty while in detail view (prevents input deadlock)
    useEffect(() => {
        if (view === 'detail' && !games[selectedIndex]) {
            setView('map');
        }
    }, [view, games, selectedIndex]);

    const searchMatchCount = useMemo(() => {
        if (!searchFilter) return 0;
        return games.filter(g => checkGameMatchesFilter(g, searchFilter)).length;
    }, [games, searchFilter]);

    useInput((input, key) => {
        if (view === 'detail') return;

        // HelpOverlay handles its own close keys
        if (showHelp) return;

        // Search input mode
        if (isSearching) {
            if (key.escape) {
                setIsSearching(false);
                setSearchFilter('');
                return;
            }
            if (key.return) {
                setIsSearching(false);
                if (searchFilter) {
                    const foundIdx = games.findIndex(g => checkGameMatchesFilter(g, searchFilter));
                    const query = searchFilter;
                    setSearchFilter('');
                    if (foundIdx !== -1) {
                        setSelectedIndex(foundIdx);
                        if (games.length > 0) setView('detail');
                    } else {
                        setSearchNotice(`No games matching "${query}" on ${format(currentDate, 'yyyy-MM-dd')}`);
                    }
                }
            } else if (key.backspace || key.delete) {
                setSearchFilter(prev => prev.slice(0, -1));
            } else if (input.length === 1 && !key.ctrl && !key.meta) {
                setSearchFilter(prev => prev + input);
            }
            return;
        }

        // When StandingsSidebar is open, only allow 's' to close it if TeamDetailModal is NOT open;
        // let StandingsSidebar / TeamDetailModal own all other keys.
        if (showStandings) {
            if (input === 's' && !standingsModalOpen) {
                setShowStandings(false);
            }
            return;
        }

        // Universal Help Overlay
        if (input === '?') {
            setShowHelp(true);
            return;
        }

        // Separate Quit ('q') from Back ('Esc') so mashing Esc never accidentally kills the app
        if (input === 'q') {
            exit();
            return;
        }

        if (input === '/') {
            setIsSearching(true);
            setSearchNotice(null);
            return;
        }

        if (input === 'r') {
            loadGamesForDate(currentDate, true);
            checkConnection();
            return;
        }

        if (input === 's') {
            setShowStandings(true);
            return;
        }

        if (input === 'm' || input === 'M') {
            setPreferredViewMode(prev => prev === 'map' ? 'list' : 'map');
            return;
        }

        if (input === 'x' || input === 'X') {
            toggleSpoilerFree();
            return;
        }

        if (input === 'z' || input === 'Z') {
            let bestIdx = -1;
            let bestLeverage = -1;
            games.forEach((g, idx) => {
                const evalClutch = evaluateGameClutch(g, idx);
                if (evalClutch.leverageScore > bestLeverage) {
                    bestLeverage = evalClutch.leverageScore;
                    bestIdx = idx;
                }
            });
            if (bestIdx !== -1 && bestLeverage > 0) {
                setSelectedIndex(bestIdx);
                setView('detail');
                return;
            } else if (games.length > 0) {
                const firstLive = games.findIndex(g => g.gameStatus === 2);
                if (firstLive !== -1) {
                    setSelectedIndex(firstLive);
                    setView('detail');
                    return;
                }
            }
            setSearchNotice('No live games in progress right now');
            return;
        }

        if (key.return) {
            if (games.length > 0) {
                setView('detail');
            }
            return;
        }

        // Date Switching: ← / → (or h / l or [ / ] or , / .)
        if (key.leftArrow || input === 'h' || input === '[' || key.pageUp || input === ',') {
            changeDate('prev');
            return;
        }

        if (key.rightArrow || input === 'l' || input === ']' || key.pageDown || input === '.') {
            changeDate('next');
            return;
        }

        if (input === 't' || input === 'T') {
            loadGamesForDate(new Date());
            return;
        }

        // Game Selection: ↑ / ↓ (or k / j)
        if (key.upArrow || input === 'k') {
            moveSelection('up');
            return;
        }

        if (key.downArrow || input === 'j') {
            moveSelection('down');
            return;
        }
    });

    // Keep the calibrated 25-row continental US slice (rows 0..24 of usMap.ts)
    // and reserve exact non-map vertical chrome (+1 safety row) so total rendered
    // height stays strictly < termHeight (preventing Ink's full-screen clearTerminal flicker).
    const DISPLAY_MAP_HEIGHT = 25;
    const hasClutchTicker = useMemo(() => {
        if (spoilerFree) return false;
        return games.some((g, idx) => evaluateGameClutch(g, idx).leverageScore >= 60);
    }, [games, spoilerFree]);
    const selectedGame = games[selectedIndex];
    const hasSelectedOddsBar = Boolean(
        selectedGame && selectedGame.gameStatus === 1 && !spoilerFree &&
        (() => {
            const gd = selectedGame.localDate || selectedGame.gameDateET || selectedGame.gameTimeUTC?.slice(0, 10) || '';
            const go = findGameOdds(odds, selectedGame.awayTeam.teamTricode, selectedGame.homeTeam.teamTricode, gd);
            return go && go.homeProb > 0;
        })()
    );
    // Header(2) + ClutchTicker(0|3) + mainMargin(1) + GameDetail(8|10) + notice(0|2) + Footer(2) + safety(1)
    const nonMapHeight = 2 + (hasClutchTicker ? 3 : 0) + 1 + (hasSelectedOddsBar ? 10 : 8) + (searchNotice ? 2 : 0) + 2 + 1;
    const availableHeight = Math.max(10, termHeight - nonMapHeight);
    const mapHeight = Math.min(availableHeight, DISPLAY_MAP_HEIGHT);
    const mapLines = useMemo(() => getCleanMap().slice(0, mapHeight), [mapHeight]);

    const { lines: mapWithGames, gameColors } = useMemo(() => embedGamesInMap(
        mapLines, games, selectedIndex, Math.min(termWidth - 2, US_MAP_WIDTH), searchFilter, spoilerFree
    ), [mapLines, games, selectedIndex, termWidth, searchFilter, spoilerFree]);

    if (view === 'detail' && games[selectedIndex]) {
        const handlePrevGame = () => {
            if (games.length > 1) {
                setSelectedIndex((selectedIndex - 1 + games.length) % games.length);
            }
        };
        const handleNextGame = () => {
            if (games.length > 1) {
                setSelectedIndex((selectedIndex + 1) % games.length);
            }
        };
        return (
            <GameDetailPage
                game={games[selectedIndex]}
                onBack={() => setView('map')}
                onPrevGame={handlePrevGame}
                onNextGame={handleNextGame}
                gameIndex={selectedIndex}
                totalGames={games.length}
            />
        );
    }

    const dateDisplay = isSameDay(currentDate, new Date()) ? 'TODAY' : format(currentDate, 'yyyy-MM-dd');

    return (
        <Box flexDirection="column">
            {/* Header */}
            <Header dateDisplay={dateDisplay} spoilerFree={spoilerFree} tzLabel={tzLabel} />

            {/* Live Clutch & Heartbeat Ticker */}
            <ClutchTicker games={games} spoilerFree={spoilerFree} />

            {showHelp ? (
                <Box marginTop={1} justifyContent="center">
                    <HelpOverlay onClose={() => setShowHelp(false)} />
                </Box>
            ) : showStandings ? (
                <Box flexDirection="column" alignItems="center" marginTop={1}>
                    <StandingsSidebar
                        visible={showStandings}
                        onClose={() => {
                            setShowStandings(false);
                            setStandingsModalOpen(false);
                        }}
                        onModalStateChange={setStandingsModalOpen}
                    />
                </Box>
            ) : (
                <Box flexDirection="row" justifyContent="center" marginTop={1}>
                    <Box flexDirection="column" alignItems="center">
                        {loading && games.length === 0 ? (
                            <Box
                                flexDirection="column"
                                alignItems="center"
                                justifyContent="center"
                                height={Math.max(8, Math.min(mapHeight, 16))}
                                borderStyle="round"
                                borderColor="cyan"
                                paddingX={6}
                                paddingY={1}
                            >
                                <Text bold color="cyan">🏀 NBA BATTLE MAP 🏀</Text>
                                <Box marginTop={1}>
                                    <BasketballSpinner />
                                    <Text color="yellow"> Loading game data...</Text>
                                </Box>
                                <Box marginTop={0}>
                                    <Text dimColor>Fetching NBA schedule</Text>
                                </Box>
                            </Box>
                        ) : games.length === 0 && !loading ? (
                            <Box
                                flexDirection="column"
                                alignItems="center"
                                justifyContent="center"
                                height={Math.max(8, Math.min(mapHeight, 16))}
                                borderStyle="round"
                                borderColor={connected ? 'gray' : 'red'}
                                paddingX={4}
                                paddingY={1}
                            >
                                <Text bold color={connected ? 'yellow' : 'red'}>
                                    {connected ? '🏀 No Games Scheduled 🏀' : '⚠ Data Service Disconnected'}
                                </Text>
                                <Box marginTop={1}>
                                    <Text dimColor>
                                        {connected
                                            ? 'No NBA games found for this date.'
                                            : 'Check that data-service is running on localhost:8765.'}
                                    </Text>
                                </Box>
                                <Box marginTop={1}>
                                    <Text dimColor>Use </Text>
                                    <Text color="cyan" bold>← →</Text>
                                    <Text dimColor> to browse dates • </Text>
                                    <Text color="cyan" bold>r</Text>
                                    <Text dimColor> to retry</Text>
                                </Box>
                            </Box>
                        ) : effectiveViewMode === 'list' ? (
                            <ScoreboardList
                                games={games}
                                odds={odds}
                                selectedIndex={selectedIndex}
                                searchFilter={searchFilter}
                                spoilerFree={spoilerFree}
                                liveDotVisible={liveDotVisible}
                                maxWidth={termWidth}
                            />
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
                                    waveFrame={waveFrame}
                                    spoilerFree={spoilerFree}
                                />
                            ))
                        )}

                        {searchNotice && !isSearching && (
                            <Box marginTop={1}>
                                <Text color="yellow">ℹ {searchNotice}</Text>
                            </Box>
                        )}

                        {isSearching ? (
                            <Box flexDirection="column" marginTop={1} alignSelf="center">
                                <Box
                                    borderStyle="round"
                                    borderColor="yellow"
                                    paddingX={2}
                                    width={48}
                                    flexDirection="row"
                                    justifyContent="space-between"
                                >
                                    <Box>
                                        <Text>Search: </Text>
                                        <Text bold>{searchFilter}</Text>
                                        <Text color="yellow">█</Text>
                                    </Box>
                                    {searchFilter && (
                                        <Text color={searchMatchCount > 0 ? 'green' : 'red'}>
                                            ({searchMatchCount} {searchMatchCount === 1 ? 'match' : 'matches'})
                                        </Text>
                                    )}
                                </Box>
                                <Box justifyContent="center" marginTop={0}>
                                    <Text dimColor>Enter to open • Esc to cancel</Text>
                                </Box>
                            </Box>
                        ) : (
                            effectiveViewMode === 'map' && games.length > 0 && games[selectedIndex] && (() => {
                                const game = games[selectedIndex];
                                const gameDate = game.localDate || game.gameDateET || game.gameTimeUTC?.slice(0, 10) || '';
                                const gameOdds = findGameOdds(odds, game.awayTeam.teamTricode, game.homeTeam.teamTricode, gameDate);
                                return (
                                    <GameDetail
                                        game={game}
                                        odds={gameOdds}
                                        currentIndex={selectedIndex}
                                        totalGames={games.length}
                                        spoilerFree={spoilerFree}
                                    />
                                );
                            })()
                        )}
                    </Box>
                </Box>
            )}

            {/* Footer */}
            <Footer
                connected={connected}
                loading={loading}
                gamesCount={games.length}
                warning={dataWarning}
                termWidth={termWidth}
                lastUpdated={lastUpdated}
                viewMode={effectiveViewMode}
                spoilerFree={spoilerFree}
            />
        </Box>
    );
}

if (process.stdout.isTTY) {
    // Enter alternate screen buffer and move cursor to top-left
    process.stdout.write('\x1b[?1049h\x1b[H');
    const restoreTerminal = () => {
        resetTerminalTitle();
        process.stdout.write('\x1b[?1049l\x1b[?25h');
    };
    process.on('exit', restoreTerminal);
    process.on('SIGINT', () => {
        restoreTerminal();
        process.exit(0);
    });
    process.on('SIGTERM', () => {
        restoreTerminal();
        process.exit(0);
    });
}

// Wrap stdout with DEC Mode 2026 Synchronized Output (BSU/ESU) so modern terminals
// (Ghostty, iTerm2, Kitty, WezTerm, Alacritty, tmux 3.2+) paint each frame atomically.
const syncStdout: NodeJS.WriteStream = process.stdout.isTTY
    ? new Proxy(process.stdout, {
        get(target, prop, receiver) {
            if (prop === 'write') {
                return (chunk: string | Uint8Array, ...args: any[]) => {
                    if (typeof chunk === 'string' && chunk.length > 0) {
                        return target.write(`\x1b[?2026h${chunk}\x1b[?2026l`, ...args);
                    }
                    return (target.write as any)(chunk, ...args);
                };
            }
            const value = Reflect.get(target, prop, receiver);
            return typeof value === 'function' ? value.bind(target) : value;
        }
    })
    : process.stdout;

const appInstance = render(<App />, {
    stdout: syncStdout,
    incrementalRendering: true,
});
appInstance.waitUntilExit().then(() => {
    if (process.stdout.isTTY) {
        resetTerminalTitle();
        process.stdout.write('\x1b[?1049l\x1b[?25h');
    }
});
