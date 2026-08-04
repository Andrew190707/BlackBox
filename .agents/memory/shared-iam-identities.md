---
name: Shared IAM identities
description: The canonical user source used across BlackBox identity selectors, trust views, and file access.
---

All user-facing identity lists must derive from the Enterprise Access Manager profile registry and its corresponding trust-node scores. Do not maintain a separate legacy user catalog for simulation or dashboard selectors.

**Why:** Separate user sources caused the attacker simulator and Access Manager to show different departments, users, and trust values.

**How to apply:** When adding a user, role, selector, trust display, or simulation target, read the shared profile data and overlay current trust state; simulation trust changes must broadcast completion and refresh all identity consumers.