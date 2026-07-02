# French Numbers Mastery - Learn French Numbers 1-100

French Numbers Mastery is a free interactive web app for learning French numbers from 1 to 100. It combines audio pronunciation, spelling practice, listening recall, adaptive review, and a final exam so learners can move beyond memorizing a list and build fast number recognition.

Live site: https://icey-max.github.io/french-numbers-mastery/

## Why Use It?

French numbers become tricky around 70, 80, and 90. This trainer focuses on the patterns that English speakers often miss: `soixante-dix`, `quatre-vingts`, and `quatre-vingt-dix`. Learners practice numbers by seeing digits, hearing audio, typing French spellings, and reviewing missed answers until recall becomes automatic.

Use it to:

- Learn French numbers 1 to 100 in ten focused levels.
- Hear audio pronunciation for every number from 1 to 100.
- Practice French number spelling with forgiving accent and hyphen handling.
- Train listening recall by typing the number after hearing French audio.
- Review weak numbers with adaptive practice.
- Take a final exam when every level is complete.

## Learning Flow

The app starts with structured lessons, then asks learners to recall answers actively. Each level introduces ten numbers, checks the spelling and listening directions, and unlocks review modes as progress improves. The final exam mixes the full 1-100 range so learners can test real fluency rather than short-term recognition.

Progress is saved locally in the browser. No account, backend, or tracking service is required.

## Development

Requirements:

- Node.js 22 or newer.
- A modern browser with JavaScript enabled.

Run locally:

```bash
npm run dev
```

Run tests:

```bash
npm test
```

Build the static GitHub Pages artifact:

```bash
npm run build
```

The build command packages only the static site assets, injects the production URL into page metadata, and generates crawler files for the deployed site.

## Branch and Deploy Workflow

This repository uses two long-lived branches:

- `dev` is the working branch for changes.
- `live` is the production branch. Pushing to `live` deploys GitHub Pages.

Recommended release flow:

```bash
git switch dev
npm test
npm run build
git switch live
git merge dev
git push origin live
```

In GitHub, configure Pages with `GitHub Actions` as the source. The deploy workflow tests the app, builds the static artifact, uploads it to GitHub Pages, and deploys only after the build job succeeds.

## Search and AI Discovery

The deployed site is prepared for search indexing and AI-assisted discovery with:

- A search-focused title and description for "learn French numbers" and "French numbers 1 to 100".
- Canonical URL metadata generated from the GitHub Pages URL.
- Open Graph and Twitter metadata for shared previews.
- Schema.org structured data describing the app as a free educational web application and course.
- `robots.txt`, `sitemap.xml`, and `llms.txt` generated during the production build.
- Crawlable fallback HTML that explains the course before JavaScript runs.

These files do not guarantee ranking, but they make the site easier for Google, other search engines, and AI search systems to understand and crawl.

## License

No license has been selected yet. Add one before inviting outside contributions.
