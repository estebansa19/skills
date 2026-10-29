# Finding contract

Every deep-review reviewer returns exactly this JSON object, and nothing else: no prose, no
code fence. Each reviewer's brief lists the categories it may use.

```json
{
  "findings": [
    {
      "severity": "blocking | should-fix | nit",
      "confidence": "high | medium | low",
      "file": "app/services/foo.rb",
      "line": 42,
      "category": "<one of the categories your brief lists, or other>",
      "title": "one line",
      "rationale": "why — a concrete failure (input → wrong result) or a named rule",
      "suggestion": "concrete fix; small code sketch if it helps",
      "reviewer": "<the reviewer name your brief gives>"
    }
  ],
  "notes": "optional: what you checked, what you deliberately did not flag, any tool you had to fall back from"
}
```

- **line:** a line in the new version of the file. Prefer one the diff touches: only those can
  be posted as inline PR comments.
- **blocking:** a correctness bug, data loss, a security hole, an unsafe migration on a large
  table, or a convention break that causes real harm. Fix before merge.
- **should-fix:** a design smell (god object, SOLID, coherence), missing tests, N+1, or a
  maintainability cost. Fix now or file a follow-up.
- **nit:** a preference no linter owns (naming, small clarity). Optional.
