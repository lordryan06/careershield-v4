# CareerShield V4.1

This update turns CareerShield into a clearer student planning experience while preserving the live Stripe checkout, College Scorecard and O*NET functions, Netlify deployment, existing styling system, and protected OpenAI assistant.

## Included

- Clear first-screen explanation and start button.
- Searchable, visually consistent school, provider, career, and military selectors.
- College degree/program-length and in-state/out-of-state tuition selectors.
- Automatic school tuition estimate using College Scorecard data.
- Scholarships and grants hidden in an optional expandable section.
- Plain-language information buttons for the six score factors and key financial terms.
- Color-coded factor bars and a written explanation of every recommendation.
- Approximate 10-year student-debt payment guidance using a disclosed 6.5% example rate.
- Official next-step links for schools, registered apprenticeships, training programs, and military recruiting.
- A printable Build My Plan summary with cost, debt, starting pay, and next actions.
- Existing $49.99 plus applicable tax live Stripe checkout.
- Existing 10-answer browser limit and Netlify server-side AI rate limit.

## GitHub replacement

Replace these files at their exact destinations:

- `index.html`
- `styles.css`
- `app.js`
- `netlify/functions/schools.js`
- `netlify/functions/assistant.js`

Commit directly to `main` with:

`Launch CareerShield V4.1 student planning experience`

After Netlify publishes, test one path in each of the four categories. For college, switch between in-state and out-of-state tuition and confirm the estimated total changes. Also confirm the deploy log accepts the `/api/assistant` rate-limit rule.

College totals are estimates based on published annual tuition multiplied by the selected program length. They are not degree-specific price quotes and may exclude fees, housing, books, and individual aid.
