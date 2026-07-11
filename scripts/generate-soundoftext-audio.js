import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESSENTIAL_ITEMS } from '../src/essentials.js';
import { NUMBER_CARDS, numberToFrench } from '../src/numbers.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const audioDir = join(root, 'assets', 'audio');
const essentialsAudioDir = join(audioDir, 'essentials');
const apiBase = 'https://api.soundoftext.com';
const voice = 'fr-FR';
const delayMs = Number(process.env.SOUNDOFTEXT_DELAY_MS || 1200);
const pollDelayMs = Number(process.env.SOUNDOFTEXT_POLL_DELAY_MS || 1000);
const maxPolls = Number(process.env.SOUNDOFTEXT_MAX_POLLS || 20);

const targetNumbers = [0, ...NUMBER_CARDS.map((card) => card.number)];

await mkdir(audioDir, { recursive: true });
await mkdir(essentialsAudioDir, { recursive: true });

for (const number of targetNumbers) {
  const audioPath = join(audioDir, `${number}.mp3`);
  if (existsSync(audioPath)) {
    console.log(`skip ${number}.mp3`);
    continue;
  }

  const text = numberToFrench(number);
  console.log(`create ${number}.mp3: ${text}`);
  const soundId = await createSound(text);
  const location = await waitForSound(soundId);
  const audio = await fetchArrayBuffer(location);
  await writeFile(audioPath, Buffer.from(audio));
  await sleep(delayMs);
}

for (const item of ESSENTIAL_ITEMS) {
  const audioPath = join(essentialsAudioDir, `${item.id}.mp3`);
  if (existsSync(audioPath)) {
    console.log(`skip essentials/${item.id}.mp3`);
    continue;
  }

  console.log(`create essentials/${item.id}.mp3: ${item.french}`);
  const soundId = await createSound(item.french);
  const location = await waitForSound(soundId);
  const audio = await fetchArrayBuffer(location);
  await writeFile(audioPath, Buffer.from(audio));
  await sleep(delayMs);
}

async function createSound(text) {
  const response = await fetch(`${apiBase}/sounds`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      engine: 'Google',
      data: { text, voice },
    }),
  });
  const body = await response.json();

  if (!response.ok || !body.success) {
    throw new Error(`Sound of Text create failed for "${text}": ${body.message || response.statusText}`);
  }

  return body.id;
}

async function waitForSound(id) {
  for (let attempt = 1; attempt <= maxPolls; attempt += 1) {
    const response = await fetch(`${apiBase}/sounds/${id}`);
    const body = await response.json();

    if (body.status === 'Done') return body.location;
    if (body.status === 'Error') throw new Error(`Sound of Text failed for ${id}: ${body.message}`);

    await sleep(pollDelayMs);
  }

  throw new Error(`Timed out waiting for Sound of Text sound ${id}`);
}

async function fetchArrayBuffer(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`MP3 download failed: ${response.status} ${response.statusText}`);
  return response.arrayBuffer();
}

function sleep(ms) {
  return new Promise((resolveSleep) => {
    setTimeout(resolveSleep, ms);
  });
}
