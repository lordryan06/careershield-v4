# CareerShield V4.1.1 correction release

V4.1.1 corrects confusing inputs and the broken military next-step link while preserving the V4.1 design, live Stripe checkout, federal-data integrations, Netlify deployment, and protected AI assistant.

## Corrections

- College distinguishes degree level from the degree-plan/field search.
- Trade and training routes no longer show a fake provider dropdown.
- Provider-level assumptions are identified as editable fallback information until verified live provider data is connected.
- Military specialties are filtered by branch and career track and scored without requiring a civilian-career selection.
- Military cost, debt, time-to-earnings, and civilian-career fields are removed from the workflow.
- GI Bill value assumes full use and includes an eligibility warning.
- Duty ZIP and dependent status are collected for housing-rate verification.
- The selected military branch is saved with every new result.
- Military buttons go to the corresponding official branch website; the dead generic fallback is removed.

## Replace in GitHub

- `index.html`
- `styles.css`
- `app.js`
- `README.md`
- `netlify/functions/assistant.js`
- `netlify/functions/careers.js`
- `netlify/functions/schools.js`

Commit directly to `main` with:

`Fix CareerShield V4.1 military and path workflows`

Previously saved military comparisons do not contain a branch. Remove and score them again after deployment.
