# Domain Glossary

## Idea
An open-ended improvement or innovation suggestion submitted by an Employee. Exists year-round, independent of any event. Contains a title, a description, a Category, and an optional image. May be submitted anonymously: the system always records the submitter's identity (for notifications and moderation), but other Employees see "Anonymous" instead of a name. Anonymity is set at submission time and persists everywhere the Idea appears, including on Challenge pages. Only the submitter or an Admin can remove anonymous status. Owned by its submitter; its content is never modified by anyone else. Can be **archived** by an Admin to remove it from the active idea list; archiving does not affect existing Challenges linked to the Idea. Archived Ideas cannot be promoted to future Innovation Days.

## Innovation Day
A periodic company event (quarterly) during which employees form teams to work on selected challenges. Lifecycle: **Draft** (visible to Admin only, being configured) → **Open** (Employees can promote Challenges and join Teams) → **In Progress** (day-of; team rosters are locked, work is happening) → **Completed** (terminal; empty Challenges are pruned, results are recorded). Typically lasts one day.

## Challenge
The participation of a specific Idea in a specific Innovation Day. Created by any Employee who links an Idea to an open Innovation Day. Has a **type** (see Challenge Type). Carries an optional employee-authored framing (a scoped problem statement); if absent, the original Idea description is shown. Owns the Team and Report for that event. The same Idea may have Challenges across multiple Innovation Days, enabling progress to be tracked over time. Challenges with no Team registrations are removed when their Innovation Day is completed. The underlying Idea is never affected. After an Innovation Day completes, an Admin may mark a Challenge as **Featured** to recognise outstanding work; Featured Challenges display a visible badge on both the Challenge and the linked Idea.

## Category
A label used to classify Ideas, managed exclusively by Admins. Enables filtering and browsing of the Idea list. Examples: Process, Customer Experience, Tech Debt. An Idea belongs to exactly one Category.

## Challenge Type
A classification that describes the nature of the work a Challenge involves. One of: **Implementation of Improvements**, **Experimentation and Exploration**, **Problem-Solving and Brainstorming**.

## Report
A structured document produced by a Team to capture their work on a Challenge. Belongs to exactly one Challenge. Can be created and edited from the moment the Challenge is promoted, and remains editable after the Innovation Day is completed — it is never locked. Contains: description of the problem to be solved, structured references to related Ideas and Challenges in the system, expected benefits, main tasks/activities performed, results, and next steps.

## Team
A group of employees who self-organize around a specific Challenge during a specific Innovation Day. Born when the first member joins a Challenge; dissolved when the Innovation Day closes. Scoped to exactly one Challenge — one Challenge has at most one Team. Has no existence outside of its Challenge. Admins may cap team size; once full, the Challenge is closed to new members.

## Employee
Any authenticated company user. Can submit Ideas, rate Ideas, comment, join Teams, and promote any Idea (including others') to a Challenge on an open Innovation Day.

## Rating
The mechanism by which an Employee expresses their assessment of an Idea. Two independent axes: **Business Impact** (1–5 stars, aggregated into a visible average and count) and **Effort Required** (Low / Medium / High, shown as a distribution). Both are optional and independent. Selecting the same value again removes the rating. See [ADR-0001](docs/adr/0001-idea-rating-mechanic.md).

## Idea Discovery
Employees find Ideas through full-text search (title and description) and a combination of filters and sort orders. Filters: Category, Challenge Type, promotion status (promoted to an event or not), and archived status (Admin-only filter). Sort orders: Newest, Highest Business Impact, Most Discussed (comment count), and Quick Win (Low Effort + High Impact combined). Default sort is Newest.

## Comment
A piece of feedback left by an Employee on an Idea. Comments are threaded — an Employee can reply to a specific Comment, creating nested conversations. Thread depth is limited to two levels (comment → reply) to avoid infinite nesting. Top-level comments are ordered chronologically. An Employee can delete their own Comment; an Admin can delete any Comment. Comments cannot be edited after posting.

## My Activity
A private, personal view accessible only to the authenticated Employee. Shows their submitted Ideas, Challenges they promoted, Teams they've been part of, and Innovation Days they participated in. Not publicly visible — no employee can view another's activity page.

## Notification
An in-app alert delivered to an Employee. No email channel in v1. Triggered by the following events:

| Trigger | Recipients |
|---|---|
| A Comment is posted on your Idea | Idea author |
| A reply is posted on your Comment | Comment author |
| Your Idea is promoted to a Challenge | Idea author |
| An Innovation Day moves to Open | All Employees |
| A Challenge you joined is full / closed to new members | Team members |
| A teammate explicitly shares a Report update | All Team members of that Challenge |

Report notifications are opt-in per edit — a team member clicks a "share update" action to push a notification to teammates. Saving the Report alone does not trigger a notification.
