---
name: File access containment
description: The security behavior used for trust-adaptive company file access.
---

Containment is user-scoped: a suspicious file access decision can set that user to compromised, deny future file access, and sever the user’s reachable user/device/application/asset trust paths without initiating a global lockdown.

**Why:** File-level anomalies should stop the offending identity immediately while avoiding unnecessary disruption to unrelated operators and services.

**How to apply:** Preserve the user-specific containment record and trust-path severing behavior when extending file IAM, anomaly response, or reset flows.