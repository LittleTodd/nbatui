/**
 * ClutchTicker Component
 * Autonomous Live Game Leverage Engine & Heartbeat Ticker
 * 
 * Detects crunch-time / clutch games and renders an EKG heartbeat ticker.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { Box, Text } from 'ink';
import type { Game } from '../services/apiClient.js';
import { setTerminalTitle } from '../utils/terminalTitle.js';

interface ClutchTickerProps {
    games: Game[];
    onSelectGame?: (gameIndex: number) => void;
}

interface ClutchEvaluation {
    game: Game;
    index: number;
    scoreDiff: number;
    leverageScore: number; // 0-100
    isCrunchTime: boolean;
}

function parseClockMinutes(clockStr: string): number {
    if (!clockStr) return 12.0;
    const match = clockStr.match(/PT(\d+)M([\d.]+)S/);
    if (!match) return 12.0;
    const mins = parseFloat(match[1] || '0');
    const secs = parseFloat(match[2] || '0');
    return mins + secs / 60.0;
}

export function evaluateGameClutch(game: Game, index: number): ClutchEvaluation {
    // Only in-progress games have clutch leverage
    if (game.gameStatus !== 2) {
        return { game, index, scoreDiff: 99, leverageScore: 0, isCrunchTime: false };
    }

    const awayScore = game.awayTeam?.score || 0;
    const homeScore = game.homeTeam?.score || 0;
    const scoreDiff = Math.abs(awayScore - homeScore);
    const period = game.period || 1;
    const minutesRemaining = parseClockMinutes(game.gameClock);

    let leverage = 0;

    // Period factor
    if (period >= 5) {
        leverage += 60; // Overtime
    } else if (period === 4) {
        leverage += 40;
    } else if (period === 3) {
        leverage += 15;
    }

    // Score differential factor
    if (scoreDiff === 0) leverage += 35;
    else if (scoreDiff <= 2) leverage += 30;
    else if (scoreDiff <= 4) leverage += 22;
    else if (scoreDiff <= 7) leverage += 14;
    else if (scoreDiff <= 10) leverage += 5;

    // Time factor in 4th Quarter or OT
    if (period >= 4) {
        if (minutesRemaining <= 1.0) leverage += 25;
        else if (minutesRemaining <= 2.5) leverage += 18;
        else if (minutesRemaining <= 5.0) leverage += 10;
    }

    const finalLeverage = Math.min(100, leverage);
    const isCrunchTime = period >= 4 && scoreDiff <= 5 && minutesRemaining <= 5.0;

    return {
        game,
        index,
        scoreDiff,
        leverageScore: finalLeverage,
        isCrunchTime
    };
}

const EKG_FRAMES = [
    '♥ ──/\\_/\_──/\\/\\___',
    '♥ ─/\\_/\_──/\\/\\____',
    '♥ /\\_/\_──/\\/\\_____',
    '♥ \\_/\_──/\\/\\______',
    '♥ _/\_──/\\/\\───────',
    '♥ /\_──/\\/\\────────'
];

export function ClutchTicker({ games }: ClutchTickerProps) {
    const [frameIndex, setFrameIndex] = useState(0);

    // Find the single highest-leverage game right now
    const topClutch = useMemo<ClutchEvaluation | null>(() => {
        let best: ClutchEvaluation | null = null;
        for (let idx = 0; idx < games.length; idx++) {
            const game = games[idx];
            if (!game) continue;
            const ev = evaluateGameClutch(game, idx);
            if (!best || ev.leverageScore > best.leverageScore) {
                best = ev;
            }
        }
        if (best && best.leverageScore >= 60) {
            return best;
        }
        return null;
    }, [games]);

    // Animate EKG heartbeat
    useEffect(() => {
        if (!topClutch) return;
        const speed = topClutch.leverageScore >= 85 ? 180 : 320;
        const timer = setInterval(() => {
            setFrameIndex(f => (f + 1) % EKG_FRAMES.length);
        }, speed);
        return () => clearInterval(timer);
    }, [topClutch]);

    // Update Terminal Tab/Window Title
    useEffect(() => {
        if (topClutch) {
            const g = topClutch.game;
            const periodStr = g.period > 4 ? `OT${g.period - 4}` : `Q${g.period}`;
            const clockClean = g.gameClock?.replace('PT', '').replace('S', '') || '';
            setTerminalTitle(`🏀 ${g.awayTeam.teamTricode} ${g.awayTeam.score}-${g.homeTeam.score} ${g.homeTeam.teamTricode} (${periodStr} ${clockClean})`);
        } else {
            const liveGames = games.filter(g => g.gameStatus === 2);
            if (liveGames.length > 0) {
                setTerminalTitle(`🏀 NBA-TUI (${liveGames.length} Live Games)`);
            } else {
                setTerminalTitle(`🏀 NBA-TUI (Terminal NBA Viewer)`);
            }
        }
    }, [topClutch, games]);

    if (!topClutch) return null;

    const g = topClutch.game;
    const periodStr = g.period > 4 ? `OT${g.period - 4}` : `Q${g.period}`;
    const clockClean = g.gameClock?.replace('PT', '').replace('S', '') || '';

    return (
        <Box
            borderStyle="single"
            borderColor={topClutch.leverageScore >= 85 ? 'red' : 'yellow'}
            paddingX={1}
            justifyContent="space-between"
            width="100%"
            marginBottom={0}
        >
            <Box>
                <Text color="red" bold>{EKG_FRAMES[frameIndex]} </Text>
                <Text bold color="white">
                    {g.awayTeam.teamTricode} {g.awayTeam.score} - {g.homeTeam.score} {g.homeTeam.teamTricode}
                </Text>
                <Text color="cyan"> [{periodStr} {clockClean}] </Text>
                <Text color="yellow">Diff: {topClutch.scoreDiff} pts</Text>
            </Box>
            <Box>
                <Text bold backgroundColor={topClutch.leverageScore >= 85 ? 'red' : 'yellow'} color="black">
                    {' '}CLUTCH INDEX: {topClutch.leverageScore}%{' '}
                </Text>
            </Box>
        </Box>
    );
}
