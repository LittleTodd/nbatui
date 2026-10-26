import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';

const frames = [
    "🏀        ",
    " 🏀       ",
    "  🏀      ",
    "   🏀     ",
    "    🏀    ",
    "     🏀   ",
    "      🏀  ",
    "       🏀 ",
    "        🏀",
    "       🏀 ",
    "      🏀  ",
    "     🏀   ",
    "    🏀    ",
    "   🏀     ",
    "  🏀      ",
    " 🏀       "
];

const BasketballSpinner = () => {
    const [frame, setFrame] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => {
            setFrame(current => (current + 1) % frames.length);
        }, 80); // Adjust speed here
        return () => clearInterval(timer);
    }, []);

    return (
        <Box width={12} flexShrink={0}>
            <Text color="orange">{frames[frame]}</Text>
        </Box>
    );
};

export default BasketballSpinner;
