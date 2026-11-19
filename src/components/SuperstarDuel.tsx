/**
 * SuperstarDuel Component
 * Fighting-Game Style Head-to-Head Alpha Dog Matchup HUD
 * 
 * Activated with [d] in GameDetailPage
 */
import React, { useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { TEAM_BG_COLORS, TEAM_TEXT_COLORS } from '../data/teamColors.js';

interface DuelPlayer {
    personId: number;
    name: string;
    nameI: string;
    jerseyNum: string;
    position: string;
    teamTricode: string;
    points: number;
    rebounds: number;
    assists: number;
    steals: number;
    blocks: number;
    fgm: number;
    fga: number;
    tpm: number;
    tpa: number;
    plusMinus: number;
}

interface SuperstarDuelProps {
    awayTeam: {
        teamTricode: string;
        teamName: string;
        players: any[];
    };
    homeTeam: {
        teamTricode: string;
        teamName: string;
        players: any[];
    };
    onClose: () => void;
}

function findTopStar(teamTricode: string, rawPlayers: any[]): DuelPlayer | null {
    if (!rawPlayers || rawPlayers.length === 0) return null;

    let bestPlayer: DuelPlayer | null = null;
    let bestScore = -Infinity;

    for (const p of rawPlayers) {
        const stats = p.statistics || {};
        const pts = stats.points || 0;
        const reb = stats.reboundsTotal || 0;
        const ast = stats.assists || 0;
        const stl = stats.steals || 0;
        const blk = stats.blocks || 0;
        const pm = stats.plusMinusPoints || 0;

        // Composite impact formula for top star
        const composite = pts * 1.5 + reb * 1.2 + ast * 1.4 + stl * 2.0 + blk * 2.0 + pm * 0.5;

        if (composite > bestScore) {
            bestScore = composite;
            bestPlayer = {
                personId: p.personId,
                name: p.name || p.nameI || 'Player',
                nameI: p.nameI || p.name || 'Player',
                jerseyNum: p.jerseyNum || '0',
                position: p.position || 'G',
                teamTricode,
                points: pts,
                rebounds: reb,
                assists: ast,
                steals: stl,
                blocks: blk,
                fgm: stats.fieldGoalsMade || 0,
                fga: stats.fieldGoalsAttempted || 0,
                tpm: stats.threePointersMade || 0,
                tpa: stats.threePointersAttempted || 0,
                plusMinus: pm
            };
        }
    }

    return bestPlayer;
}

function renderHealthBar(value: number, max: number = 40, length: number = 14): string {
    const ratio = Math.max(0, Math.min(1, value / max));
    const filled = Math.round(ratio * length);
    return '█'.repeat(filled) + '░'.repeat(length - filled);
}

export function SuperstarDuel({ awayTeam, homeTeam, onClose }: SuperstarDuelProps) {
    const awayStar = useMemo(() => findTopStar(awayTeam.teamTricode, awayTeam.players), [awayTeam]);
    const homeStar = useMemo(() => findTopStar(homeTeam.teamTricode, homeTeam.players), [homeTeam]);

    useInput((input, key) => {
        if (key.escape || input === 'd' || input === 'q') {
            onClose();
        }
    });

    if (!awayStar || !homeStar) {
        return (
            <Box borderStyle="single" borderColor="gray" paddingX={1}>
                <Text dimColor>No player stats available for duel showdown.</Text>
            </Box>
        );
    }

    const awayBg = TEAM_BG_COLORS[awayStar.teamTricode] || '#333';
    const awayText = TEAM_TEXT_COLORS[awayStar.teamTricode] || '#fff';
    const homeBg = TEAM_BG_COLORS[homeStar.teamTricode] || '#333';
    const homeText = TEAM_TEXT_COLORS[homeStar.teamTricode] || '#fff';

    const maxPts = Math.max(30, awayStar.points, homeStar.points);

    return (
        <Box flexDirection="column" borderStyle="double" borderColor="yellow" paddingX={2} paddingY={0} width={68}>
            {/* Header */}
            <Box justifyContent="space-between" marginBottom={1}>
                <Text bold color="yellow">⚡ SUPERSTAR DUEL SHOWDOWN ⚡</Text>
                <Text dimColor>[Esc/d to close]</Text>
            </Box>

            {/* Fighter Name Banners */}
            <Box justifyContent="space-between">
                <Box>
                    <Text backgroundColor={awayBg} color={awayText} bold>
                        {' '}#{awayStar.jerseyNum} {awayStar.name.toUpperCase()}{' '}
                    </Text>
                    <Text dimColor> ({awayStar.position})</Text>
                </Box>
                <Text bold color="red"> VS </Text>
                <Box>
                    <Text dimColor>({homeStar.position}) </Text>
                    <Text backgroundColor={homeBg} color={homeText} bold>
                        {' '}#{homeStar.jerseyNum} {homeStar.name.toUpperCase()}{' '}
                    </Text>
                </Box>
            </Box>

            {/* Momentum Health Bars */}
            <Box justifyContent="space-between" marginTop={1}>
                <Box>
                    <Text color="yellow" bold>{renderHealthBar(awayStar.points, maxPts)} </Text>
                    <Text bold color="white">{awayStar.points} PTS</Text>
                </Box>
                <Text color="yellow" bold>MOMENTUM</Text>
                <Box>
                    <Text bold color="white">{homeStar.points} PTS </Text>
                    <Text color="yellow" bold>{renderHealthBar(homeStar.points, maxPts)}</Text>
                </Box>
            </Box>

            {/* Head-to-Head Stat Comparison Rows */}
            <Box flexDirection="column" marginTop={1} borderStyle="single" borderColor="gray" paddingX={1}>
                {/* Rebounds */}
                <Box justifyContent="space-between">
                    <Text bold color={awayStar.rebounds >= homeStar.rebounds ? 'green' : 'white'}>
                        {awayStar.rebounds}
                    </Text>
                    <Text dimColor>REBOUNDS</Text>
                    <Text bold color={homeStar.rebounds >= awayStar.rebounds ? 'green' : 'white'}>
                        {homeStar.rebounds}
                    </Text>
                </Box>

                {/* Assists */}
                <Box justifyContent="space-between">
                    <Text bold color={awayStar.assists >= homeStar.assists ? 'green' : 'white'}>
                        {awayStar.assists}
                    </Text>
                    <Text dimColor>ASSISTS</Text>
                    <Text bold color={homeStar.assists >= awayStar.assists ? 'green' : 'white'}>
                        {homeStar.assists}
                    </Text>
                </Box>

                {/* Field Goals */}
                <Box justifyContent="space-between">
                    <Text bold color="white">
                        {awayStar.fgm}/{awayStar.fga} ({awayStar.fga > 0 ? Math.round((awayStar.fgm / awayStar.fga) * 100) : 0}%)
                    </Text>
                    <Text dimColor>FIELD GOALS</Text>
                    <Text bold color="white">
                        {homeStar.fgm}/{homeStar.fga} ({homeStar.fga > 0 ? Math.round((homeStar.fgm / homeStar.fga) * 100) : 0}%)
                    </Text>
                </Box>

                {/* 3-Pointers */}
                <Box justifyContent="space-between">
                    <Text bold color="white">
                        {awayStar.tpm}/{awayStar.tpa} ({awayStar.tpa > 0 ? Math.round((awayStar.tpm / awayStar.tpa) * 100) : 0}%)
                    </Text>
                    <Text dimColor>3-POINTERS</Text>
                    <Text bold color="white">
                        {homeStar.tpm}/{homeStar.tpa} ({homeStar.tpa > 0 ? Math.round((homeStar.tpm / homeStar.tpa) * 100) : 0}%)
                    </Text>
                </Box>

                {/* Steals + Blocks */}
                <Box justifyContent="space-between">
                    <Text bold color="white">{awayStar.steals} STL / {awayStar.blocks} BLK</Text>
                    <Text dimColor>DEFENSE</Text>
                    <Text bold color="white">{homeStar.steals} STL / {homeStar.blocks} BLK</Text>
                </Box>

                {/* Plus / Minus */}
                <Box justifyContent="space-between">
                    <Text bold color={awayStar.plusMinus >= 0 ? 'green' : 'red'}>
                        {awayStar.plusMinus >= 0 ? '+' : ''}{awayStar.plusMinus}
                    </Text>
                    <Text dimColor>PLUS / MINUS</Text>
                    <Text bold color={homeStar.plusMinus >= 0 ? 'green' : 'red'}>
                        {homeStar.plusMinus >= 0 ? '+' : ''}{homeStar.plusMinus}
                    </Text>
                </Box>
            </Box>

            {/* Bottom Callout */}
            <Box justifyContent="center" marginTop={1}>
                {awayStar.points > homeStar.points ? (
                    <Text color="cyan" bold>★ {awayStar.name} leads duel by {awayStar.points - homeStar.points} points</Text>
                ) : homeStar.points > awayStar.points ? (
                    <Text color="cyan" bold>★ {homeStar.name} leads duel by {homeStar.points - awayStar.points} points</Text>
                ) : (
                    <Text color="yellow" bold>★ Duel dead-even at {awayStar.points} points each</Text>
                )}
            </Box>
        </Box>
    );
}
