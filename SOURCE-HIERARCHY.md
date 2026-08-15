# CareerShield Source Hierarchy

Use the highest available source for each fact. A source’s authority does not eliminate the need to record its data year, access date, scope, and limitations.

## Status labels

- `official`: CareerShield retrieved or a reviewer directly inspected the cited authoritative source.
- `user_entered`: Supplied by the customer and not independently verified.
- `user_entered_or_estimated`: A customer input or CareerShield calculation whose underlying facts still require review.
- `needs_verification`: The source is identified, but the relevant fact has not been confirmed.
- `planned_source`: An authoritative integration candidate that is not connected. Never display this as verified.

## College and degree paths

1. Current official school catalog or program page - current program existence, requirements, duration, published tuition, and disclosures.
2. NCES/IPEDS - institution identity, reported programs/completions, institutional prices, enrollment, aid, and graduation data.
3. College Scorecard - costs, debt, completion, earnings, and federal field-of-study suggestions.
4. Customer entry - facts not available from the sources above, clearly labeled for verification.

College Scorecard is a suggestion source, not proof that a current program does or does not exist.

## Occupation and labor-market economics

1. U.S. Bureau of Labor Statistics - wages, employment, industry employment, geographic differences, and projections.
2. O*NET - occupation identity, tasks, knowledge, skills, abilities, work context, related occupations, and military crosswalks.
3. Customer or provider claims - only when official labor data cannot answer the question.

## Apprenticeships and skilled trades

1. Apprenticeship.gov/RAPIDS or the responsible State Apprenticeship Agency - registered status and sponsor information.
2. Current sponsor documentation - wage progression, related instruction, costs, hours, completion rules, and openings.
3. BLS - occupation wages and labor-market economics.
4. State licensing board or CareerOneStop - license requirements and jurisdiction-specific rules.

Public RAPIDS information has coverage and timing limitations. Do not infer that an unlisted program is unregistered without checking the relevant state authority.

## Certifications and credentials

1. Credential issuer’s official page - current credential, requirements, exams, renewal, and fees.
2. Credential Engine Registry - issuer-published or approved third-party credential records.
3. CareerOneStop - certifications, licenses, state requirements, training, and local career information.
4. State licensing board - legally required licenses and renewal rules.

Registry presence is evidence of a published record, not a guarantee of quality, placement, recognition, or return on investment.

## Military paths

1. DFAS - basic pay.
2. DoD Military Compensation and official BAH data - allowances and compensation rules.
3. Official service career pages and written recruiting documents - specialty descriptions, eligibility, availability, and commitments.
4. O*NET military crosswalk - civilian occupation mapping.
5. VA - GI Bill eligibility guidance, approved schools/employers, Yellow Ribbon information, estimates, and caution indicators.

Never substitute commercial military-pay calculators for the paid report’s official-rate review.

## Required evidence metadata

Every material report value should retain:

- Field or claim
- Value used
- Source name
- Direct source URL
- Source status
- Data year or vintage
- Accessed or reviewed date
- Confidence level
- Relevant limitation or discrepancy
- Reviewer resolution, if applicable

## Conflict rule

Do not silently choose between conflicting values. Preserve both, identify the conflict, state which value the model used and why, show the sensitivity when material, and add the conflict to the reviewer checklist.
