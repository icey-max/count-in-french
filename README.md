# French Numbers Mastery

French Numbers Mastery is a free browser app for learning French numbers from 1 to 100. It helps learners practice the sound, spelling, and structure of French numbers with short lessons, audio prompts, recall drills, adaptive review, and a final exam.

Live app: https://icey-max.github.io/french-numbers-mastery/

## What You Practice

- French numbers from 1 to 100.
- Listening comprehension with audio prompts.
- Spelling from digits into French.
- Fast recall from French back to numbers.
- The difficult 70s, 80s, and 90s patterns.
- Mixed review before a final mastery check.

French counting has a few patterns that feel unusual to English speakers. The app gives extra attention to forms such as `soixante-dix`, `quatre-vingts`, and `quatre-vingt-dix` so learners can understand the logic instead of memorizing each number as an isolated word.

## How It Works

The course is split into ten levels. Each level introduces a small range of numbers, then asks the learner to recall them in different directions: seeing digits, writing French, hearing audio, and typing the number. Review sessions recycle missed and low-streak numbers so practice time goes toward what still needs work.

Progress is stored locally in the browser. There is no account system and no backend service.

## Run Locally

Requirements:

- Node.js 22 or newer.
- A modern browser.

Start the local server:

```bash
npm run dev
```

Run the test suite:

```bash
npm test
```

Build the static site:

```bash
npm run build
```

The build command writes a static production artifact that can be deployed directly to GitHub Pages.

## Branch Workflow

This repository uses two long-lived branches:

- `dev` is the default development branch.
- `live` is the production branch used by GitHub Pages.

Typical release flow:

```bash
git switch dev
npm test
npm run build
git switch live
git merge dev
git push origin live
```

Pushing to `live` runs the GitHub Pages workflow. The workflow tests the app, builds the static site, uploads the artifact, and deploys it to Pages.

## Project Status

The current version focuses on numbers 1-100, browser-based progress, audio practice, and static hosting. Future improvements could include more pronunciation guidance, additional review modes, and broader French beginner drills.

## License

No license has been selected yet. Add one before inviting outside contributions.
