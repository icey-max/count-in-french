import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  NUMBER_CARDS,
  buildNumberCard,
  normalizeFrenchAnswer,
  normalizeNumberAnswer,
  numberToFrench,
  validateAnswer,
} from '../src/numbers.js';

test('generates all French number spellings from 1 to 100', () => {
  assert.equal(NUMBER_CARDS.length, 100);
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

test('normalizes French answers according to PRD rules', () => {
  assert.equal(normalizeFrenchAnswer(' QUARANTE-DEUX '), 'quarantedeux');
  assert.equal(normalizeFrenchAnswer('quarante deux'), 'quarantedeux');
  assert.equal(normalizeFrenchAnswer('quarante-deux'), 'quarantedeux');
  assert.equal(normalizeFrenchAnswer('quarantedeux'), 'quarantedeux');
});

test('validates French text without accepting numerals for text prompts', () => {
  const card = NUMBER_CARDS[41];
  assert.equal(validateAnswer('quarante deux', card, 'french'), true);
  assert.equal(validateAnswer('42', card, 'french'), false);
});

test('validates number prompts without accepting French words', () => {
  const card = NUMBER_CARDS[41];
  assert.equal(normalizeNumberAnswer(' 42 '), 42);
  assert.equal(validateAnswer('42', card, 'number'), true);
  assert.equal(validateAnswer('quarante-deux', card, 'number'), false);
});

test('rejects numbers outside the supported range', () => {
  assert.throws(() => numberToFrench(-1), /0 to 100/);
  assert.throws(() => numberToFrench(101), /0 to 100/);
});

test('has non-empty audio files for every supported number', () => {
  for (const card of NUMBER_CARDS) {
    const audioPath = join('assets', 'audio', `${card.number}.mp3`);
    assert.equal(existsSync(audioPath), true, `${audioPath} is missing`);
    assert.ok(statSync(audioPath).size > 0, `${audioPath} is empty`);
  }
});
