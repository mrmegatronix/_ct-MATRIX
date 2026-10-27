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

## 3. Git Commit & Post-Scan Reporting Rules
*   **Post-Commit Links:** Conclude response with all active project links (Live Display, Admin Panel, Local Server, Repository, and GitHub Pages `https://mrmegatronix.github.io/<repo>/`) at the end whenever a commit or git push has been made.
*   **Post-Scan Dashboard Link:** Always display the direct link to the diagnostic dashboard (`file:///run/media/zeus/6TB-1/__GITHUB%20NUC/_ct-MATRIX/nikkos-d-check-reports/dashboard.html`) immediately after every diagnostic or security scan.
