---
name: start-phase
description: Start one phase of the TaskDesk build plan. Reads the plan, proposes the work, and waits for approval before writing code.
argument-hint: "[phase-number]"
disable-model-invocation: true
---

Start Phase $ARGUMENTS of the TaskDesk build.

1. Read `CLAUDE.md`, `docs/PLAN.md`, `docs/ARCHITECTURE.md` and `docs/DECISIONS.md`.
2. Run `git status` and check that earlier phases are committed. If not, tell me and stop.
3. If this phase uses the MCP SDK or another library, check the installed version in `package.json` and `node_modules`, and name the exact functions you will use and where they are defined. If you can't find one, say so.
4. Write a short plan:
   - Files you will create or change
   - The key design choice in this phase, and why
   - How you will test it (automated tests and the manual Check steps from the plan)
   - Anything unclear that I should decide
5. Stop and wait for my OK. Do not write any files yet.

After I approve, build the phase, run `npm run typecheck`, `npm run lint` and `npm test`, then give me:

- Changed files
- Test results
- The manual Check steps for me to run
- Anything you were unsure about or got wrong along the way
