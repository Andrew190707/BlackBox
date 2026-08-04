---
name: Workspace dependency overrides
description: Dependency remediation constraints for this pnpm workspace.
---

Keep each package override unique in `pnpm-workspace.yaml`; duplicate keys are rejected by pnpm and prevent lockfile regeneration.

**Why:** The workspace already contains platform-specific and historical overrides, so adding a second rule for a package can fail before dependency resolution begins.

**How to apply:** Search the full override map before adding a security pin, and replace an existing stale rule rather than appending a duplicate.