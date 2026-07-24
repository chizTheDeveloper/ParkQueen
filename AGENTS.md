# ParQueen Agent Instructions

## Mission and product language

ParQueen is a premium, dark-first street-parking utility that begins in New York City and is designed to expand globally. Help drivers find and exchange street-parking opportunities quickly while protecting user privacy.

Use the product terms exactly:

- Ping / Pings
- Ping Your Spot
- My Car
- Nearby Activity
- Crowns
- Parsona (the privacy-focused public avatar identity)

## Stack and architecture

- React 18 and TypeScript, built with Vite
- Firebase Auth, Firestore, Cloud Functions, Hosting, Storage, and Cloud Messaging
- Mapbox GL JS
- English and Spanish localization
- React local state and existing custom hooks; no router library

Preserve the existing architecture unless a demonstrated defect or an approved requirement justifies changing it. Prefer focused changes over unrelated refactors.

## Git and collaboration safety

1. Before editing, run `git status --short`, `git branch --show-current`, `git log --oneline -10`, `git diff --stat`, and `git diff`.
2. Read `HANDOFF.md` before beginning work.
3. Treat every existing tracked or untracked change as another agent's work. Never reset, discard, overwrite, stash, or clean it without explicit approval.
4. Pull the latest approved branch state with a fast-forward-only pull before implementation when safe.
5. Never modify or merge into `main` directly.
6. Never force push.
7. Do not let multiple agents edit the same working tree simultaneously.
8. Implement one coherent milestone, verify it, update `HANDOFF.md`, then commit and push the feature branch.
9. Stage only files belonging to the current milestone. Do not include unrelated user or agent work.

## Deployment and secrets

- Never deploy Firebase Hosting, Functions, Firestore Rules, Storage Rules, indexes, or any other production resource without explicit user approval.
- Never expose, copy, rotate, or modify secrets.
- Do not commit `.env` values, tokens, credentials, or private user data.

## Product quality

- User-facing features require complete English and Spanish copy in the same milestone.
- Meet WCAG 2.1 AA expectations: keyboard access, visible focus, semantic controls, screen-reader labels, sufficient contrast, reduced-motion consideration, and touch targets of at least 44 by 44 CSS pixels where practical.
- Treat precise location, phone numbers, account data, and Parsona identity as sensitive. Minimize collection and public exposure.
- Any Firestore shape or access change must apply least privilege, validate allowed fields and types, protect server-owned fields, and include Rules tests for allowed and denied cases.
- Maintain the premium visual direction: dark-first, restrained, mature, editorial, accessible, and legible at mobile sizes. Avoid generic clip art, childish styling, visual noise, and novelty interactions.

## Required verification

Run every applicable gate before claiming completion:

```text
npx tsc --noEmit
npm test
npm run build
npm run test:rules
```

On Windows, use `npx.cmd` or `npm.cmd` if PowerShell script execution blocks the `.ps1` shims.

Known baseline totals as of 2026-07-23:

- Unit tests: 701
- Firestore Rules tests: 86

If a gate is not applicable or cannot run, document the exact reason in `HANDOFF.md` and the final report. Do not describe work as passing without fresh command output.

## Final report format

Report:

1. Branch and final HEAD
2. Initial and final working-tree state
3. Files changed and the user-visible or architectural effect
4. Existing uncommitted work preserved
5. Quality-gate commands and results, including test totals and warnings
6. Commit hash and push result
7. Deployment status and confirmation that `main` was untouched
8. Blockers, limitations, and the exact recommended next milestone
