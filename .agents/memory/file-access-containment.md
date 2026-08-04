---
name: File access containment
description: The security behavior used for trust-adaptive company file access.
---

Containment is user-scoped: a suspicious file access decision can set that user to compromised, deny future file access, and sever the user’s reachable user/device/application/asset trust paths without initiating a global lockdown.

**Why:** File-level anomalies should stop the offending identity immediately while avoiding unnecessary disruption to unrelated operators and services.

**How to apply:** Preserve the user-specific containment record and trust-path severing behavior when extending file IAM, anomaly response, or reset flows.

The trust graph baseline must contain only active paths and NORMAL nodes; historical severance and compromised/degraded graph states are restored only by an explicit attack or policy violation.

**Why:** The simulator should represent a legitimate corporate environment before an attack, rather than displaying inherited incident state at startup or after reset.

**How to apply:** Reset must rebuild the graph and clear containment state while preserving audit history; attack flows may then introduce penalties, compromise, and path severance.