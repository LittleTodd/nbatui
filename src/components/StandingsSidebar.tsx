import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { fetchStandings, fetchPolymarketProps } from '../services/apiClient.js';
import { TeamDetailModal } from './TeamDetailModal.js';

interface StandingsSidebarProps {
    visible: boolean;
    onClose?: () => void;
    onModalStateChange?: (isOpen: boolean) => void;
}

export const StandingsSidebar = ({ visible, onClose, onModalStateChange }: StandingsSidebarProps) => {
    const [standings, setStandings] = useState<any[]>([]);
    const [props, setProps] = useState<Record<string, any[]>>({});

    // Selection state
    const [selectedConf, setSelectedConf] = useState<'east' | 'west'>('east');
    const [selectedIdx, setSelectedIdx] = useState(0);
    const [showModal, setShowModal] = useState(false);
    const [selectedTeam, setSelectedTeam] = useState<any | null>(null);

    useEffect(() => {
        onModalStateChange?.(showModal);
    }, [showModal, onModalStateChange]);

    useEffect(() => {
        if (!visible) return;
        let cancelled = false;

        fetchStandings().then(data => {
            if (!cancelled && data && data.standings) {
                setStandings(data.standings);
            }
        });

        fetchPolymarketProps().then(data => {
            if (!cancelled && data) setProps(data);
        });

        return () => { cancelled = true; };
    }, [visible]);

    const east = standings.filter((t: any) => t.Conference === 'East').slice(0, 15);
    const west = standings.filter((t: any) => t.Conference === 'West').slice(0, 15);

    // Handle keyboard navigation
    useInput((input, key) => {
        if (!visible) return;

        // When modal is showing, don't handle any keys here (TeamDetailModal handles them)
        if (showModal) return;

        // Close standings view
        if (key.escape || input === 'q') {
            if (onClose) onClose();
            return;
        }

        const activeConf = selectedConf === 'east' ? east : west;
        const maxIdx = Math.max(0, activeConf.length - 1);

        // Navigate up/down in current conference (Arrow keys + Vim j/k)
        if (key.upArrow || input === 'k') {
            setSelectedIdx(prev => Math.max(0, prev - 1));
        }
        if (key.downArrow || input === 'j') {
            setSelectedIdx(prev => Math.min(maxIdx, prev + 1));
        }

        // Switch between East and West (Arrow keys + Vim h/l + Tab)
        if (key.leftArrow || key.rightArrow || input === 'h' || input === 'l' || key.tab) {
            setSelectedConf(prev => {
                const next = prev === 'east' ? 'west' : 'east';
                const nextList = next === 'east' ? east : west;
                setSelectedIdx(idx => Math.min(idx, Math.max(0, nextList.length - 1)));
                return next;
            });
        }

        // Open team detail modal
        if (key.return) {
            if (activeConf[selectedIdx]) {
                setSelectedTeam(activeConf[selectedIdx]);
                setShowModal(true);
            }
        }
    });

    if (!visible) return null;

    if (!standings.length) {
        return (
            <Box borderStyle="single" flexDirection="column" paddingX={1}>
                <Text>Loading...</Text>
            </Box>
        );
    }

    const renderTeamRow = (t: any, isSelected: boolean) => {
        const rank = t.PlayoffRank;
        const record = `${t.WINS}-${t.LOSSES}`;
        let color = 'gray'; // 11-15 (Lottery)

        if (rank <= 6) color = 'green'; // Playoff
        else if (rank <= 10) color = 'yellow'; // Play-in

        let teamLabel = t.TeamName;

        return (
            <Box key={t.TeamID} width={28}>
                <Box width={3}>
                    <Text color={isSelected ? 'white' : color} bold={isSelected}>
                        {rank}.
                    </Text>
                </Box>
                <Box width={17}>
                    <Text
                        color={isSelected ? 'cyan' : color}
                        bold={isSelected}
                        inverse={isSelected}
                    >
                        {teamLabel.padEnd(15, ' ')}
                    </Text>
                </Box>
                <Box width={8} justifyContent="flex-end">
                    <Text dimColor={!isSelected}>{record}</Text>
                </Box>
            </Box>
        );
    };

    const renderPropTable = (title: string, candidates?: any[]) => {
        if (!candidates || candidates.length === 0) return null;
        return (
            <Box flexDirection="column" marginBottom={1}>
                <Text bold underline color="cyan">{title}</Text>
                {candidates.slice(0, 3).map((c, idx) => (
                    <Box key={idx} justifyContent="space-between" width={28}>
                        <Text>{idx + 1}. {c.name.slice(0, 18)}</Text>
                        <Text color="green">{c.probability}%</Text>
                    </Box>
                ))}
            </Box>
        );
    };

    // When modal is shown, render ONLY the modal (not overlapped with standings)
    if (showModal) {
        return (
            <Box flexDirection="column" alignItems="center">
                <TeamDetailModal
                    team={selectedTeam}
                    visible={showModal}
                    onClose={() => {
                        setShowModal(false);
                        setSelectedTeam(null);
                    }}
                />
            </Box>
        );
    }

    // Main standings view (centered overlay drawer)
    return (
        <Box flexDirection="column" alignItems="center" marginTop={1}>
            <Box borderStyle="round" borderColor="cyan" flexDirection="column" paddingX={2} paddingY={0}>
                <Box justifyContent="space-between" width={66} marginBottom={1}>
                    <Text bold color="cyan">🏀 NBA STANDINGS & PLAYOFF RACE</Text>
                    <Text dimColor>Esc / s to close</Text>
                </Box>
                <Text dimColor>↑↓ select team • ←→ / Tab switch conf • Enter team hub</Text>

                <Box flexDirection="row" gap={4} marginTop={1}>
                    {/* East */}
                    <Box flexDirection="column">
                        <Box marginBottom={1}>
                            <Text
                                color="cyan"
                                bold
                                inverse={selectedConf === 'east'}
                            >
                                {selectedConf === 'east' ? ' EAST ' : 'EAST'}
                            </Text>
                        </Box>
                        {east.map((t, idx) => (
                            <Box flexDirection="column" key={t.TeamID}>
                                {renderTeamRow(t, selectedConf === 'east' && selectedIdx === idx)}
                                {/* Spacers */}
                                {t.PlayoffRank === 6 && <Box height={1} />}
                                {t.PlayoffRank === 10 && <Box height={1} />}
                            </Box>
                        ))}
                    </Box>

                    {/* West */}
                    <Box flexDirection="column">
                        <Box marginBottom={1}>
                            <Text
                                color="green"
                                bold
                                inverse={selectedConf === 'west'}
                            >
                                {selectedConf === 'west' ? ' WEST ' : 'WEST'}
                            </Text>
                        </Box>
                        {west.map((t, idx) => (
                            <Box flexDirection="column" key={t.TeamID}>
                                {renderTeamRow(t, selectedConf === 'west' && selectedIdx === idx)}
                                {/* Spacers */}
                                {t.PlayoffRank === 6 && <Box height={1} />}
                                {t.PlayoffRank === 10 && <Box height={1} />}
                            </Box>
                        ))}
                    </Box>
                </Box>

                <Box marginTop={1} justifyContent="space-between" width={66}>
                    <Text dimColor>1-6: Playoff   7-10: Play-in   11-15: Lottery</Text>
                    <Text color="yellow">Polymarket Odds ↓</Text>
                </Box>

                <Box marginTop={1} borderStyle="single" borderTop={false} borderLeft={false} borderRight={false} borderBottom={true} borderColor="gray" />

                {/* Polymarket Predictions */}
                <Box marginTop={1} flexDirection="column">
                    <Box flexDirection="row" gap={4}>
                        <Box flexDirection="column">
                            {renderPropTable("NBA Champion", props['championship'])}
                            {renderPropTable("Rookie of Year", props['rookie_of_year'])}
                        </Box>
                        <Box flexDirection="column">
                            {renderPropTable("MVP", props['mvp'])}
                            {renderPropTable("Coach of Year", props['coach_of_year'])}
                        </Box>
                    </Box>
                </Box>
            </Box>
        </Box>
    );
};
