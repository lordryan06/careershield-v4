# CareerShield V4

CareerShield V4 is a Netlify-ready decision tool for comparing up to four mixed career paths: college, skilled trades and apprenticeships, certifications and technical training, and military service.

## V4 highlights

- A single guided builder adapts its questions to all four path types.
- Military paths use the official O*NET Military Occupational Classification crosswalk, with branch, enlisted/officer/warrant track, specialty-code search, and linked civilian careers.
- Mixed paths are ranked on expected financial outcome, time to earnings, debt and upfront cost, employment demand, AI resilience, and career flexibility.
- Every result exposes all six factor scores and the 5-year earnings estimate behind the comparison.
- Live College Scorecard school search and O*NET occupation data remain server-side through the existing Netlify Functions.
- Comparisons remain device-local in browser `localStorage`.
- The existing Netlify form, styling system, headers, redirects, and deployment model are preserved.

## Deploy to Netlify

Deploy this folder from a Git repository or with the Netlify CLI. In Netlify project environment variables, configure:

- `DATA_GOV_API_KEY` for College Scorecard
- `ONET_API_KEY` for O*NET Web Services v2

Then redeploy. Enable Netlify form detection if you want submissions from the `careershield-interest` form.

## Local development

Install Node.js and the Netlify CLI, authenticate, and run `npm run dev`. Opening `index.html` directly displays the interface, but live searches require the Netlify Functions runtime and the two environment variables.

## Scoring model

The composite score uses these weights: financial outcome 28%, time to earnings 17%, debt and upfront cost 18%, employment demand 15%, AI resilience 12%, and career flexibility 10%.

Financial outcome estimates earnings over the first five years from the user’s timeline and in-training income, minus net path cost and a simple debt financing drag. Employment demand uses O*NET outlook signals. AI resilience uses a transparent prototype task-text heuristic that favors physical, diagnostic, interpersonal, safety, and field work and discounts routine clerical work. Career flexibility uses related occupations and employing industries returned by O*NET. Missing labor data receives a neutral value.

All results are directional decision support, not financial advice, an insurance offer, or a guarantee of employment or earnings.

The military search uses the same `ONET_API_KEY`; no additional military-data credential is required. Supported branches are Army, Air Force, Navy, Marine Corps, Coast Guard, and Space Force.
