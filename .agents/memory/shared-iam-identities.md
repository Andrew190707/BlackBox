---
name: Shared IAM identities
description: The canonical user source used across BlackBox identity selectors, trust views, and file access.
---

All user-facing identity lists must derive from the Enterprise Access Manager profile registry and its corresponding trust-node scores. Do not maintain a separate legacy user catalog for simulation or dashboard selectors.

**Why:** Separate user sources caused the attacker simulator and Access Manager to show different departments, users, and trust values.

**How to apply:** When adding a user, role, selector, trust display, or simulation target, read the shared profile data and overlay current trust state; simulation trust changes must broadcast completion and refresh all identity consumers.

Guest is a normal trusted identity at baseline; the internal `attacker` ID maps to Guest but starts at trust 100 and risk state NORMAL. Attack simulations may still apply temporary severity penalties.

**Why:** Guest is a visible canonical user, not a pre-compromised baseline identity; starting Guest compromised made the trust dashboard inconsistent with the user profile.

**How to apply:** Preserve this baseline across seed data, reset state, trust-graph initialization, and profile status. Apply attack penalties only when a simulation explicitly targets Guest.