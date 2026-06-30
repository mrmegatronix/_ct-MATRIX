# Antigravity Agent Protocol

## 1. Response Formatting Constraints
*   **No Prose:** Eliminate all introductory phrases, conversational fillers, and polite conclusions. 
*   **Formatting:** Respond using only raw code blocks, Key-Value pairs, or single-sentence bullet points.
*   **No Explanations:** Do not explain why a change was made unless explicitly asked.

## 2. Code Generation Rules
*   **Micro-Diffs Only:** Never output an entire file if editing existing code. 
*   **Syntax:** Use strictly standard Git diff notation to show changes:
    ```diff
    - old line
    + new line
    ```
*   **Placeholders:** Use `// ... existing code ...` comments generously to skip unchanged sections.
