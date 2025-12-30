import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import Spinner from 'ink-spinner';
import { Game, fetchBoxScore, fetchPlayByPlay } from '../services/apiClient.js';

interface GameDetailPageProps {
    game: Game;
    onBack: () => void;
}

export function GameDetailPage({ game, onBack }: GameDetailPageProps) {
    const [boxScore, setBoxScore] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;
        setLoading(true);
        // Clean gameId (sometimes it might need formatting?) usually 10 digits
        fetchBoxScore(game.gameId).then(data => {
            if (mounted) {
                setBoxScore(data);
                setLoading(false);
            }
        });
        return () => { mounted = false; };
    }, [game.gameId]);

    useInput((input, key) => {
        if (key.escape || input === 'q' || key.backspace) {
            onBack();
        }
    });

    if (loading) {
        return (
            <Box flexDirection="column" alignItems="center" justifyContent="center" height={20}>
                <Text color="green"><Spinner type="dots" /> Loading Data...</Text>
            </Box>
        );
    }

    if (!boxScore) {
        return (
            <Box flexDirection="column" alignItems="center">
                <Text color="red">Failed to load game data.</Text>
                <Text>Press Esc to return.</Text>
            </Box>
        );
    }

    return (
        <Box flexDirection="column" padding={1} borderStyle="round" borderColor="cyan">
            <Box justifyContent="center" marginBottom={1}>
                <Text bold color="yellow">
                    {boxScore.awayTeam.teamCity} {boxScore.awayTeam.teamName} ({boxScore.awayTeam.score})
                    {' @ '}
                    {boxScore.homeTeam.teamCity} {boxScore.homeTeam.teamName} ({boxScore.homeTeam.score})
                </Text>
            </Box>

            <Box marginBottom={1}>
                <Text>Status: {boxScore.gameStatusText}</Text>
            </Box>

            <Box flexDirection="column" marginTop={1}>
                <Box flexDirection="row" justifyContent="space-around">
                    <BoxScoreTable teamName={boxScore.awayTeam.teamTricode} players={boxScore.awayTeam.players} />
                    <BoxScoreTable teamName={boxScore.homeTeam.teamTricode} players={boxScore.homeTeam.players} />
                </Box>
            </Box>

            <Box marginTop={2}>
                <Text dimColor>Press Esc to go back</Text>
            </Box>
        </Box>
    );
}

const BoxScoreTable = ({ teamName, players }: { teamName: string, players: any[] }) => {
    // Sort active players by points
    const activePlayers = players
        ? players
            .filter((p: any) => p.played === '1')
            .sort((a: any, b: any) => b.statistics.points - a.statistics.points)
            .slice(0, 5)
        : [];

    return (
        <Box flexDirection="column" marginRight={2}>
            <Text bold underline>{teamName} Top Performers</Text>
            <Box flexDirection="column" marginTop={1}>
                <Box borderStyle="single" borderBottom={false} borderTop={false} borderLeft={false} borderRight={false}>
                    <Box width={15}><Text dimColor>PLAYER</Text></Box>
                    <Box width={5}><Text dimColor>PTS</Text></Box>
                    <Box width={5}><Text dimColor>REB</Text></Box>
                    <Box width={5}><Text dimColor>AST</Text></Box>
                </Box>
                {activePlayers.map((p: any) => (
                    <Box key={p.personId}>
                        <Box width={15}><Text>{p.nameI}</Text></Box>
                        <Box width={5}><Text>{p.statistics.points}</Text></Box>
                        <Box width={5}><Text>{p.statistics.reboundsTotal}</Text></Box>
                        <Box width={5}><Text>{p.statistics.assists}</Text></Box>
                    </Box>
                ))}
            </Box>
        </Box>
    );
};

