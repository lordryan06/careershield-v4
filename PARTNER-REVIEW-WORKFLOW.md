# CareerShield Partner Review Workflow

Status: development specification. Partner Review must not accept payment until reviewer capacity, customer consent, assignment, privacy, payout, support, cancellation, refund, and delivery procedures are operational.

## Product ladder

- Free CareerShield: build and compare up to four paths.
- CareerShield Deep Analysis: planned $9.99 instant AI-generated stress test.
- CareerShield Partner Review: planned $49.99 customer price for the generated report plus an approved independent counselor or partner review.

The initial revenue split to test is $25 to the reviewer and $24.99 to CareerShield. This is a validation assumption, not a promised rate. Measure actual review time, correction rates, payment fees, support costs, taxes, and customer demand before adopting it permanently.

## Responsibility boundary

CareerShield owns live data and evidence, scoring, 10-year modeling, AI analysis, report formatting, payment and case workflow, privacy and access controls, quality standards, correction routing, delivery, and customer support.

The assigned reviewer owns contextual judgment, representation and assumption review, discrepancy review, comments and recommendations, important questions and next steps, adherence to their disclosed professional scope, and final approval or return for correction.

## Initial reviewer population

Begin with approved independent career counselors and private counseling organizations. Do not offer per-case compensation to public-school employees until the employer’s outside-compensation, referral, conflict-of-interest, procurement, student-privacy, and ethics requirements have been reviewed and documented.

## Required case states

1. `draft_generated` — CareerShield analysis and evidence package created.
2. `awaiting_assignment` — payment and customer consent confirmed; no reviewer assigned.
3. `assigned` — reviewer accepted the case and deadline.
4. `in_review` — reviewer opened the case and review work began.
5. `correction_required` — reviewer returned specific issues to CareerShield.
6. `approved` — checklist, comments, identity disclosure, and approval completed.
7. `delivered` — approved report delivered to the customer.
8. `cancelled`, `refunded`, or `reassigned` — reason and timestamps retained.

## Reviewer case view

Each case must show the selected paths in score order, current leader and reasoning, ten-year timeline, evidence register, Data Confidence, customer-entered assumptions, CareerShield estimates, and a prioritized attention queue. Common attention flags include tuition, scholarships, provider identity, licensing, salary outliers, placement claims, military eligibility, benefit assumptions, and conflicting sources.

The standardized review form must include:

- Paths correctly represented.
- Major assumptions reasonable.
- Source discrepancies reviewed.
- Financial comparison internally consistent.
- Important risks identified.
- Questions and next steps appropriate.
- Reviewer comments and recommendations.
- Corrections required, if any.
- Approve and deliver authorization.

## Approval record

Store the case ID, report version, reviewer ID and displayed name, partner organization, disclosed qualification, checklist responses, comments, correction history, unresolved limitations, assignment and completion timestamps, approval status, customer consent version, and delivered report identifier.

## Launch gate

Before enabling checkout, complete reviewer agreements and screening, secure role-based access, customer consent, partner privacy terms, case assignment and reassignment, service-level targets, payout onboarding and tax reporting, refund rules, support escalation, reviewer removal, audit logs, sample-report review, and a limited pilot. Confirm reviewer capacity before every sale.
