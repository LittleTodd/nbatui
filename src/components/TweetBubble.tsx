import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';

interface TweetBubbleProps {
    tweets: string[];
    visible: boolean;
}

export const TweetBubble = ({ tweets, visible }: TweetBubbleProps) => {
    const [index, setIndex] = useState(0);

    useEffect(() => {
        if (!visible) return;
        const interval = setInterval(() => {
            setIndex((prev) => (prev + 1) % tweets.length);
        }, 8000); // Rotate every 8s
        return () => clearInterval(interval);
    }, [visible, tweets.length]);

    if (!visible || tweets.length === 0) return null;

    const currentTweet = tweets[index];

    return (
        <Box
            position="absolute"
            marginTop={-4}
            marginLeft={24}
            borderStyle="round"
            borderColor="yellow"
            paddingX={1}
            width={30}
            flexDirection="column"
        >
            <Text color="yellow" bold>🔥 Heat Check</Text>
            <Text italic>"{currentTweet}"</Text>
            <Box marginTop={0} justifyContent="flex-end">
                <Text dimColor>via r/nba</Text>
            </Box>
        </Box>
    );
};
