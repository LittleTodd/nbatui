/**
 * GameCard Component
 * Displays a single NBA game with scores and status
 */
import type { Game } from '../services/apiClient';
import { getGameStatusInfo } from '../services/apiClient';
import { getTeamColors } from '../data/teamColors';

interface GameCardProps {
    game: Game;
    isSelected?: boolean;
    compact?: boolean;
}

export function GameCard({ game, isSelected = false, compact = false }: GameCardProps) {
    const { text: statusText, isLive, isFinal } = getGameStatusInfo(game);

    // Determine border color based on state
    const getBorderColor = () => {
        if (isSelected) return 'cyan';
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
