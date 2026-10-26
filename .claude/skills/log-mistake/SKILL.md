---
name: log-mistake
description: Draft a BUILD_LOG.md entry for a real mistake found during the build, for me to check and edit.
argument-hint: "[short description of what went wrong]"
disable-model-invocation: true
---

Draft a BUILD_LOG entry for this: $ARGUMENTS

Rules:

- Only describe what actually happened in this session. If you don't know a detail (for example how I noticed it), leave `[fill in]` instead of inventing it.
- Keep it short and plain. No blame, no drama.

Append this to the end of `BUILD_LOG.md`:

```markdown
## YYYY-MM-DD, Phase N: <short title>

- **What the AI did:**
- **What went wrong:**
- **How it was caught:** (test, Inspector, hook, reviewer subagent, manual check)
- **Fix:**
- **Rule or test added so it can't happen again:**
```

Then show me the entry and remind me to read and correct it before committing.
