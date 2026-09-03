# Event Score Master

Absolutely — here is the complete, structured version with the event-specific judge system included.

Dynamic Event Judging & Score Management Website

1. Project Overview

Build a web-based judging and score management system designed for competitions, exhibitions, project presentations, quizzes, and similar events.

The system will have two separate portals:

1. Admin Portal

2. Judge Portal

The main purpose is to allow multiple judges to evaluate participants using a dynamic mark sheet, automatically calculate the final scores, rank all participants, and clearly separate the Top 3 from the remaining participants.

Each event must be completely independent. Judges, participants, marking criteria, scores, and other event data belong only to that particular event.

---

2. Admin Portal

The Admin Portal is the main control center of the system.

The Admin can:

- Create events

- Create judges for each event

- Add participants

- Create dynamic marking criteria

- Allocate judges to an event

- Monitor judging progress

- View scores

- Calculate results

- Generate rankings

- Export results as PDF

- Print results

- Delete completed events and all their associated data

---

3. Event-Based System

Judges should not be permanent users in the system.

Every time the Admin creates a new event, they must create the judges specifically for that event.

Example

Event 1 – Project Expo

Judges:

- Arun

- Priya

- Karthik

Participants:

- Participant A

- Participant B

- Participant C

Marking criteria:

- Presentation – 10

- Explanation – 20

- Creativity – 10

- Technical Implementation – 20

---

Later:

Event 2 – Quiz Competition

Judges:

- Ravi

- Divya

Participants:

- Participant X

- Participant Y

Marking criteria:

- Accuracy – 30

- Speed – 20

- Knowledge – 50

The judges from Event 1 must have no connection with Event 2.

---

4. Creating an Event

The Admin should have a Create Event option.

When creating an event, the Admin can enter:

- Event name

- Event date

- Event description

- Venue, if required

- Participant list

- Judges

- Marking criteria

After creating the event, the Admin enters the event dashboard.

Event Dashboard

The dashboard should contain:

- Event Details

- Judges

- Participants

- Mark Sheet

- Live Score/Progress

- Results

- Export PDF

- Print

- Delete Event

---

5. Judge Management

Judges are created inside the event.

The Admin can create multiple judges.

Judge Creation

The Admin only needs to enter:

Judge Name / Judge ID

No password is required.

Example:

- Judge 01 – Arun

- Judge 02 – Priya

- Judge 03 – Karthik

- Judge 04 – Divya

The Admin can add, remove, or modify judges before the event is completed.

---

6. Judge Verification & Device Restriction

Since judges don't use passwords, the system must have a verification mechanism controlled by the Admin.

When a judge accesses the Judge Portal:

1. Judge enters/selects their Judge ID/name.

2. The system identifies the device.

3. The Admin verifies/approves the judge.

4. That device becomes associated with that judge for the event.

One Device = One Judge

For a particular event:

One device can only be associated with one judge.

For example:

Device A → Judge Arun

Device B → Judge Priya

Device C → Judge Karthik

If someone tries to use another judge's ID from Device A, the system should block access and show a message such as:

"This device is already assigned to another judge. Please contact the Admin."

The Admin should have an option to reset/unassign a device if necessary.

---

7. Dynamic Mark Sheet

The marking system must be completely dynamic.

The Admin should NOT be limited to fixed criteria.

The Admin can create the mark sheet according to each event.

Example

Participant| Presentation| Explanation| Creativity| Technical| Total

Arun| 8/10| 18/20| 9/10| 18/20| 53/60

Priya| 9/10| 17/20| 8/10| 19/20| 53/60

The Admin should be able to:

- Add criteria

- Delete criteria

- Rename criteria

- Change maximum marks

- Reorder criteria

- Add unlimited criteria

- Set different marks for every criterion

For example:

Presentation → 10 points

Explanation → 20 points

Creativity → 15 points

Technical Implementation → 25 points

The system should automatically calculate:

Maximum Score = 70

---

8. Judge Portal

The Judge Portal should be very simple and focused only on judging.

A judge should only see the event assigned to them.

Judge Dashboard

The judge can see:

- Event name

- Judge name

- Participant list

- Mark sheet

- Submitted scores

- Pending participants

The judge selects a participant and enters marks.

Example:

Participant: Arun

- Presentation: ___ / 10

- Explanation: ___ / 20

- Creativity: ___ / 15

- Technical Implementation: ___ / 25

Total: Automatically calculated

The judge then clicks:

Submit Score

---

9. Score Validation

The system must prevent invalid scores.

For example:

If Presentation is worth 10 points, the judge cannot enter:

- 11

- 15

- -2

The system should only accept valid values between 0 and the maximum allowed mark.

The system should also prevent accidental duplicate submissions.

---

10. Multiple Judges

An event can have any number of judges.

Example:

Event – Project Expo

- Judge 1

- Judge 2

- Judge 3

- Judge 4

- Judge 5

Every judge independently evaluates the participants.

The system stores each judge's scores separately.

Example:

Participant| Judge 1| Judge 2| Judge 3| Final Score

Arun| 85| 88| 90| 87.67

Priya| 90| 86| 89| 88.33

---

11. Final Score Calculation

The Admin should be able to configure how the final score is calculated.

The default method can be:

Final Score = Average of all judges' total scores

Example:

Judge 1 = 85

Judge 2 = 90

Judge 3 = 88

Final Score:

(85 + 90 + 88) / 3 = 87.67

The system should automatically perform the calculation.

---

12. Automatic Ranking

After all judging is completed, the system automatically ranks participants according to their final score.

Example

🏆 Top 3

1st Place – Arun – 92.67

2nd Place – Priya – 90.33

3rd Place – Karthik – 88.67

Other Participants

4. Divya – 86.33

5. Ravi – 84.67

6. Hari – 81.33

7. Suresh – 79.00

The ranking should update automatically whenever valid scores are changed.

---

13. Tie Handling

The system should detect if two participants have the same final score.

The Admin should be able to configure a tie-breaking method.

For example:

- Compare a specific criterion

- Compare total score from a particular judging category

- Mark as joint position

- Allow Admin to manually resolve the tie

---

14. Admin Result Dashboard

The Admin should have a complete overview of the event.

Display:

- Number of participants

- Number of judges

- Completed evaluations

- Pending evaluations

- Participant-wise scores

- Judge-wise scores

- Final scores

- Rankings

- Top 3

The Admin should be able to monitor whether all judges have completed their scoring.

---

15. Event Completion

When judging is finished, the Admin can click:

Complete Event

Before completion, the system should show a confirmation.

Once completed:

- Judges can no longer modify scores.

- The final results are locked.

- Rankings are finalized.

- PDF generation becomes available.

---

16. PDF & Printing

The Admin should be able to generate a professional PDF result sheet.

The PDF should include:

Event Information

- Event name

- Date

- Venue

- Other relevant event details

Judge Information

- Judge names

Participant Scores

- Participant name

- Individual criterion scores

- Total score

- Final score

Final Ranking

- Rank

- Participant name

- Final score

Winners

Clearly highlight:

1st Place

2nd Place

3rd Place

The PDF should be properly formatted for A4 printing.

The Admin should have:

Download PDF

and

Print

options.

---

17. Complete Event Deletion

After the Admin has taken the required printout/PDF, they can delete the event.

When an event is deleted, everything belonging to that event must be permanently deleted.

This includes:

- Event details

- All judges created for the event

- Judge IDs/names

- Device verification/association

- Participants

- Marking criteria

- Mark sheets

- All scores

- Judge-wise scores

- Final scores

- Rankings

- Top 3 results

- Uploaded files

- Event-specific artifacts/data

- Event settings

Important

There should be no permanent judge database.

Judges exist only as part of their event.

For example:

Delete Event 1

→ Event 1 deleted

→ Event 1 judges deleted

→ Event 1 participants deleted

→ Event 1 scores deleted

→ Event 1 mark sheet deleted

→ Event 1 files deleted

→ Event 1 device associations deleted

Nothing from Event 1 should remain.

The Admin can then create a completely fresh Event 2.

---

18. Delete Confirmation

Because deletion is permanent, the system should display a strong confirmation message.

Example:

"Delete this event permanently?"

"This will permanently delete the event, judges, participants, scores, mark sheet, rankings, files, and all other event data. This action cannot be undone."

Buttons:

Cancel

Delete Permanently

---

19. Event Lifecycle

The complete workflow should be:

Admin Login

↓

Create New Event

↓

Create Judges for That Event

↓

Add Participants

↓

Create Dynamic Mark Sheet

↓

Allocate Judges

↓

Judges Open Judge Portal

↓

Admin Verifies/Associates Devices

↓

Judges Enter Scores

↓

System Validates & Calculates Scores

↓

System Calculates Final Scores

↓

Automatic Ranking

↓

Top 3 + Remaining Participants

↓

Admin Completes/Locks Event

↓

Generate PDF / Print

↓

Delete Entire Event

↓

Create New Event

---

20. Core Design Principle

The most important concept of this system is:

EVERY EVENT IS COMPLETELY INDEPENDENT.

Each event has its own:

Judges + Participants + Mark Sheet + Scores + Rankings + Files

When the event is deleted:

Everything related to that event is deleted.

Then the Admin starts with a completely clean event.

The system should be designed to make the judging process fast, simple, dynamic, secure, and easy to manage during live competitions.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/7aff06ed-6bb3-401b-b076-5d692c10b9c7).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
