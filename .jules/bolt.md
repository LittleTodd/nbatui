## 2024-05-23 - [Optimizing TUI Render Cycles]
**Learning:** In a React-based TUI (using `ink`), strict memoization is critical for performance. Even simple string dependencies like map background lines must be stable (memoized) to prevent cascading re-renders. Specifically, `Array.prototype.slice()` creates new references every render, invalidating downstream `useMemo` hooks.
**Action:** Always verify that the "static" inputs to `useMemo` (like configuration arrays or map data) are themselves stable or memoized, especially if they are derived in the render body.

## 2024-05-24 - [Avoid Map Reference Pitfalls in Memo]
**Learning:** When passing `Map` or `Set` objects as props, standard `React.memo` reference equality (`prev !== next`) is often insufficient because parent components might recreate these objects on every render (even if the content is largely identical). This causes cascading re-renders in list items.
**Action:** Implement granular `memo` comparison functions that iterate the relevant subset of data (e.g., checking only items belonging to a specific row) instead of relying on container reference equality. This is O(N) but prevents expensive TUI re-paints.
