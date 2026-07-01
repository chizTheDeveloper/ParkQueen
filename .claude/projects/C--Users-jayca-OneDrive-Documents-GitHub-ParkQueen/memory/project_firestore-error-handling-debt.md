---
name: firestore-error-handling-debt
description: Systemic lack of try/catch and atomic writes across all Firestore handlers — needs a single refactor pass
metadata:
  type: project
---

Every Firestore write handler in `useInterestFlow.ts` (and elsewhere) follows the same pattern: bare `await addDoc`/`updateDoc` with no try/catch, no user-facing error state, no rollback on multi-step writes. This is now systemic across: handleExpressInterest, handleCancelByFinder, handleCancelByClaimer, handleDelayByFinder, handleArrival, handleHandoffOutcome, handleFailureReason, handleDeparturePing.

Multi-step writes (e.g., handleHandoffOutcome writes spotFeedback then spotNotifications) are non-atomic — partial failure leaves inconsistent state with no recovery path.

**Why:** As the app grows, debugging network-related failures will be expensive because the failure surface is spread across many unguarded calls with no logging. The pattern has been copied to every new handler since the codebase began.

**How to apply:** When this gets prioritized, do it as a single refactor pass — not piecemeal per handler. Likely approach: a small wrapper (`safeWrite` or similar) that handles try/catch, surfaces errors to UI via a shared error toast, and optionally uses `writeBatch` for multi-doc operations. Touch every handler once, in one PR. Related: [[spot-vs-ping-modeling]] (more writes = more failure surface).
