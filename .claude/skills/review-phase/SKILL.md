---
name: review-phase
description: Review the current phase before committing. Runs checks, the review checklist, and the independent code-reviewer subagent.
disable-model-invocation: true
---

Review the uncommitted changes before I commit.

1. Run `npm run typecheck`, `npm run lint` and `npm test`. Report pass or fail for each.
2. Go through the review checklist in `CLAUDE.md` item by item. For each one write pass, fail or not relevant, with a reason.
3. Ask the `code-reviewer` subagent to review the diff. If this phase touched config, audit, redaction, delete or HTTP code, also ask the `security-reviewer` subagent.
4. Combine the results into one list:
   - **Blocking** (must fix now)
   - **Should fix**
   - **Fine as is**
5. List any mistakes made during this phase (by you or found by the reviewers) so I can decide whether to record them with `/log-mistake`.
6. Suggest a commit message in this form: `phase N: short summary` and one line on why.

Do not commit and do not fix anything unless I ask.
