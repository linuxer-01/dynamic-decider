# Dynamic Event Judging & Score Management

A two-portal web app: an Admin control center and a lightweight Judge portal. Every event is fully self-contained — its judges, participants, criteria, scores and device bindings live and die with the event.

## Backend

Lovable Cloud (database + server logic) powers everything, so scores sync live across judge devices.

Tables (all child rows cascade-delete with the event):
- `events` — name, date, venue, description, join code, status (setup / live / completed), tie mode
- `judges` — event_id, name, code label, device binding (device token, approved flag)
- `participants` — event_id, name, optional details, display order
- `criteria` — event_id, name, max marks, display order
- `scores` — event_id, judge_id, participant_id, criterion_id, value, submitted_at (unique per judge+participant+criterion)

Access model:
- Admin: one shared password stored as a server secret; login is verified in a server function that issues a signed admin session cookie. The password is never in client code.
- Judges: no accounts. A judge device holds a random device token; all judge reads/writes go through server functions that validate event code + judge + approved device token. Rows are not exposed directly to the browser.
- Score validation is enforced server-side (0 ≤ value ≤ criterion max) as well as in the form.

## Admin Portal

- Login screen (shared password).
- Events list: create event, see status/progress, open, delete.
- Event dashboard tabs:
  - **Details** — name, date, venue, description, join code (with copy/QR).
  - **Judges** — add/rename/remove judges; live list of pending device requests with Approve / Reject / Reset device.
  - **Participants** — add, edit, remove, reorder.
  - **Mark sheet** — dynamic criteria: add, rename, set max marks, reorder, delete; live "Maximum Score = N" total.
  - **Progress** — matrix of judge × participant showing submitted / pending, counts of completed vs pending evaluations.
  - **Results** — per-judge totals, participant final score (average of judges' totals), ranking with Top 3 highlighted; joint position on exact ties.
  - **Complete Event** — confirmation, then locks all judge editing.
  - **Export** — Download PDF and Print (A4-formatted result sheet: event info, judges, per-criterion participant scores, final scores, full ranking, winners podium).
  - **Delete Event** — strong confirmation dialog listing everything removed; requires typing the event name.

## Judge Portal

- Enter event code → pick your name from that event's judges → device registers and shows "Waiting for admin approval".
- If the device is already bound to a different judge in that event: blocked with "This device is already assigned to another judge. Please contact the Admin."
- Once approved: dashboard showing event name, judge name, participant list with Pending / Submitted status.
- Select a participant → dynamic form with one input per criterion (clamped 0–max), live running total, Submit Score. Re-opening a submitted participant allows edit until the event is completed; duplicate submits are prevented by the unique constraint.
- After completion, the portal is read-only.

## Design

Dark, high-contrast "control room" look built for projector/tablet use during live events: large tap targets, tabular numerals for scores, gold/silver/bronze accents reserved for the podium, and a clean light theme for the printable PDF. All colors as semantic tokens.

## Technical notes

- TanStack Start routes: `/` (admin login/events), `/event/$eventId/*` admin tabs, `/judge` and `/judge/$eventId` judge portal.
- Server functions for every privileged operation; judge device token in localStorage, validated server-side each call.
- PDF via a print-optimized route plus browser print-to-PDF, giving identical Download and Print output.
- Polling/realtime refresh on the admin progress and results views.

## Build order

1. Enable Cloud, create schema + policies.
2. Admin auth + events list/create/delete.
3. Event dashboard: judges, participants, criteria.
4. Judge portal: code entry, device binding, approval flow.
5. Scoring form + validation + progress view.
6. Results, ranking, ties, completion lock.
7. PDF/print sheet and final polish.
