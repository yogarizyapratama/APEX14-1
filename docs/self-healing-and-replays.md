# Incident Replay & Self-Healing Telemetry (`heal`)

Production exceptions are notoriously difficult to reproduce locally without exact request headers, URL parameters, and state snapshots. APEX14 includes an automated crash-telemetry and replay system with AI remediation assistance.

---

## 1. Enabling Telemetry

```ts
import { heal } from "apex14";

heal.configure({
  enabled: true,
  replayCapture: true, // Captures request payload, headers, and params on 500 exceptions
  anonymize: ["authorization", "password", "token", "cookie", "credit_card"],
  maxIncidents: 100,
  onIncident: (incident) => {
    console.error(`[INCIDENT CAPTURED]: ${incident.id} on ${incident.method} ${incident.url}`);
  }
});
```

---

## 2. Automated AI Fix Prompt

Whenever an unhandled exception occurs, `heal` automatically formats a structured remediation prompt containing:
- The exact route and method.
- Sanitized input payload.
- Error name, message, and top stack traces.
- Prescribed architectural guidelines to resolve the bug.

---

## 3. APEX14 Studio: Incident Replay Lab

Navigate to `/_studio` and click on **Incident Replay Lab**:
1. Inspect live telemetry of crashes.
2. View error stack traces and anonymized payloads.
3. Click **"Replay Request"** to immediately dispatch the identical HTTP request in development mode and verify fixes.
4. Copy the auto-generated AI diagnosis prompt directly into Gemini or Claude for an instant code patch.

---

## 4. Programmatic Replay

```ts
import { heal } from "apex14";

const result = await heal.replay("inc_1731678900_abc");
console.log("Replay status:", result.status);
```
