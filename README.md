# CareerShield V4.3

## V4.3 experience update

- College debt now defaults to the full estimated tuition remaining after entered scholarships and grants, preventing a school-wide historical median from understating the selected student's projected cost.
- Military paths now estimate the earned Post-9/11 GI Bill from projected service eligibility, school type, annual net tuition, school-location housing, academic years, and books. The estimate is shown as a future education benefit rather than immediate military compensation.
- The side-by-side area now invites users with one to three scored paths to start another path instead of continuing to show the empty-state message.

- A stronger homepage leads with “Find the best path for your future” and four clear route cards.
- The questionnaire is presented as a three-step guided flow: route, path details, and money/outcomes.
- Results include a visual score, debt, and directional 10-year net-value comparison.
- New How It Works, Students, Parents, Counselors, and official-data trust sections explain the product quickly.
- The $49.99 report section now lists six concrete deliverables.

## V4.2 status

- College selection now loads that institution's reported degree plans from College Scorecard field-of-study records.
- Selecting a degree plan loads a dependent target-career dropdown through the official O*NET education (CIP) crosswalk.
- Skilled trades, apprenticeships, certifications, and technical training now share one clearer `Trades & training` route with a training-type selector.
- Trades and training use a dropdown backed by the complete O*NET occupation catalog.
- Military specialties remain filtered by service branch and enlisted, commissioned-officer, or warrant-officer track using the O*NET military crosswalk.
- Military users choose a specialty category and then a dependent specialty dropdown filtered by branch and career track.
- CareerOneStop live provider, apprenticeship, and local-program data is intentionally not simulated. Add its credentials only after CareerOneStop approves API access.
- BAH now loads automatically from the official 2026 DoD all-location rate file using duty ZIP, pay grade, and dependent status.
- Basic pay uses the official 2026 DFAS starting-service rates, and BAS automatically uses the 2026 enlisted or officer rate.
- When College Scorecard reports program-level earnings or debt, selecting the degree plan applies those values automatically. Suppressed values remain clearly unavailable rather than becoming zero.

CareerShield V4 is a Netlify-ready decision tool for comparing up to four mixed career paths: college, skilled trades and apprenticeships, certifications and technical training, and military service.

The production brand assets are `careershield-logo.png` for the horizontal navigation lockup and `careershield-icon.png` for the browser icon.

`legal.html` contains the paid-beta Privacy Notice, Terms of Use, personalized-report Refund Policy, and AI Guide disclosure. These are operational drafts, not a substitute for review by a qualified attorney before broad commercial launch.

## V4 highlights

- A single guided builder adapts its questions to all four path types.
- Military paths use the official O*NET Military Occupational Classification crosswalk, with branch, enlisted/officer/warrant track, specialty-code search, and linked civilian careers.
- Military comparisons include pay grade, basic pay, housing and food allowances, special pay, accession bonus, service commitment, and full estimated GI Bill value.
- Skilled-trades comparisons model hourly entry pay, progressive wage steps, paid hours, journey-level wages, program duration, tools, classroom fees, licensing costs, and employer or union support.
- Certification and technical-training comparisons model credential type, tuition, exams, materials, renewal costs, reimbursement, completion likelihood, verified related-job placement, target salary, and fallback earnings.
- Mixed paths are ranked on expected financial outcome, time to earnings, debt and upfront cost, employment demand, AI resilience, and career flexibility.
- Every result exposes all six factor scores and the 5-year earnings estimate behind the comparison.
- Live College Scorecard school search and O*NET occupation data remain server-side through the existing Netlify Functions.
- Comparisons remain available device-local in browser `localStorage` for signed-out visitors.
- Netlify Identity adds email/password account creation, confirmation-link handling, login, and logout. Signed-in users securely synchronize up to four comparisons through an authenticated Netlify Function and a user-specific Netlify Blobs record.
- The account dashboard lets signed-in customers reopen, rename, duplicate, or delete saved paths, erase synchronized plan data, and view verified personalized-report purchases.
- Signed-in report checkout now uses a signed `client_reference_id`. A signature-verified Stripe webhook stores verified report purchases in an account-specific Netlify Blobs record and displays them in the dashboard.
- The existing Netlify form, styling system, headers, redirects, and deployment model are preserved.
- A $49 personalized Decision Report offer uses a Stripe-hosted Payment Link, avoiding a custom payment backend.
- The CareerShield Guide uses the OpenAI Responses API from a server-side Netlify Function to explain saved comparisons and challenge assumptions without exposing credentials in the browser.

## Deploy to Netlify

Deploy this folder from a Git repository or with the Netlify CLI. In Netlify project environment variables, configure:

- `DATA_GOV_API_KEY` for College Scorecard
- `ONET_API_KEY` for O*NET Web Services v2
- `OPENAI_API_KEY` for the CareerShield Guide
- `STRIPE_WEBHOOK_SECRET` from the live Stripe webhook endpoint (`whsec_...`)
- `STRIPE_CHECKOUT_REFERENCE_SECRET`, a private random value of at least 32 characters used to prevent account-reference tampering
- `STRIPE_PAYMENT_LINK_URL` is optional. When present, checkout uses that Stripe-hosted Payment Link; when removed, checkout automatically returns to the built-in live $49.99 link. This is intended for a short, controlled 50-cent live webhook test.

Then redeploy. Enable Netlify form detection if you want submissions from the `careershield-interest` form.

Netlify Identity must also be enabled under **Project configuration > Identity**. Registration should be set to **Open** if customers may create their own accounts. Netlify runs `npm run build` during deployment to bundle the official `@netlify/identity` browser package into `auth.bundle.js`.

## Stripe report-order webhook

After deploying, create a live Stripe webhook/event destination pointing to:

`https://YOUR-CAREERSHIELD-DOMAIN/api/stripe-webhook`

Subscribe to:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`

Reveal the endpoint signing secret in Stripe and save it in Netlify as `STRIPE_WEBHOOK_SECRET`. Create a separate random secret of at least 32 characters and save it as `STRIPE_CHECKOUT_REFERENCE_SECRET`, then redeploy. Never put either secret in GitHub or browser code.

The checkout endpoint requires a valid Netlify Identity session, locks the Stripe checkout email to the account email, and signs the customer reference. The webhook reads the unmodified request body, verifies the Stripe signature with a five-minute tolerance, validates the signed customer reference, and performs an idempotent update keyed by Stripe Checkout Session ID.

## Local development

Install Node.js and the Netlify CLI, authenticate, and run `npm run dev`. Opening `index.html` directly displays the interface, but live searches require the Netlify Functions runtime and the two environment variables.

## Scoring model

The composite score uses these weights: financial outcome 28%, time to earnings 17%, debt and upfront cost 18%, employment demand 15%, AI resilience 12%, and career flexibility 10%.

Financial outcome estimates earnings over the first five years from the user’s timeline and in-training income, minus net path cost and a simple debt financing drag. Employment demand uses O*NET outlook signals. AI resilience uses a transparent prototype task-text heuristic that favors physical, diagnostic, interpersonal, safety, and field work and discounts routine clerical work. Career flexibility uses related occupations and employing industries returned by O*NET. Missing labor data receives a neutral value.

All results are directional decision support, not financial advice, an insurance offer, or a guarantee of employment or earnings.

## AI guide

The AI guide calls `/api/assistant`, which uses `OPENAI_API_KEY` only inside the Netlify Function. The browser sends the user’s question and up to four locally saved comparison objects. The guide is instructed to use only that supplied comparison data, distinguish estimates from guarantees, ask users to verify unsupported facts, and avoid presenting itself as a financial adviser, recruiter, school, insurer, or government representative. The current model is `gpt-5-mini`, with short response limits to control cost.

## Paid report checkout

The purchase button uses a live Stripe Payment Link for the $49.99 personalized report, plus applicable tax calculated at checkout. Stripe hosts the checkout and processes payment details. Customer fulfillment is currently manual and promises delivery within three business days after assumptions are confirmed.

The military search uses the same `ONET_API_KEY`; no additional military-data credential is required. Supported branches are Army, Air Force, Navy, Marine Corps, Coast Guard, and Space Force.

Military compensation uses official 2026 starting-service DFAS basic pay, 2026 BAS, and the DoD all-location BAH file. CareerShield maps duty ZIP code to the appropriate Military Housing Area, then selects the pay-grade and dependency-status rate. Government housing, overseas assignments, rate protection, special circumstances, bonuses, and specialty pay still require confirmation through the service and written offer. Education benefit value assumes full use and still depends on qualifying service; users must verify eligibility and current VA rates.

The skilled-trades model follows the U.S. Department of Labor Registered Apprenticeship structure: apprentices are paid employees and receive progressive wage increases as skills and productivity grow. The model divides the program into editable wage steps, calculates earnings month by month, applies journey-level wages after completion, and deducts net tools, instruction, and licensing costs. Actual schedules and requirements vary by sponsor, agreement, occupation, and location.

The certification and technical-training model probability-adjusts earnings by multiplying personal completion likelihood by the verified related-job placement rate. Users should prefer state or federal Eligible Training Provider performance data and independently verified outcomes over marketing claims. The model includes fallback earnings when completion or related placement does not occur, plus expected renewal and continuing-education costs.
