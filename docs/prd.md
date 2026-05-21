## Problem Statement

Employees have no structured way to submit, discover, and collaborate on ideas year-round. Innovation Day events are organised ad-hoc — there is no persistent platform for challenge curation, team formation, or outcome tracking. Good ideas get lost in Slack threads and email chains, and there is no visibility into what was built or recognised in previous events. This leads to low idea participation, duplicated effort across events, and no measurable way to track an idea from suggestion to outcome.

## Solution

IdeaFarming is an internal web application that serves two complementary purposes:

1. **A year-round Idea management platform** where Employees submit, rate, discuss, and discover Ideas. The two-axis rating system (Business Impact + Effort Required) surfaces the most actionable ideas and gives Employees a meaningful reason to engage continuously, not just around events.

2. **A structured Innovation Day management tool** where Admins run quarterly events, Employees self-form Teams around promoted Challenges, and Teams document their work in Reports. The same Idea can be promoted across multiple Innovation Days, enabling progress to be tracked over time.

All terminology in this PRD follows the domain glossary in [`CONTEXT.md`](../CONTEXT.md).

## User Stories

### Authentication & Accounts
1. As an Employee, I want to log in with my email and password, so that I can access the platform securely.
2. As an Employee, I want to reset my password via a link sent to my email, so that I can regain access if I forget it.
3. As an Admin, I want to provision an Employee account by email address, so that I control who has access to the platform.
4. As an Admin, I want to deactivate an Employee account, so that former employees lose access when they leave the company.

### Idea Submission
5. As an Employee, I want to submit an Idea with a title, description, and Category, so that I can share my suggestions with the company.
6. As an Employee, I want to attach an optional image to my Idea, so that I can visually represent what I have in mind.
7. As an Employee, I want to submit an Idea anonymously, so that I can share sensitive or unconventional suggestions without fear of judgment.
8. As an Employee, I want my anonymous Idea to display "Anonymous" instead of my name everywhere it appears, so that my identity remains hidden from colleagues.
9. As an Employee (submitter of an anonymous Idea), I want to remove my anonymous status, so that I can take public credit if the Idea gains traction.
10. As an Admin, I want to see the true author of any anonymous Idea, so that I can moderate content if necessary.

### Idea Discovery
11. As an Employee, I want to browse a list of all active Ideas, so that I can stay informed about what my colleagues are suggesting.
12. As an Employee, I want to search Ideas by keyword across titles and descriptions, so that I can quickly find ideas relevant to my interests.
13. As an Employee, I want to filter Ideas by Category, so that I can browse suggestions in my area of expertise.
14. As an Employee, I want to filter Ideas by whether they have been promoted to an Innovation Day, so that I can see which ideas are already being acted upon.
15. As an Employee, I want to sort Ideas by Newest, so that I can see the latest submissions first.
16. As an Employee, I want to sort Ideas by Highest Business Impact, so that I can find the ideas colleagues value most.
17. As an Employee, I want to sort Ideas by Most Discussed (comment count), so that I can join active conversations.
18. As an Employee, I want to sort Ideas by Quick Win (Low Effort + High Impact), so that I can identify the most actionable suggestions.
19. As an Admin, I want to filter Ideas by archived status, so that I can review or restore archived content.

### Idea Rating
20. As an Employee, I want to rate an Idea's Business Impact on a 1–5 star scale, so that I can signal how valuable I think it is to the company.
21. As an Employee, I want to rate an Idea's Effort Required as Low, Medium, or High, so that I can signal how hard it would be to implement.
22. As an Employee, I want to rate Business Impact and Effort independently, so that I can provide whichever signal I feel confident about.
23. As an Employee, I want to remove my rating by selecting the same value again, so that I can change my mind.
24. As an Employee, I want to see the average Business Impact score and the Effort distribution for an Idea, so that I can understand how colleagues assess it collectively.

### Idea Comments
25. As an Employee, I want to post a top-level comment on an Idea, so that I can provide feedback or share relevant knowledge.
26. As an Employee, I want to reply to a specific comment on an Idea, so that I can engage in focused discussions.
27. As an Employee, I want to delete my own comment, so that I can retract something I said.
28. As an Admin, I want to delete any comment, so that I can remove inappropriate or harmful content.
29. As an Employee, I want comments to be displayed chronologically with replies nested under their parent, so that I can follow the flow of discussion.

### Idea Administration
30. As an Admin, I want to create and manage Categories, so that Ideas can be consistently classified and filtered.
31. As an Admin, I want to archive an Idea, so that I can remove low-quality or irrelevant ideas from the active list without deleting them.
32. As an Admin, I want archiving an Idea to leave all existing Challenges intact, so that past Innovation Day history is preserved.
33. As an Admin, I want archived Ideas to be excluded from Challenge promotion, so that stale ideas cannot be added to future events.

### Innovation Day Management
34. As an Admin, I want to create an Innovation Day in Draft state, so that I can configure it before making it visible to Employees.
35. As an Admin, I want to transition an Innovation Day from Draft to Open, so that Employees can start promoting Challenges and joining Teams.
36. As an Admin, I want to transition an Innovation Day from Open to In Progress, so that team rosters are locked for the event day.
37. As an Admin, I want to transition an Innovation Day from In Progress to Completed, so that the event is closed and outcomes can be recorded.
38. As an Admin, I want Challenges with no Team members to be automatically removed when an Innovation Day completes, so that the event record only contains real participation.
39. As an Admin, I want to set a maximum team size for an Innovation Day, so that participation is distributed across Challenges.
40. As an Admin, I want to mark a Challenge as Featured after an Innovation Day completes, so that I can publicly recognise outstanding work.

### Challenges
41. As an Employee, I want to promote any Idea to an open Innovation Day as a Challenge, so that I can nominate work I think should be tackled at the event.
42. As an Employee, I want to select a Challenge Type (Implementation of Improvements, Experimentation and Exploration, or Problem-Solving and Brainstorming) when promoting an Idea, so that participants know what kind of work is involved.
43. As an Employee, I want to add an optional framing when promoting an Idea as a Challenge, so that I can scope the problem statement for that specific event.
44. As an Employee, I want to see all Challenges on an open Innovation Day, so that I can decide which one to join.
45. As an Employee, I want to see the Challenge framing alongside the original Idea description, so that I understand the scoped problem statement.
46. As an Employee, I want to see the Challenge Type for each Challenge, so that I can pick work that suits my skills.
47. As an Employee, I want to see an Idea's full Challenge history across all Innovation Days, so that I can track how it has progressed over time.
48. As an Employee, I want Featured Challenges to display a visible badge, so that I can see which work was recognised.
49. As an Employee, I want the Featured badge to appear on an Idea when any of its Challenges has been featured, so that the Idea's legacy is visible year-round.

### Teams
50. As an Employee, I want to join a Team for a Challenge on an open Innovation Day, so that I can participate in the event.
51. As an Employee, I want to see how many members are currently on each Team, so that I know which Challenges still have capacity.
52. As an Employee, I want to be prevented from joining a Team that is already full, so that team size caps are enforced.
53. As an Employee, I want team membership to be locked when an Innovation Day moves to In Progress, so that rosters are stable on the event day.

### Reports
54. As an Employee, I want to start writing a Team Report as soon as a Challenge is promoted, so that my team can begin preparing before the event.
55. As an Employee, I want to fill in the problem description field in the Report, so that we document what problem we set out to solve.
56. As an Employee, I want to fill in the expected benefits field in the Report, so that we articulate the value of our work.
57. As an Employee, I want to fill in the main tasks and activities field in the Report, so that we document what we actually did.
58. As an Employee, I want to fill in the results field in the Report, so that we capture what we achieved.
59. As an Employee, I want to fill in the next steps field in the Report, so that future teams or stakeholders know how to continue the work.
60. As an Employee, I want to add structured references to related Ideas and Challenges in the Report, so that connections between work are navigable in the platform.
61. As an Employee, I want to save the Report without notifying my teammates, so that I can work in draft without interrupting them.
62. As an Employee, I want to click a "share update" action to notify my teammates, so that I can signal when meaningful progress has been made.
63. As an Employee, I want to continue editing the Report after the Innovation Day is completed, so that I can finish documenting results after the event day.

### Notifications
64. As an Employee, I want to receive an in-app notification when someone comments on my Idea, so that I can respond promptly.
65. As an Employee, I want to receive a notification when someone replies to my comment, so that I can follow the thread.
66. As an Employee, I want to receive a notification when my Idea is promoted to a Challenge, so that I know it has been selected for an event.
67. As an Employee, I want to receive a notification when an Innovation Day moves to Open, so that I know I can start joining Teams.
68. As an Employee, I want to receive a notification when the Challenge I joined reaches its team size cap, so that I know registration has closed.
69. As an Employee, I want to receive a notification when a teammate explicitly shares a Report update, so that I can review their progress.
70. As an Employee, I want to see all my notifications in an in-app notification bell, so that I don't miss important activity.
71. As an Employee, I want to mark notifications as read, so that I can manage my notification state.

### My Activity
72. As an Employee, I want a private My Activity page showing my submitted Ideas, promoted Challenges, team participations, and Innovation Days attended, so that I can track my contributions over time.
73. As an Employee, I want My Activity to be visible only to me, so that my history is not exposed to colleagues.

---

## Implementation Decisions

### Modules
The following modules will be built. Deep modules (complex logic, simple interface) are marked *.

| Module | Responsibility |
|---|---|
| **Auth** | Email/password login, session management, password reset, Admin account provisioning. Isolated boundary for future SSO swap. |
| **Idea** | Create/read/update, anonymous flag, image, archive. Core year-round entity. |
| **Category** | Admin-managed CRUD. Referenced by Ideas. |
| **Rating** * | Two-axis rating (Business Impact 1–5 stars, Effort Low/Medium/High) per Idea per Employee. Toggle to deselect. Aggregate calculations. |
| **Comment** | Threaded comments (max 2 levels) on Ideas. Delete by author or Admin. No editing. |
| **Idea Discovery** * | Full-text search + filtering + sorting. Encapsulates all query logic behind a single interface. |
| **Innovation Day** * | Lifecycle state machine (Draft → Open → In Progress → Completed). Empty Challenge pruning on Completed transition. Featured badge. |
| **Challenge** | Promote Idea to Innovation Day, Challenge type, framing, team size cap enforcement, full/closed state. |
| **Team** | Member join/leave, size enforcement, roster lock derived from Innovation Day status. |
| **Report** | Structured document per Challenge. Structured cross-references to Ideas and Challenges. Share-update notification trigger. Editable forever. |
| **Notification** * | In-app notification bell. Event-driven fan-out to recipients. Read/unread state. |
| **My Activity** | Private aggregated view of an Employee's history across all modules. |

### Key design decisions

- **Challenge as join entity.** A Challenge is a join between an Idea and an Innovation Day. The same Idea can have Challenges across multiple events. Archiving an Idea does not cascade to existing Challenges.

- **Anonymous authorship.** The submitter identity is always stored in the database. The `anonymous` flag controls masking in API responses — non-Admin users receive `"author": "Anonymous"` when the flag is set. Anonymity persists on Challenge pages.

- **Innovation Day state machine.** Transitions are strictly sequential. Backwards transitions are rejected at the service layer. Team roster lock is derived from Innovation Day status at query time — no schema change needed.

- **Empty Challenge pruning.** Triggered automatically in the same database transaction as the Draft → Completed transition. Challenges with zero Team members are deleted.

- **Rating mechanic.** Two independent axes: Business Impact (1–5 stars) and Effort Required (Low / Medium / High). Toggle behaviour (selecting the same value removes the rating). See [ADR-0001](../docs/adr/0001-idea-rating-mechanic.md).

- **Full-text search.** Implemented via PostgreSQL `tsvector` on Idea title and description. "Quick Win" sort uses a computed score: high average impact + majority Low effort vote.

- **Comment threading.** Maximum depth of 2 enforced at the API layer. Top-level comments ordered chronologically; replies ordered chronologically under their parent.

- **Report cross-references.** Stored as foreign key references to Ideas and Challenges. Rendered as navigable links in the UI.

- **Notification fan-out.** Notifications are written to a `notifications` table per recipient synchronously at event time (no external queue in v1). In-app delivery via polling or Server-Sent Events.

- **Auth — Phase 1.** Email/password with bcrypt. Email is the primary identifier (not username) to enable future SSO migration. No self-signup; Admin provisions accounts. See [ADR-0002](../docs/adr/0002-auth-email-password-phase1.md).

- **Tech stack.** React + TypeScript (Vite) frontend, shadcn/ui + Tailwind for components, Node.js + TypeScript (Fastify) backend, PostgreSQL database, Docker for containerisation.

---

## Testing Decisions

**What makes a good test:** Tests assert external behaviour (what a module returns or what side effects it produces) — not implementation details (how it does it). Tests use realistic data and cover both the happy path and meaningful edge cases.

**Modules to test and what to cover:**

| Module | What to test |
|---|---|
| **Rating** | Aggregate calculations (average impact, effort distribution); toggle behaviour (re-selecting removes vote); per-user isolation (Employee A's vote does not affect Employee B's); independence of the two axes |
| **Idea Discovery** | Each filter in isolation and in combination; each sort order with realistic data; full-text search matches title and description; "Quick Win" sort correctly ranks Low Effort + High Impact Ideas first; archived Ideas excluded from default results |
| **Innovation Day (state machine)** | All valid transitions succeed; all invalid transitions (e.g. Completed → Open) are rejected; empty Challenge pruning fires exactly on the Completed transition and only removes zero-member Challenges; team join is rejected when event is In Progress or Completed |
| **Notification** | Each trigger event dispatches notifications to the correct recipients only; "share update" action triggers notification; silent save does not; marking a notification read updates only the recipient's state |

---

## Out of Scope

- SSO / SAML / OIDC integration (planned Phase 2 — see ADR-0002)
- Email notifications (in-app only for v1)
- Native mobile application (responsive web only)
- File upload attachments in Reports (external links only)
- Public-facing idea portal (internal company use only)
- Leaderboards or gamification points
- Employee voting on Reports or peer awards after Innovation Day
- Integration with project management tools (Jira, Azure DevOps, etc.)
- Real-time collaborative editing of Reports

---

## Further Notes

- The domain glossary in [`CONTEXT.md`](../CONTEXT.md) is the source of truth for all terminology used in this PRD and in code.
- Two architectural decisions are documented as ADRs: [ADR-0001 (rating mechanic)](../docs/adr/0001-idea-rating-mechanic.md) and [ADR-0002 (auth strategy)](../docs/adr/0002-auth-email-password-phase1.md).
- The rating mechanic (ADR-0001) was selected after a live prototype comparison of four variations (A–D). Variation D (two-axis rating) was chosen.
