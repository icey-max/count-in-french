import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  ACTIVE_FRENCH_LOCALE,
  ACTIVE_FRENCH_LOCALE_ID,
  FRENCH_LOCALES,
  NUMBER_CARDS,
  buildNumberCard,
  normalizeFrenchAnswer,
  normalizeNumberAnswer,
  numberToFrench,
  validateAnswer,
} from '../src/numbers.js';
import {
  ESSENTIAL_GROUPS,
  ESSENTIAL_ITEMS,
  buildEssentialChallengeQuestions,
  getEssentialAnswerKind,
  isCalendarSequenceGroup,
  shouldAutoPlayEssentialQuestion,
  validateEssentialAnswer,
} from '../src/essentials.js';

test('declares Standard French as the active supported locale', () => {
  assert.equal(ACTIVE_FRENCH_LOCALE_ID, 'fr-standard');
  assert.equal(ACTIVE_FRENCH_LOCALE.shortLabel, 'FR Standard');
  assert.equal(FRENCH_LOCALES.length, 4);
  assert.deepEqual(
    FRENCH_LOCALES.filter((locale) => locale.available).map((locale) => locale.id),
    ['fr-standard'],
  );
});

test('generates the full Standard French number practice deck', () => {
  assert.equal(NUMBER_CARDS.length, 150);
  assert.equal(numberToFrench(1), 'un');
  assert.equal(numberToFrench(17), 'dix-sept');
  assert.equal(numberToFrench(21), 'vingt-et-un');
  assert.equal(numberToFrench(42), 'quarante-deux');
  assert.equal(numberToFrench(70), 'soixante-dix');
  assert.equal(numberToFrench(71), 'soixante-et-onze');
  assert.equal(numberToFrench(80), 'quatre-vingts');
  assert.equal(numberToFrench(81), 'quatre-vingt-un');
  assert.equal(numberToFrench(90), 'quatre-vingt-dix');
  assert.equal(numberToFrench(99), 'quatre-vingt-dix-neuf');
  assert.equal(numberToFrench(100), 'cent');
});

test('generates Standard French spellings for large number patterns', () => {
  assert.equal(numberToFrench(101), 'cent un');
  assert.equal(numberToFrench(200), 'deux cents');
  assert.equal(numberToFrench(201), 'deux cent un');
  assert.equal(numberToFrench(999), 'neuf cent quatre-vingt-dix-neuf');
  assert.equal(numberToFrench(1000), 'mille');
  assert.equal(numberToFrench(2345), 'deux mille trois cent quarante-cinq');
  assert.equal(numberToFrench(10000), 'dix mille');
  assert.equal(numberToFrench(100000), 'cent mille');
  assert.equal(numberToFrench(456789), 'quatre cent cinquante-six mille sept cent quatre-vingt-neuf');
  assert.equal(numberToFrench(700001), 'sept cent mille un');
  assert.equal(numberToFrench(80000), 'quatre-vingt mille');
  assert.equal(numberToFrench(1000000), 'un million');
  assert.equal(numberToFrench(2000000), 'deux millions');
  assert.equal(numberToFrench(1234567), 'un million deux cent trente-quatre mille cinq cent soixante-sept');
  assert.equal(numberToFrench(1000000000), 'un milliard');
  assert.equal(numberToFrench(2000000000), 'deux milliards');
  assert.equal(numberToFrench(1234567890), 'un milliard deux cent trente-quatre millions cinq cent soixante-sept mille huit cent quatre-vingt-dix');
});

test('builds a zero card for missions without adding it to the level deck', () => {
  assert.equal(numberToFrench(0), 'zéro');
  assert.equal(normalizeFrenchAnswer('zéro'), 'zero');
  assert.deepEqual(buildNumberCard(0), {
    number: 0,
    french: 'zéro',
    pronunciation: 'zay-roh',
    levelId: null,
  });
});

test('normalizes Standard French answers according to PRD rules', () => {
  assert.equal(normalizeFrenchAnswer(' QUARANTE-DEUX '), 'quarantedeux');
  assert.equal(normalizeFrenchAnswer('quarante deux'), 'quarantedeux');
  assert.equal(normalizeFrenchAnswer('quarante-deux'), 'quarantedeux');
  assert.equal(normalizeFrenchAnswer('quarantedeux'), 'quarantedeux');
});

test('validates Standard French text without accepting numerals for text prompts', () => {
  const card = NUMBER_CARDS[41];
  assert.equal(validateAnswer('quarante deux', card, 'french'), true);
  assert.equal(validateAnswer('42', card, 'french'), false);
});

test('validates number prompts without accepting Standard French words', () => {
  const card = NUMBER_CARDS[41];
  assert.equal(normalizeNumberAnswer(' 42 '), 42);
  assert.equal(normalizeNumberAnswer('1,234,567'), 1234567);
  assert.equal(validateAnswer('42', card, 'number'), true);
  assert.equal(validateAnswer('quarante-deux', card, 'number'), false);
});

test('rejects numbers outside the supported range', () => {
  assert.throws(() => numberToFrench(-1), /999,999,999,999/);
  assert.throws(() => numberToFrench(1000000000000), /999,999,999,999/);
});

test('has non-empty audio files for every recorded number', () => {
  for (const number of [0, ...NUMBER_CARDS.map((card) => card.number)]) {
    const audioPath = join('assets', 'audio', `${number}.mp3`);
    assert.equal(existsSync(audioPath), true, `${audioPath} is missing`);
    assert.ok(statSync(audioPath).size > 0, `${audioPath} is empty`);
  }
});

test('defines beginner essentials for verbs, prepositions, colors, and days', () => {
  assert.deepEqual(
    ESSENTIAL_GROUPS.map((group) => group.id),
    ['verbs', 'prepositions', 'colors', 'days', 'months'],
  );
  const verbs = ESSENTIAL_GROUPS.find((group) => group.id === 'verbs');
  const prepositions = ESSENTIAL_GROUPS.find((group) => group.id === 'prepositions');
  assert.equal(ESSENTIAL_GROUPS.find((group) => group.id === 'days').illustration, false);
  assert.equal(ESSENTIAL_GROUPS.find((group) => group.id === 'months').illustration, false);
  assert.equal(verbs.items.length, 50);
  assert.equal(prepositions.items.length, 20);
  assert.equal(ESSENTIAL_GROUPS.find((group) => group.id === 'colors').items.length, 16);
  assert.equal(ESSENTIAL_ITEMS.length, 105);
  assert.ok(ESSENTIAL_ITEMS.every((item) => item.id && item.french && item.display && item.english));
  assert.ok([...verbs.items, ...prepositions.items].every((item) => item.example && item.highlight && item.example.includes(item.highlight)));
  assert.ok(
    verbs.items.every((item) =>
      ['je', 'tu', 'il', 'nous', 'vous', 'ils'].every((pronoun) => item.conjugation?.[pronoun]),
    ),
  );
});

test('builds extensive calendar challenges with listening, dictation, translation, and final sequence modes', () => {
  const days = ESSENTIAL_GROUPS.find((group) => group.id === 'days');
  const months = ESSENTIAL_GROUPS.find((group) => group.id === 'months');

  for (const group of [days, months]) {
    assert.equal(isCalendarSequenceGroup(group), true);
    const questions = buildEssentialChallengeQuestions(group);
    assert.equal(questions.length, group.items.length * 3 + 1);
    assert.deepEqual(
      [...new Set(questions.map((question) => question.mode))],
      ['listening', 'dictation', 'translate', 'sequence'],
    );
    assert.equal(questions.filter((question) => question.mode === 'translate').every((question) => getEssentialAnswerKind(question) === 'english'), true);
    assert.equal(questions.filter((question) => question.mode !== 'sequence').every(shouldAutoPlayEssentialQuestion), true);
    assert.equal(shouldAutoPlayEssentialQuestion(questions.at(-1)), false);
    assert.equal(getEssentialAnswerKind(questions.at(-1)), 'sequence');
  }
});

test('validates day challenge answers in French and English directions', () => {
  const lundi = ESSENTIAL_ITEMS.find((item) => item.id === 'lundi');
  assert.equal(validateEssentialAnswer('lundi', lundi, 'french'), true);
  assert.equal(validateEssentialAnswer('Monday', lundi, 'english'), true);
  assert.equal(validateEssentialAnswer('lundi', lundi, 'english'), false);
  assert.equal(validateEssentialAnswer('Monday', lundi, 'french'), false);
});

test('validates the final day sequence as one French day per line', () => {
  const days = ESSENTIAL_GROUPS.find((group) => group.id === 'days');
  const ordered = days.items.map((item) => item.display).join('\n');
  const swapped = ['lundi', 'mercredi', 'mardi', 'jeudi', 'vendredi', 'samedi', 'dimanche'].join('\n');
  assert.equal(validateEssentialAnswer(ordered, days.items, 'sequence'), true);
  assert.equal(validateEssentialAnswer(swapped, days.items, 'sequence'), false);
  assert.equal(validateEssentialAnswer('lundi mardi mercredi jeudi vendredi samedi dimanche', days.items, 'sequence'), false);
});

test('validates the final month sequence as one French month per line', () => {
  const months = ESSENTIAL_GROUPS.find((group) => group.id === 'months');
  const ordered = months.items.map((item) => item.display).join('\n');
  const swapped = ['janvier', 'mars', 'février', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'].join('\n');
  assert.equal(validateEssentialAnswer(ordered, months.items, 'sequence'), true);
  assert.equal(validateEssentialAnswer(swapped, months.items, 'sequence'), false);
  assert.equal(validateEssentialAnswer(months.items.map((item) => item.display).join(' '), months.items, 'sequence'), false);
});

test('has non-empty Sound of Text audio files for every essential item', () => {
  for (const item of ESSENTIAL_ITEMS) {
    const audioPath = join('assets', 'audio', 'essentials', `${item.id}.mp3`);
    assert.equal(existsSync(audioPath), true, `${audioPath} is missing`);
    assert.ok(statSync(audioPath).size > 0, `${audioPath} is empty`);
  }
});
