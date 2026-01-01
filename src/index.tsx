/**
 * NBA-TUI Main Application
 * Map-centric view with games positioned at city locations
 */
import React, { useState, useEffect } from 'react';
import { render, Box, Text, useInput, useApp } from 'ink';
import Spinner from 'ink-spinner';
import { format, isSameDay } from 'date-fns';
import { getOddsKey } from './services/apiClient.js';
import { getCleanMap, US_MAP_WIDTH } from './data/usMap.js';
import { getTeamPosition } from './data/teamCoords.js';
import { GameDetailPage } from './pages/GameDetailPage.js';
import { StandingsSidebar } from './components/StandingsSidebar.js';
import { HeatIndicator } from './components/HeatIndicator.js';

import { findNearestGame } from './utils/mapNavigation.js';

import { embedGamesInMap } from './utils/mapRendering.js';
import { MapLine } from './components/MapLine.js';

import { GameDetail } from './components/GameDetail.js';
import { Header, Footer } from './components/Layout.js';

// Main App
// Main App
import { useGameStore } from './store/gameStore.js';

function App() {
    const { exit } = useApp();

    // Store State
    const games = useGameStore(state => state.games);
    const currentDate = useGameStore(state => state.currentDate);
    const selectedIndex = useGameStore(state => state.selectedIndex);
    const connected = useGameStore(state => state.connected);
    const loading = useGameStore(state => state.loading);
    const odds = useGameStore(state => state.odds);
    const socialHeat = useGameStore(state => state.socialHeat);

    // Store Actions
    const loadGamesForDate = useGameStore(state => state.loadGamesForDate);
    const checkConnection = useGameStore(state => state.checkConnection);
    const setSelectedIndex = useGameStore(state => state.setSelectedIndex);
    const moveSelection = useGameStore(state => state.moveSelection);
    const changeDate = useGameStore(state => state.changeDate);

    // Local UI State
    const [view, setView] = useState<'map' | 'detail'>('map');
    const [searchFilter, setSearchFilter] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [showStandings, setShowStandings] = useState(false);

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

    // Initial Load & Connection Check
    useEffect(() => {
        loadGamesForDate(currentDate);
        checkConnection();
    }, [currentDate]);

    // Background Refresh
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
            moveSelection('up');
        }

        if (key.downArrow) {
            moveSelection('down');
        }

        if (key.leftArrow) {
            changeDate('prev');
        }

        if (key.rightArrow) {
            changeDate('next');
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
        mapLines, games, selectedIndex, Math.min(termWidth - 2, US_MAP_WIDTH), searchFilter, socialHeat
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

            {/* Header */}
            <Header dateDisplay={dateDisplay} />

            <Box flexDirection="row" flexGrow={1} justifyContent="center" marginTop={1}>
                {/* ... Main Content ... */}
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
                            const gameHeat = socialHeat[game.gameId];
                            return <GameDetail game={game} odds={gameOdds} currentIndex={selectedIndex} totalGames={games.length} heat={gameHeat} />;
                        })()
                    )}
                </Box>

                <StandingsSidebar visible={showStandings} />
            </Box>

            {/* Footer */}
            <Footer
                connected={connected}
                loading={loading}
                gamesCount={games.length}
                SpinnerComponent={Spinner}
            />
        </Box>
    );
}

render(<App />);
