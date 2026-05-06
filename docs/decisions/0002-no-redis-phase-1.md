# 0002 — No Redis cache in Phase 1

**Status:** Accepted (2026-01)

## Context

The `/v1/resolve/:handle` and `/.well-known/atproto-did` endpoints will
be called frequently. A cache layer (Redis local or Upstash global) could
reduce DB load and serve responses faster.

## Decision

**No Redis in Phase 1. Add only when measured need exists.**

The endpoints query Postgres directly. Caching, if added later, would be
either local Redis (process-local, fast) or Upstash (global edge, persistent).

## Consequences

### Positive

- Fewer moving parts at launch — fewer things to monitor/operate
- No premature optimization — we don't pay (cognitive or operational) cost until we know the cost is justified
- Adding caching later is straightforward: wrap repository calls in a cache-aside pattern, ~50 lines of code

### Negative

- Every resolver request hits Postgres (acceptable for Phase 1 traffic)
- No global edge presence — users far from Nuremberg pay the network round-trip latency

### Threshold for revisiting

Add caching when ANY of:
- Resolver QPS sustained above ~50/sec
- Resolver p95 latency above 200ms (excluding network)
- Postgres CPU sustained above 30%
- Significant fraction of users outside the MENA/EU region complain about latency

## Alternatives considered

### Local Redis on the VPS

Rejected for Phase 1 because process-local maps in Node would serve a similar
purpose with no additional infrastructure if we needed in-memory caching at
all. Add if/when we move to multi-process pm2 cluster mode.

### Upstash Redis (global edge)

Rejected for Phase 1 because:
- Most users near MENA → close to Nuremberg → low latency anyway
- Adds a third-party dependency we'd rather avoid pre-launch
- Free tier is generous and we can add it in <1 day if needed
