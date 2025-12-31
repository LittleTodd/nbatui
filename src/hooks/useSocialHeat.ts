import { useState, useEffect } from 'react';
import type { Game } from '../services/apiClient.js';

export interface HeatData {
    level: 'hot' | 'warm' | 'cold';
    tweets: string[];
}

const MOCK_TWEETS_HOT = [
    "ARE YOU KIDDING ME?!",
    "This game is absolutely insane rn",
    "CLUTCH gene activated 🧬",
    "My heart can't take this OT",
    "DEFENSE!!!",
    "Cooked him.",
    "LMAO what was that shot??",
    "MVP MVP MVP"
];

const MOCK_TWEETS_WARM = [
    "Good run here",
    "Need a timeout coach",
    "Refs are blind smh",
    "Solid defense",
    "Momentum shift..."
];

/**
 * Hook to get social heat data for games
 * Currently simulates data based on score difference
 */
export const useSocialHeat = (games: Game[]) => {
    const [heatMap, setHeatMap] = useState<Record<string, HeatData>>({});

    useEffect(() => {
        if (!games.length) return;

        const generateHeat = () => {
            const newHeat: Record<string, HeatData> = {};

            games.forEach(game => {
                if (game.gameStatus !== 2) return; // Only live games get heat logic

                // Parse scores
                const scoreA = parseInt(game.awayTeam.score);
                const scoreH = parseInt(game.homeTeam.score);
                if (isNaN(scoreA) || isNaN(scoreH)) return;

                const diff = Math.abs(scoreA - scoreH);

                // Logic: Close game = Hot
                if (diff <= 5) {
                    newHeat[game.gameId] = {
                        level: 'hot',
                        tweets: MOCK_TWEETS_HOT.sort(() => 0.5 - Math.random()).slice(0, 3)
                    };
                } else if (diff <= 10) {
                    newHeat[game.gameId] = {
                        level: 'warm',
                        tweets: MOCK_TWEETS_WARM.sort(() => 0.5 - Math.random()).slice(0, 2)
                    };
                } else {
                    newHeat[game.gameId] = { level: 'cold', tweets: [] };
                }
            });

            // Randomly force one game strictly for demo purposes if no hot games
            const hotGames = Object.values(newHeat).filter(h => h.level === 'hot');
            if (hotGames.length === 0 && games.length > 0) {
                // Pick random game to be hot for demo visual
                const randomGame = games[Math.floor(Math.random() * games.length)];
                newHeat[randomGame.gameId] = {
                    level: 'hot',
                    tweets: MOCK_TWEETS_HOT.sort(() => 0.5 - Math.random()).slice(0, 3)
                };
            }

            setHeatMap(newHeat);
        };

        // Update heat every 10s
        generateHeat();
        const interval = setInterval(generateHeat, 10000);
        return () => clearInterval(interval);

    }, [games]);

    return heatMap;
};
