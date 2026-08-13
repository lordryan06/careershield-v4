# CareerShield V4

CareerShield V4 is a Netlify-ready decision tool for comparing up to four mixed career paths: college, skilled trades and apprenticeships, certifications and technical training, and military service.

The production brand assets are `careershield-logo.png` for the horizontal navigation lockup and `careershield-icon.png` for the browser icon.

`legal.html` contains the paid-beta Privacy Notice, Terms of Use, personalized-report Refund Policy, and AI Guide disclosure. These are operational drafts, not a substitute for review by a qualified attorney before broad commercial launch.

## V4 highlights

- A single guided builder adapts its questions to all four path types.
- Military paths use the official O*NET Military Occupational Classification crosswalk, with branch, enlisted/officer/warrant track, specialty-code search, and linked civilian careers.
- Military comparisons include editable pay grade, basic pay, housing and food allowances, special pay, accession bonus, service commitment, and risk-adjusted education-benefit value.
- Skilled-trades comparisons model hourly entry pay, progressive wage steps, paid hours, journey-level wages, program duration, tools, classroom fees, licensing costs, and employer or union support.
- Certification and technical-training comparisons model credential type, tuition, exams, materials, renewal costs, reimbursement, completion likelihood, verified related-job placement, target salary, and fallback earnings.
- Mixed paths are ranked on expected financial outcome, time to earnings, debt and upfront cost, employment demand, AI resilience, and career flexibility.
- Every result exposes all six factor scores and the 5-year earnings estimate behind the comparison.
- Live College Scorecard school search and O*NET occupation data remain server-side through the existing Netlify Functions.
- Comparisons remain device-local in browser `localStorage`.
- The existing Netlify form, styling system, headers, redirects, and deployment model are preserved.
- A $49 personalized Decision Report offer uses a Stripe-hosted Payment Link, avoiding a custom payment backend.
- The CareerShield Guide uses the OpenAI Responses API from a server-side Netlify Function to explain saved comparisons and challenge assumptions without exposing credentials in the browser.

## Deploy to Netlify

Deploy this folder from a Git repository or with the Netlify CLI. In Netlify project environment variables, configure:

- `DATA_GOV_API_KEY` for College Scorecard
- `ONET_API_KEY` for O*NET Web Services v2
- `OPENAI_API_KEY` for the CareerShield Guide

Then redeploy. Enable Netlify form detection if you want submissions from the `careershield-interest` form.

## Local development

Install Node.js and the Netlify CLI, authenticate, and run `npm run dev`. Opening `index.html` directly displays the interface, but live searches require the Netlify Functions runtime and the two environment variables.

## Scoring model

The composite score uses these weights: financial outcome 28%, time to earnings 17%, debt and upfront cost 18%, employment demand 15%, AI resilience 12%, and career flexibility 10%.

Financial outcome estimates earnings over the first five years from the user’s timeline and in-training income, minus net path cost and a simple debt financing drag. Employment demand uses O*NET outlook signals. AI resilience uses a transparent prototype task-text heuristic that favors physical, diagnostic, interpersonal, safety, and field work and discounts routine clerical work. Career flexibility uses related occupations and employing industries returned by O*NET. Missing labor data receives a neutral value.

All results are directional decision support, not financial advice, an insurance offer, or a guarantee of employment or earnings.

## AI guide

The AI guide calls `/api/assistant`, which uses `OPENAI_API_KEY` only inside the Netlify Function. The browser sends the user’s question and up to four locally saved comparison objects. The guide is instructed to use only that supplied comparison data, distinguish estimates from guarantees, ask users to verify unsupported facts, and avoid presenting itself as a financial adviser, recruiter, school, insurer, or government representative. The current model is `gpt-5-mini`, with short response limits to control cost.

## Paid report checkout

The current purchase button uses a Stripe **test-mode** Payment Link and is visibly labeled as a test checkout. It cannot collect real payments. Before launch, create or activate the equivalent product in Stripe live mode, replace the test URL in `index.html`, and remove the test banner and warning. Customer fulfillment is currently manual and promises delivery within three business days after assumptions are confirmed.

The military search uses the same `ONET_API_KEY`; no additional military-data credential is required. Supported branches are Army, Air Force, Navy, Marine Corps, Coast Guard, and Space Force.

Military compensation uses editable 2026-oriented starting assumptions. BAS defaults distinguish enlisted and officer rates; BAH is entered by the user because it depends on duty ZIP code, pay grade, dependency status, and housing availability. Users should verify basic pay, bonuses, special pay, and housing through official DoD/DFAS sources and their written offer. Education benefit value is probability-adjusted and depends on qualifying service and actual use.

The skilled-trades model follows the U.S. Department of Labor Registered Apprenticeship structure: apprentices are paid employees and receive progressive wage increases as skills and productivity grow. The model divides the program into editable wage steps, calculates earnings month by month, applies journey-level wages after completion, and deducts net tools, instruction, and licensing costs. Actual schedules and requirements vary by sponsor, agreement, occupation, and location.

The certification and technical-training model probability-adjusts earnings by multiplying personal completion likelihood by the verified related-job placement rate. Users should prefer state or federal Eligible Training Provider performance data and independently verified outcomes over marketing claims. The model includes fallback earnings when completion or related placement does not occur, plus expected renewal and continuing-education costs.
