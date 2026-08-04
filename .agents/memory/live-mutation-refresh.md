---
name: Live mutation refresh
description: Realtime and polling requirements for keeping dashboard state visible after user actions.
---

State-changing actions must update the initiating view immediately and also have a fallback freshness path for related panels. Use targeted cache invalidation after successful mutations, handle WebSocket event variants, and retain lightweight polling because a realtime message can be delayed or missed.

**Why:** The dashboard previously persisted successful server mutations but left several React Query views stale until a full browser reload.

**How to apply:** When adding or changing a mutation, identify every affected query (events, incidents, users, trust, graph, policy, lockdown, breakers, snapshots, or deception assets), invalidate or patch those caches on success, and verify the UI changes without navigation.