import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'dist');
const defaultSiteUrl = 'https://icey-max.github.io/count-in-french/';
const siteUrl = normalizeSiteUrl(process.env.SITE_URL || defaultSiteUrl);
const buildDate = new Date().toISOString().slice(0, 10);

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

copyDirectory('assets');
copyDirectory('src');
copyPublicFiles();
writeText('index.html', renderTemplate(readText('index.html')));
writeText('404.html', renderTemplate(readText('index.html')));
writeText('.nojekyll', '');
writeText('robots.txt', renderRobots());
writeText('sitemap.xml', renderSitemap());
writeText('llms.txt', renderLlmsText());

console.log(`Built static site for ${siteUrl}`);

function copyDirectory(name) {
  cpSync(join(root, name), join(outDir, name), { recursive: true });
}

function copyPublicFiles() {
  const publicDir = join(root, 'public');
  if (!existsSync(publicDir)) return;

  for (const entry of readdirSync(publicDir)) {
    cpSync(join(publicDir, entry), join(outDir, entry), { recursive: true });
  }
}

function readText(path) {
  return readFileSync(join(root, path), 'utf8');
}

function writeText(path, value) {
  writeFileSync(join(outDir, path), value);
}

function renderTemplate(value) {
  return value.replaceAll('__SITE_URL__', siteUrl).replaceAll('__BUILD_DATE__', buildDate);
}

function normalizeSiteUrl(value) {
  const url = new URL(value);
  if (!url.pathname.endsWith('/')) url.pathname = `${url.pathname}/`;
  url.hash = '';
  url.search = '';
  return url.toString();
}

function renderRobots() {
  return `User-agent: *
Allow: /

Sitemap: ${siteUrl}sitemap.xml
`;
}

function renderSitemap() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${siteUrl}</loc>
    <lastmod>${buildDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`;
}

function renderLlmsText() {
  return `# Count in French

> Free browser-based trainer for learning Standard French numbers from 1 through billions plus common verbs, prepositions, colors, days, and months with audio recall drills.

Website: ${siteUrl}

## What it teaches

- Standard French numbers 1 through billions
- Standard French number spelling, including 70-79, 80-89, 90-99, hundreds, thousands, millions, and billions
- Standard French number pronunciation through audio prompts
- Fast recall from digits to Standard French and from spoken Standard French to numbers
- 50 high-frequency French verbs with present-tense support and highlighted examples
- 20 beginner French prepositions with highlighted examples
- Useful colors, days of the week, and months of the year

## Useful entry points

- ${siteUrl} - Interactive Count in French course
- ${siteUrl}sitemap.xml - XML sitemap
- ${siteUrl}robots.txt - Crawler policy

## Content notes

The site is a static educational web app. It currently teaches the FR Standard locale only. Belgian French, Swiss French, and Canadian French are shown in the app as disabled future locale options. It does not require an account, does not use a backend, and stores learner progress locally in the browser.
`;
}
