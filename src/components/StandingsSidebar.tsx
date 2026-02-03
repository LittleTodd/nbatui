import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { fetchStandings, fetchPolymarketProps } from '../services/apiClient.js';
import { TeamDetailModal } from './TeamDetailModal.js';

interface StandingsSidebarProps {
    visible: boolean;
    onClose?: () => void;
}

export const StandingsSidebar = ({ visible, onClose }: StandingsSidebarProps) => {
    const [standings, setStandings] = useState<any[]>([]);
    const [props, setProps] = useState<Record<string, any[]>>({});

    // Selection state
    const [selectedConf, setSelectedConf] = useState<'east' | 'west'>('east');
    const [selectedIdx, setSelectedIdx] = useState(0);
    const [showModal, setShowModal] = useState(false);
    const [selectedTeam, setSelectedTeam] = useState<any | null>(null);

    useEffect(() => {
        if (visible) {
            // Fetch Standings
            fetchStandings().then(data => {
                if (data && data.standings) {
                    setStandings(data.standings);
                }
            });

            // Fetch Props
            fetchPolymarketProps().then(data => {
                if (data) setProps(data);
            });
        }
    }, [visible]);

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

        // Navigate up/down in current conference
        if (key.upArrow) {
            setSelectedIdx(prev => Math.max(0, prev - 1));
        }
        if (key.downArrow) {
            setSelectedIdx(prev => Math.min(14, prev + 1));
        }

        // Switch between East and West
        if (key.leftArrow || key.rightArrow || input === '\t') {
            setSelectedConf(prev => prev === 'east' ? 'west' : 'east');
        }

        // Open team detail modal
        if (key.return) {
            const conf = selectedConf === 'east' ? east : west;
            if (conf[selectedIdx]) {
                setSelectedTeam(conf[selectedIdx]);
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

    // Split East/West and take top 15
    const east = standings.filter((t: any) => t.Conference === 'East').slice(0, 15);
    const west = standings.filter((t: any) => t.Conference === 'West').slice(0, 15);

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

    const renderPropTable = (title: string, candidates: any[]) => {
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
            <Box flexDirection="column" marginLeft={1}>
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

    // Main standings view (only when modal is NOT shown)
    return (
        <Box flexDirection="column" marginLeft={1}>
            <Box borderStyle="single" flexDirection="column" paddingX={1}>
                <Text bold underline>Standings</Text>
                <Text dimColor>↑↓ select • ←→ switch • Enter view</Text>

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

                <Box marginTop={1}>
                    <Text dimColor>1-6:Playoff 7-10:Play-in</Text>
                </Box>

                <Box marginTop={1} borderStyle="single" borderTop={false} borderLeft={false} borderRight={false} borderBottom={true} borderColor="gray" />

                {/* Polymarket Predictions */}
                <Box marginTop={1} flexDirection="column">
                    <Text dimColor>Polymarket Predictions</Text>
                    <Box flexDirection="row" gap={4} marginTop={1}>
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
