/**
 * LiveOnCourt Component
 * Displays the 5 players currently on court for each team during live games.
 * Supports player selection and viewing individual stats.
 * 
 * Design: Matches QuarterScoreTable structure for visual consistency
 */
import React, { useState, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { TEAM_BG_COLORS, TEAM_TEXT_COLORS } from '../data/teamColors.js';

interface PlayerStats {
    personId: number;
    name: string;          // Full name (e.g., "James Harden")
    nameI: string;         // Short name (e.g., "J. Harden")
    familyName: string;    // Last name (e.g., "Harden")
    firstName: string;     // First name (e.g., "James")
    jerseyNum: string;
    position: string;
    played: string;        // "1" if played
    oncourt: string;       // "1" if currently on court
    statistics: {
        points: number;
        reboundsTotal: number;
        assists: number;
        steals: number;
        blocks: number;
        turnovers: number;
        foulsPersonal: number;
        plusMinusPoints: number;
        fieldGoalsMade: number;
        fieldGoalsAttempted: number;
        threePointersMade: number;
        threePointersAttempted: number;
        freeThrowsMade: number;
        freeThrowsAttempted: number;
        minutes: string;   // e.g., "PT32M45.00S"
    };
}

interface TeamData {
    teamTricode: string;
    teamName: string;
    players: PlayerStats[];
}

interface LiveOnCourtProps {
    awayTeam: TeamData;
    homeTeam: TeamData;
    isActive: boolean;          // Whether this panel has focus
    onPlayerSelect?: (player: PlayerStats, teamTricode: string) => void;
    onModalStateChange?: (isOpen: boolean) => void;
}

// Parse minutes from ISO duration format
function parseMinutes(isoMinutes: string): string {
    if (!isoMinutes) return '0:00';
    const match = isoMinutes.match(/PT(\d+)M([\d.]+)S/);
    if (!match) return isoMinutes;
    const mins = match[1] || '0';
    const secs = Math.floor(parseFloat(match[2] || '0'));
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Get players currently on court (oncourt === "1")
function getOnCourtPlayers(players: PlayerStats[]): PlayerStats[] {
    if (!players) return [];
    return players
        .filter(p => p.oncourt === '1')
        .slice(0, 5);  // Should be exactly 5, but cap just in case
}

// Smart name formatting: detect duplicates and add first initial
function formatPlayerNames(players: PlayerStats[]): { player: PlayerStats; displayName: string }[] {
    // Count occurrences of each family name
    const familyNameCount: Record<string, number> = {};
    for (const p of players) {
        const fn = p.familyName || p.nameI?.split(' ').pop() || 'Unknown';
        familyNameCount[fn] = (familyNameCount[fn] || 0) + 1;
    }

    return players.map(p => {
        const familyName = p.familyName || p.nameI?.split(' ').pop() || 'Unknown';
        const firstName = p.firstName || p.nameI?.split(' ')[0] || '';
        const initial = firstName.charAt(0);

        // If duplicate family name, use "J.Williams" format
        let displayName = familyName;
        if (familyNameCount[familyName] && familyNameCount[familyName] > 1 && initial) {
            displayName = `${initial}.${familyName}`;
        }

        // Truncate if still too long
        if (displayName.length > 11) {
            displayName = displayName.slice(0, 10) + '.';
        }

        return { player: p, displayName };
    });
}

// Mini Stats Card for selected player
// Mini Stats Card for selected player - Enhanced UI/UX
function PlayerStatsCard({ player, teamTricode, onClose }: { player: PlayerStats; teamTricode: string; onClose: () => void }) {
    const stats = player.statistics;

    useInput((input, key) => {
        if (key.escape || key.return) {
            onClose();
        }
    });

    const formatPct = (made: number, att: number) => {
        if (!att || att === 0) return '0%';
        return `${Math.round((made / att) * 100)}%`;
    };

    const renderProgressBar = (made: number, att: number, color = 'cyan') => {
        const total = 5; // 5 blocks total
        const filled = att > 0 ? Math.round((made / att) * total) : 0;
        return (
            <Text>
                <Text color={color}>{'■'.repeat(filled)}</Text>
                <Text dimColor>{'□'.repeat(total - filled)}</Text>
            </Text>
        );
    };

    return (
        <Box flexDirection="column" paddingX={1} flexGrow={1}>
            {/* Primary Stats Row */}
            <Box justifyContent="space-between">
                <Box flexDirection="column" alignItems="center">
                    <Text bold color="yellow">{stats.points}</Text>
                    <Text dimColor>PTS</Text>
                </Box>
                <Box flexDirection="column" alignItems="center">
                    <Text bold color="white">{stats.reboundsTotal}</Text>
                    <Text dimColor>REB</Text>
                </Box>
                <Box flexDirection="column" alignItems="center">
                    <Text bold color="white">{stats.assists}</Text>
                    <Text dimColor>AST</Text>
                </Box>
                <Box flexDirection="column" alignItems="center">
                    <Text bold color={stats.plusMinusPoints > 0 ? 'green' : stats.plusMinusPoints < 0 ? 'red' : 'white'}>
                        {stats.plusMinusPoints > 0 ? '+' : ''}{stats.plusMinusPoints}
                    </Text>
                    <Text dimColor>+/-</Text>
                </Box>
            </Box>

            {/* Shooting Percentages & Efficiency */}
            <Box flexDirection="row" justifyContent="space-between" paddingY={0}>
                <Box flexDirection="column" width="30%">
                    <Box justifyContent="space-between">
                        <Text color="white">FG </Text>
                        <Text bold>{formatPct(stats.fieldGoalsMade, stats.fieldGoalsAttempted)}</Text>
                    </Box>
                    <Box justifyContent="space-between">
                        <Text dimColor>{stats.fieldGoalsMade}/{stats.fieldGoalsAttempted}</Text>
                        {renderProgressBar(stats.fieldGoalsMade, stats.fieldGoalsAttempted)}
                    </Box>
                </Box>

                <Box flexDirection="column" width="30%">
                    <Box justifyContent="space-between">
                        <Text color="white">3PT</Text>
                        <Text bold>{formatPct(stats.threePointersMade, stats.threePointersAttempted)}</Text>
                    </Box>
                    <Box justifyContent="space-between">
                        <Text dimColor>{stats.threePointersMade}/{stats.threePointersAttempted}</Text>
                        {renderProgressBar(stats.threePointersMade, stats.threePointersAttempted, 'yellow')}
                    </Box>
                </Box>

                <Box flexDirection="column" width="30%">
                    <Box justifyContent="space-between">
                        <Text color="white">FT </Text>
                        <Text bold>{formatPct(stats.freeThrowsMade, stats.freeThrowsAttempted)}</Text>
                    </Box>
                    <Box justifyContent="space-between">
                        <Text dimColor>{stats.freeThrowsMade}/{stats.freeThrowsAttempted}</Text>
                        {renderProgressBar(stats.freeThrowsMade, stats.freeThrowsAttempted, 'green')}
                    </Box>
                </Box>
            </Box>

            {/* Secondary Stats: Defense & Usage (No margin) */}
            <Box justifyContent="space-between">
                <Box>
                    <Text dimColor>MIN </Text>
                    <Text bold color="#000000">{parseMinutes(stats.minutes)}</Text>
                </Box>
                <Box>
                    <Text dimColor>STL </Text>
                    <Text bold color={stats.steals >= 2 ? 'green' : '#000000'}>{stats.steals}</Text>
                </Box>
                <Box>
                    <Text dimColor>BLK </Text>
                    <Text bold color={stats.blocks >= 2 ? 'green' : '#000000'}>{stats.blocks}</Text>
                </Box>
                <Box>
                    <Text dimColor>TO </Text>
                    <Text bold color={stats.turnovers >= 4 ? 'red' : '#000000'}>{stats.turnovers}</Text>
                </Box>
                <Box>
                    <Text dimColor>PF </Text>
                    <Text bold color={stats.foulsPersonal >= 5 ? 'red' : stats.foulsPersonal >= 4 ? 'yellow' : '#000000'}>{stats.foulsPersonal}</Text>
                </Box>
            </Box>
        </Box>
    );
}

export function LiveOnCourt({ awayTeam, homeTeam, isActive, onPlayerSelect, onModalStateChange }: LiveOnCourtProps) {
    // Selection state: 0 = away team row, 1 = home team row
    // playerIndex: 0-4 for the 5 players
    const [selectedRow, setSelectedRow] = useState(0);
    const [selectedCol, setSelectedCol] = useState(0);
    const [showStatsCard, setShowStatsCard] = useState(false);

    // State to lock onto a specific player ID when viewing stats
    // This prevents the view from switching if the player is subbed out
    const [viewingPlayerId, setViewingPlayerId] = useState<number | null>(null);

    const awayOnCourt = useMemo(() => getOnCourtPlayers(awayTeam.players), [awayTeam.players]);
    const homeOnCourt = useMemo(() => getOnCourtPlayers(homeTeam.players), [homeTeam.players]);

    // Format names with duplicate detection
    const awayFormatted = useMemo(() => formatPlayerNames(awayOnCourt), [awayOnCourt]);
    const homeFormatted = useMemo(() => formatPlayerNames(homeOnCourt), [homeOnCourt]);

    const awayBg = TEAM_BG_COLORS[awayTeam.teamTricode] || '#333';
    const homeBg = TEAM_BG_COLORS[homeTeam.teamTricode] || '#333';
    const awayText = TEAM_TEXT_COLORS[awayTeam.teamTricode] || '#fff';
    const homeText = TEAM_TEXT_COLORS[homeTeam.teamTricode] || '#fff';

    // Get currently highlighted player (cursor position)
    const highlightedPlayer = useMemo(() => {
        const players = selectedRow === 0 ? awayOnCourt : homeOnCourt;
        return players[selectedCol] || null;
    }, [selectedRow, selectedCol, awayOnCourt, homeOnCourt]);

    // Get the player to actually display in the card (locked by ID if viewing, otherwise highlighted)
    const activePlayerContext = useMemo(() => {
        if (showStatsCard && viewingPlayerId) {
            // If viewing stats, find the locked player in the FULL roster (even if subbed out)
            const awayP = awayTeam.players.find(p => p.personId === viewingPlayerId);
            if (awayP) return { player: awayP, tricode: awayTeam.teamTricode, bg: awayBg, text: awayText };

            const homeP = homeTeam.players.find(p => p.personId === viewingPlayerId);
            if (homeP) return { player: homeP, tricode: homeTeam.teamTricode, bg: homeBg, text: homeText };

            // Fallback if player not found in rosters (rare)
            return null;
        }

        // Otherwise use cursor position
        if (highlightedPlayer) {
            const tricode = selectedRow === 0 ? awayTeam.teamTricode : homeTeam.teamTricode;
            const bg = selectedRow === 0 ? awayBg : homeBg;
            const text = selectedRow === 0 ? awayText : homeText;
            return { player: highlightedPlayer, tricode, bg, text };
        }
        return null;
    }, [showStatsCard, viewingPlayerId, highlightedPlayer, awayTeam, homeTeam, selectedRow, awayBg, awayText, homeBg, homeText]);


    useInput((input, key) => {
        if (!isActive) return;

        if (showStatsCard) {
            // Stats card is handled by its own component for rendering, 
            // but we need to capture close event if it bubbled up or wasn't handled? 
            // Actually PlayerStatsCard has its own useInput. 
            // But we need to close it here if passed as prop.
            return;
        }

        if (key.leftArrow) {
            setSelectedCol(prev => Math.max(0, prev - 1));
        }
        if (key.rightArrow) {
            const maxCol = (selectedRow === 0 ? awayOnCourt.length : homeOnCourt.length) - 1;
            setSelectedCol(prev => Math.min(maxCol, prev + 1));
        }
        if (key.upArrow) {
            setSelectedRow(0);
        }
        if (key.downArrow) {
            setSelectedRow(1);
        }
        if (key.return && highlightedPlayer) {
            setViewingPlayerId(highlightedPlayer.personId);
            setShowStatsCard(true);
            onModalStateChange?.(true);
            if (onPlayerSelect) {
                // Determine tricode for highlighted player
                const tricode = selectedRow === 0 ? awayTeam.teamTricode : homeTeam.teamTricode;
                onPlayerSelect(highlightedPlayer, tricode);
            }
        }
    });

    // Handle closing the stats card
    const handleCloseStats = () => {
        setShowStatsCard(false);
        setViewingPlayerId(null);
        onModalStateChange?.(false);
    };

    // Render a team row with players spread across available space
    const renderTeamRow = (
        formatted: { player: PlayerStats; displayName: string }[],
        teamTricode: string,
        teamBg: string,
        teamText: string,
        rowIndex: number
    ) => {
        const isRowSelected = isActive && selectedRow === rowIndex;

        return (
            <Box height={1}>
                {/* Team Badge - same width as QuarterScoreTable TEAM column */}
                <Box width={7}>
                    <Text backgroundColor={teamBg} color={teamText} bold>
                        {' '}{teamTricode}{' '}
                    </Text>
                </Box>

                {/* Player Names - Horizontal with table-like column alignment */}
                <Box flexGrow={1}>
                    {formatted.map(({ player, displayName }, idx) => {
                        const isSelected = isRowSelected && selectedCol === idx;
                        const stats = player.statistics;

                        return (
                            <Box key={player.personId} flexGrow={1} flexBasis={0} minWidth={0} paddingRight={1}>
                                <Text
                                    backgroundColor={isSelected ? teamBg : undefined}
                                    color={isSelected ? teamText : 'white'}
                                    bold={isSelected}
                                    wrap="truncate-end"
                                >
                                    {isSelected ? '▸' : ' '}{displayName}
                                </Text>
                                {/* Indicators */}
                                {stats?.foulsPersonal >= 4 && (
                                    <Text color="yellow">⚠</Text>
                                )}
                                {stats?.points >= 15 && (
                                    <Text>🔥</Text>
                                )}
                            </Box>
                        );
                    })}
                </Box>
            </Box>
        );
    };

    // If no players on court (unlikely during live game), show placeholder
    if (awayOnCourt.length === 0 && homeOnCourt.length === 0) {
        return (
            <Box
                flexDirection="column"
                flexGrow={1}
                borderStyle="single"
                borderColor="gray"
                paddingX={1}
            >
                <Text bold color="cyan">🏀 On Court</Text>
                <Box flexGrow={1} alignItems="center" justifyContent="center">
                    <Text dimColor>Waiting for lineup data...</Text>
                </Box>
            </Box>
        );
    }

    return (
        <Box flexDirection="column" flexGrow={1}>
            {/* Main Panel - Structure matches QuarterScoreTable */}
            <Box
                flexDirection="column"
                borderStyle={isActive ? 'double' : 'single'}
                borderColor={isActive ? 'green' : 'gray'}
                paddingX={1}
            >
                {/* Title inside border */}
                {showStatsCard && activePlayerContext ? (
                    <Box flexDirection="row" justifyContent="space-between" alignItems="center">
                        <Box>
                            <Text backgroundColor={activePlayerContext.bg} color={activePlayerContext.text} bold>
                                {' '}#{activePlayerContext.player.jerseyNum} {activePlayerContext.player.name}{' '}
                            </Text>
                            <Text dimColor> • {activePlayerContext.player.position}</Text>
                        </Box>
                        <Text dimColor>(Esc to close)</Text>
                    </Box>
                ) : (
                    <Text bold color={isActive ? 'green' : 'cyan'}>
                        🏀 On Court <Text dimColor>{isActive ? '(←→↑↓ Enter)' : '[Tab] Check Player Stats ▲'}</Text>
                    </Text>
                )}

                {/* Content area - matches left panel structure exactly */}
                <Box flexDirection="column" marginTop={showStatsCard ? 0 : 1}>
                    {showStatsCard && activePlayerContext ? (
                        // Stats View (Replaces List)
                        <PlayerStatsCard
                            player={activePlayerContext.player}
                            teamTricode={activePlayerContext.tricode}
                            onClose={handleCloseStats}
                        />
                    ) : (
                        // List View
                        <>
                            {/* Header Row */}
                            <Box marginBottom={1}>
                                <Box width={7}><Text dimColor>TEAM</Text></Box>
                                <Box flexGrow={1} justifyContent="center">
                                    <Text dimColor>─── LINEUP ───</Text>
                                </Box>
                            </Box>

                            {/* Away Team Row */}
                            {renderTeamRow(awayFormatted, awayTeam.teamTricode, awayBg, awayText, 0)}

                            {/* Home Team Row */}
                            {renderTeamRow(homeFormatted, homeTeam.teamTricode, homeBg, homeText, 1)}
                        </>
                    )}
                </Box>
            </Box>
        </Box>
    );
}
