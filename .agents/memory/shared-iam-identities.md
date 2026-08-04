---
name: Shared IAM identities
description: The canonical user source used across BlackBox identity selectors, trust views, and file access.
---

All user-facing identity lists must derive from the Enterprise Access Manager profile registry and its corresponding trust-node scores. Do not maintain a separate legacy user catalog for simulation or dashboard selectors.

**Why:** Separate user sources caused the attacker simulator and Access Manager to show different departments, users, and trust values.

**How to apply:** When adding a user, role, selector, trust display, or simulation target, read the shared profile data and overlay current trust state; simulation trust changes must broadcast completion and refresh all identity consumers.

Guest (`attacker`) is intentionally seeded at trust 100 with NORMAL/TRUSTED status and active trust edges to every other graph node. The graph seeding path must preserve or restore those connections for existing databases.

**Why:** Guest is the canonical external identity shown in the requested reference user list, and the dashboard scenario requires it to begin as fully trusted and fully connected.

**How to apply:** Keep the Guest baseline aligned across in-memory state, user profiles, trust nodes, trust edges, and graph reset/startup migrations.