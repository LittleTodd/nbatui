# Palette Journal

## 2024-05-21 - TUI Accessibility & Feedback
**Learning:** In a TUI, visual focus indicators like cursors or highlighting are critical but often insufficient for clarity. Users need explicit text instructions because they cannot rely on standard web conventions (like placeholder text in an input field being obvious).
**Action:** When implementing interactive inputs (like search) in Ink, always provide:
1.  Contextual help (what to type).
2.  Feedback on the state (active/inactive).
3.  Feedback on results (e.g., "0 matches") directly near the input.
