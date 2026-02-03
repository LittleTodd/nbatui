import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import type { RosterPlayer } from '../../services/apiClient.js';

interface RosterTabProps {
    players: RosterPlayer[];
    loading: boolean;
}

export const RosterTab = ({ players, loading }: RosterTabProps) => {
    if (loading) {
        return (
            <Box flexDirection="column" alignItems="center" justifyContent="center" height={15}>
                <Text color="yellow">Loading roster...</Text>
            </Box>
        );
    }

    if (!players || players.length === 0) {
        return (
            <Box flexDirection="column" alignItems="center" justifyContent="center" height={15}>
                <Text dimColor>No roster data available</Text>
            </Box>
        );
    }

    const [startIndex, setStartIndex] = useState(0);

    // Sort by minutes played (descending) to show starters first
    const sortedPlayers = [...players].sort((a, b) => {
        const aMin = a.stats?.min || 0;
        const bMin = b.stats?.min || 0;
        return bMin - aMin;
    });

    const PAGE_SIZE = 16;

    useInput((input, key) => {
        if (loading || players.length === 0) return;

        if (key.downArrow) {
            setStartIndex(prev => Math.min(prev + 1, Math.max(0, sortedPlayers.length - PAGE_SIZE)));
        }
        if (key.upArrow) {
            setStartIndex(prev => Math.max(prev - 1, 0));
        }
        if (key.pageDown) {
            setStartIndex(prev => Math.min(prev + PAGE_SIZE, Math.max(0, sortedPlayers.length - PAGE_SIZE)));
        }
        if (key.pageUp) {
            setStartIndex(prev => Math.max(prev - PAGE_SIZE, 0));
        }
    });

    const visiblePlayers = sortedPlayers.slice(startIndex, startIndex + PAGE_SIZE);

    return (
        <Box flexDirection="column">
            {/* Header */}
            <Box>
                <Box width={4}><Text bold dimColor>#</Text></Box>
                <Box width={16}><Text bold dimColor>Player</Text></Box>
                <Box width={5}><Text bold dimColor>Pos</Text></Box>
                <Box width={6}><Text bold dimColor>PPG</Text></Box>
                <Box width={6}><Text bold dimColor>RPG</Text></Box>
                <Box width={6}><Text bold dimColor>APG</Text></Box>
                <Box width={6}><Text bold dimColor>MIN</Text></Box>
            </Box>

            {/* Divider */}
            <Box marginBottom={0}>
                <Text dimColor>{'─'.repeat(49)}</Text>
            </Box>

            {/* Players */}
            {visiblePlayers.map((player, idx) => (
                <Box key={player.playerId || idx}>
                    <Box width={4}>
                        <Text>{player.num || '-'}</Text>
                    </Box>
                    <Box width={16}>
                        {/* Highlight top 5 based on actual rank, not visual position */}
                        <Text color={(startIndex + idx) < 5 ? 'white' : 'gray'}>
                            {(player.name || 'Unknown').slice(0, 15)}
                        </Text>
                    </Box>
                    <Box width={5}>
                        <Text dimColor>{player.position || '-'}</Text>
                    </Box>
                    <Box width={6}>
                        <Text color="green">
                            {player.stats?.ppg?.toFixed(1) || '-'}
                        </Text>
                    </Box>
                    <Box width={6}>
                        <Text color="cyan">
                            {player.stats?.rpg?.toFixed(1) || '-'}
                        </Text>
                    </Box>
                    <Box width={6}>
                        <Text color="yellow">
                            {player.stats?.apg?.toFixed(1) || '-'}
                        </Text>
                    </Box>
                    <Box width={6}>
                        <Text dimColor>
                            {player.stats?.min?.toFixed(1) || '-'}
                        </Text>
                    </Box>
                </Box>
            ))}

            {/* Scroll Indicators */}
            {sortedPlayers.length > PAGE_SIZE && (
                <Box marginTop={0} justifyContent="center">
                    <Text dimColor>
                        {startIndex > 0 ? '↑' : ' '}
                        {/* Simple dots to indicate more content */}
                        {' '}
                        {startIndex + visiblePlayers.length < sortedPlayers.length ? '↓' : ' '}
                    </Text>
                </Box>
            )}
        </Box>
    );
};
