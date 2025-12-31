/**
 * GameCard Component
 * Displays a single NBA game with scores and status
 */
import type { Game } from '../services/apiClient';
import { getGameStatusInfo } from '../services/apiClient';
import { getTeamColors } from '../data/teamColors';
import { HeatIndicator, type HeatLevel } from './HeatIndicator';

export interface HeatData {
    level: HeatLevel;
    count: number;
}

interface GameCardProps {
    game: Game;
    isSelected?: boolean;
    compact?: boolean;
    heat?: HeatData;
}

export function GameCard({ game, isSelected = false, compact = false, heat }: GameCardProps) {
    const { text: statusText, isLive, isFinal } = getGameStatusInfo(game);

    // Determine border color based on state and heat
    const getBorderColor = () => {
        if (isSelected) return 'cyan';

        // High heat overrides standard colors (except selected)
        if (heat?.level === 'fire') return 'red';
        if (heat?.level === 'hot') return 'orange';

        if (isLive) return 'green';
        if (isFinal) return 'gray';
        return 'white';
    };

    if (compact) {
        // Compact mode for smaller terminals
        return (
            <box
                borderStyle="round"
                borderColor={getBorderColor()}
                paddingX={1}
            >
                <text>
                    <b>{game.awayTeam.teamTricode}</b>
                    <span> {game.awayTeam.score}</span>
                    <span dimColor> @ </span>
                    <b>{game.homeTeam.teamTricode}</b>
                    <span> {game.homeTeam.score}</span>
                    <span dimColor> {statusText}</span>
                    {heat && heat.level !== 'cold' && (
                        <HeatIndicator level={heat.level} count={heat.count} compact={true} />
                    )}
                </text>
            </box>
        );
    }

    return (
        <box
            flexDirection="column"
            borderStyle="round"
            borderColor={getBorderColor()}
            paddingX={1}
            minWidth={20}
        >
            {/* Status bar */}
            <box justifyContent="center">
                <text
                    color={isLive ? 'green' : (isFinal ? 'gray' : 'yellow')}
                    bold={isLive}
                >
                    {isLive ? '● LIVE ' : ''}{statusText}
                </text>
                {heat && (
                    <box marginLeft={1}>
                        <HeatIndicator level={heat.level} count={heat.count} />
                    </box>
                )}
            </box>

            {/* Away team */}
            <box justifyContent="space-between">
                <text bold>{game.awayTeam.teamTricode}</text>
                <text bold>{game.awayTeam.score}</text>
            </box>

            {/* Home team */}
            <box justifyContent="space-between">
                <text bold>{game.homeTeam.teamTricode}</text>
                <text bold>{game.homeTeam.score}</text>
            </box>

            {/* City names */}
            <box justifyContent="center">
                <text dimColor>
                    {game.awayTeam.teamCity} @ {game.homeTeam.teamCity}
                </text>
            </box>
        </box>
    );
}
