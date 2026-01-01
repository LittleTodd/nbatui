## 2024-05-23 - [Optimizing TUI Render Cycles]
**Learning:** In a React-based TUI (using `ink`), strict memoization is critical for performance. Even simple string dependencies like map background lines must be stable (memoized) to prevent cascading re-renders. Specifically, `Array.prototype.slice()` creates new references every render, invalidating downstream `useMemo` hooks.
**Action:** Always verify that the "static" inputs to `useMemo` (like configuration arrays or map data) are themselves stable or memoized, especially if they are derived in the render body.
