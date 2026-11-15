# Deterministic Time-Warp Flight Recorder (`replay`)

Intermittent production bugs, race conditions, and integration failures are notoriously difficult to reproduce in local environments. APEX14 includes an automated in-flight request recording and playback engine.

---

## 1. Recording Live Requests

Attach `replay.record()` to your critical or error-prone routes:

```ts
import { replay, route } from "apex14";

route("/api/checkout", handleCheckout, {
  method: "POST",
  middleware: [
    replay.record({
      sampleRate: 0.1, // Sample 10% of traffic
      recordOnError: true, // Always record when status >= 400 or exception occurs
      maskHeaders: ["authorization", "cookie", "x-api-key"] // Security scrubbing
    })
  ]
});
```

---

## 2. Replaying Cassettes Locally

When an incident occurs, inspect the recorded cassette and replay it with 100% determinism:

```ts
import { replay } from "apex14";

// Retrieve recent cassette
const tapes = replay.allTapes();
const lastError = tapes[tapes.length - 1];

// Playback against local router
const playbackResult = await replay.playback(lastError);
console.log(playbackResult.status, playbackResult.body);
```

---

## 3. Export & Import Cassettes

```ts
// Export cassette to JSON string (attach to bug report or Sentry)
const json = replay.export(lastError.id);

// Load on another machine for debugging
const tape = replay.import(json);
await replay.playback(tape);
```
