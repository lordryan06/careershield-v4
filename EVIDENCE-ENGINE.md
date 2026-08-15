# CareerShield Evidence Engine

## Objective

Turn each important number or claim into an auditable evidence record. The report should explain not only the result, but what supports it, how current it is, what conflicts with it, and what still needs confirmation.

## Evidence record

```json
{
  "field": "Starting annual wage",
  "value": 45760,
  "source": "Apprenticeship sponsor wage schedule",
  "url": "https://example.gov/program",
  "status": "official",
  "dataYear": "2026",
  "accessed": "2026-08-15T00:00:00.000Z",
  "confidence": "High",
  "note": "First-period wage; progression requires successful advancement",
  "conflict": null
}
```

V4.4.0 stores the evidence foundation inside `comparison.dataConfidence.evidence`. Newly calculated comparisons carry the evidence record through local saving, account synchronization, AI Guide context, printing data, and paid-report fulfillment data.

## Confidence rules

- High: directly retrieved or reviewed authoritative source that specifically supports the field and is sufficiently current.
- Moderate: authoritative but indirect/older source, or a reasonable estimate grounded in labeled official inputs.
- Limited: customer/provider claim, missing date, unresolved conflict, non-specific source, or unverified current status.
- Pending: planned integration; contributes no verification credit.

An overall Data Confidence percentage is a summary, not a substitute for the evidence register. Missing high-impact facts must remain visible even when the aggregate score is high.

## Integration sequence

1. BLS: map O*NET-SOC codes to the correct BLS series and add wage/employment/projection vintages.
2. Credential Engine: use the Registry Search API for credential and issuer candidates; preserve publisher and record metadata.
3. Official program pages: reviewer-assisted capture and discrepancy checks; do not scrape or claim verification until a controlled backend is implemented.
4. Apprenticeship.gov/RAPIDS: use documented public data or state/sponsor review; do not imply a general verification API exists.
5. VA open data: approved programs/employers, Yellow Ribbon, estimates, and caution indicators.
6. CareerOneStop: licenses, certifications, state requirements, training, and local labor information after credentials are issued.
7. State boards: jurisdiction-specific licensing requirements and portability.

## Release gate for a live source

A planned source may become `official` only after:

1. The endpoint or dataset and permitted use are documented.
2. Identifiers are mapped without ambiguous silent fallbacks.
3. Source date/vintage and access date are captured.
4. Missing, suppressed, stale, and conflicting values are tested.
5. Results link to the authoritative source.
6. Saved/synced comparisons and report data preserve metadata.
7. The UI distinguishes retrieved data from reviewer-inspected data.
8. Automated and reviewer tests pass.

## Reviewer workflow

Review yellow and red evidence first. Confirm material discrepancies, document the value used by the model, rerun calculations when required, and prevent delivery until unresolved high-impact limitations are disclosed.
