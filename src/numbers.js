const BASE_LEVELS = Array.from({ length: 10 }, (_, index) => {
  const start = index * 10 + 1;
  const end = start + 9;
  return {
    id: index + 1,
    title: `Level ${index + 1}`,
    range: `${start}-${end}`,
    start,
    end,
    cardNumbers: Array.from({ length: 10 }, (_, cardIndex) => start + cardIndex),
  };
});

const LARGE_NUMBER_LEVELS = [
  {
    id: 11,
    title: 'Level 11',
    range: 'Hundreds',
    start: 101,
    end: 999,
    cardNumbers: [101, 110, 125, 199, 200, 201, 250, 371, 680, 999],
  },
  {
    id: 12,
    title: 'Level 12',
    range: 'Thousands',
    start: 1000,
    end: 9999,
    cardNumbers: [1000, 1001, 1010, 1100, 1500, 2000, 2345, 5001, 8060, 9999],
  },
  {
    id: 13,
    title: 'Level 13',
    range: '10k-999k',
    start: 10000,
    end: 999999,
    cardNumbers: [10000, 21000, 25000, 99999, 100000, 101000, 125000, 456789, 700001, 999999],
  },
  {
    id: 14,
    title: 'Level 14',
    range: 'Millions',
    start: 1000000,
    end: 999999999,
    cardNumbers: [1000000, 2000000, 1000001, 1020000, 1234567, 10000000, 25000000, 100000000, 250000001, 999999999],
  },
  {
    id: 15,
    title: 'Level 15',
    range: 'Billions',
    start: 1000000000,
    end: 999999999999,
    cardNumbers: [1000000000, 2000000000, 1000000001, 1010000000, 1234567890, 10000000000, 25000000000, 100000000000, 250000000001, 999999999999],
  },
];

export const LEVELS = [...BASE_LEVELS, ...LARGE_NUMBER_LEVELS];

const MAX_SUPPORTED_NUMBER = 999999999999;

const SIMPLE_NUMBERS = new Map([
  [0, 'zéro'],
  [1, 'un'],
  [2, 'deux'],
  [3, 'trois'],
  [4, 'quatre'],
  [5, 'cinq'],
  [6, 'six'],
  [7, 'sept'],
  [8, 'huit'],
  [9, 'neuf'],
  [10, 'dix'],
  [11, 'onze'],
  [12, 'douze'],
  [13, 'treize'],
  [14, 'quatorze'],
  [15, 'quinze'],
  [16, 'seize'],
]);

const TENS = new Map([
  [20, 'vingt'],
  [30, 'trente'],
  [40, 'quarante'],
  [50, 'cinquante'],
  [60, 'soixante'],
]);

const PRONUNCIATION = new Map([
  [0, 'zay-roh'],
  [1, 'uhn'],
  [2, 'duh'],
  [3, 'twah'],
  [4, 'katr'],
  [5, 'sank'],
  [6, 'sees'],
  [7, 'set'],
  [8, 'weet'],
  [9, 'nuhf'],
  [10, 'dees'],
  [11, 'onz'],
  [12, 'dooz'],
  [13, 'trehz'],
  [14, 'kah-torz'],
  [15, 'kanz'],
  [16, 'sehz'],
  [20, 'van'],
  [30, 'tront'],
  [40, 'kah-rahnt'],
  [50, 'san-kahnt'],
  [60, 'swah-sahnt'],
  [80, 'katr-van'],
  [100, 'sahn'],
]);

export const QUESTION_TYPES = [
  {
    id: 'number-to-french',
    label: 'Number -> French',
    promptLabel: 'Write the French spelling',
    inputMode: 'text',
    expectedKind: 'french',
  },
  {
    id: 'french-to-number',
    label: 'French -> Number',
    promptLabel: 'Write the number',
    inputMode: 'numeric',
    expectedKind: 'number',
  },
  {
    id: 'audio-to-number',
    label: 'Audio -> Number',
    promptLabel: 'Listen and write the number',
    inputMode: 'numeric',
    expectedKind: 'number',
    audioOnly: true,
  },
  {
    id: 'audio-to-french',
    label: 'Audio -> French',
    promptLabel: 'Listen and write the French spelling',
    inputMode: 'text',
    expectedKind: 'french',
    audioOnly: true,
  },
];

export function numberToFrench(number) {
  if (!Number.isInteger(number) || number < 0 || number > MAX_SUPPORTED_NUMBER) {
    throw new RangeError('Count in French supports numbers from 0 to 999,999,999,999.');
  }

  if (number === 0) return SIMPLE_NUMBERS.get(0);
  if (number >= 1000000000) return composeScale(number, 1000000000, 'milliard');
  if (number >= 1000000) return composeScale(number, 1000000, 'million');
  if (number >= 1000) return composeThousands(number);
  if (number >= 100) return composeHundreds(number);
  if (number <= 16) return SIMPLE_NUMBERS.get(number);
  if (number < 20) return `dix-${SIMPLE_NUMBERS.get(number - 10)}`;
  if (number < 70) return composeRegularTens(number);
  if (number < 80) return composeSeventies(number);
  if (number < 90) return composeEighties(number);
  return composeNineties(number);
}

function composeHundreds(number) {
  const hundreds = Math.floor(number / 100);
  const remainder = number % 100;
  const prefix = hundreds === 1 ? 'cent' : `${numberToFrench(hundreds)} cent`;

  if (remainder === 0) return hundreds === 1 ? prefix : `${prefix}s`;
  return `${prefix} ${numberToFrench(remainder)}`;
}

function composeThousands(number) {
  const thousands = Math.floor(number / 1000);
  const remainder = number % 1000;
  const prefix = thousands === 1 ? 'mille' : `${numberToFrenchBeforeMille(thousands)} mille`;

  return remainder === 0 ? prefix : `${prefix} ${numberToFrench(remainder)}`;
}

function numberToFrenchBeforeMille(number) {
  return numberToFrench(number)
    .replace(/cents$/, 'cent')
    .replace(/vingts$/, 'vingt');
}

function composeScale(number, scale, singular) {
  const quantity = Math.floor(number / scale);
  const remainder = number % scale;
  const plural = quantity > 1 ? 's' : '';
  const prefix = `${numberToFrench(quantity)} ${singular}${plural}`;

  return remainder === 0 ? prefix : `${prefix} ${numberToFrench(remainder)}`;
}

function composeRegularTens(number) {
  const ten = Math.floor(number / 10) * 10;
  const unit = number % 10;
  const tenWord = TENS.get(ten);

  if (unit === 0) return tenWord;
  if (unit === 1) return `${tenWord}-et-un`;
  return `${tenWord}-${SIMPLE_NUMBERS.get(unit)}`;
}

function composeSeventies(number) {
  if (number === 71) return 'soixante-et-onze';
  return `soixante-${numberToFrench(number - 60)}`;
}

function composeEighties(number) {
  if (number === 80) return 'quatre-vingts';
  return `quatre-vingt-${numberToFrench(number - 80)}`;
}

function composeNineties(number) {
  return `quatre-vingt-${numberToFrench(number - 80)}`;
}

export function numberToPronunciation(number) {
  if (!Number.isInteger(number) || number < 0 || number > MAX_SUPPORTED_NUMBER) {
    throw new RangeError('Count in French supports numbers from 0 to 999,999,999,999.');
  }

  if (number > 100) return 'Build from the parts';
  if (PRONUNCIATION.has(number)) return PRONUNCIATION.get(number);
  if (number < 20) return `dees-${PRONUNCIATION.get(number - 10)}`;
  if (number < 70) return pronounceRegularTens(number);
  if (number < 80) return pronounceCompound(60, number - 60, number === 71);
  if (number === 80) return PRONUNCIATION.get(80);
  if (number < 90) return `katr-van-${numberToPronunciation(number - 80)}`;
  return `katr-van-${numberToPronunciation(number - 80)}`;
}

function pronounceRegularTens(number) {
  const ten = Math.floor(number / 10) * 10;
  const unit = number % 10;
  const tenGuide = PRONUNCIATION.get(ten);

  if (unit === 0) return tenGuide;
  if (unit === 1) return `${tenGuide}-ay-uhn`;
  return `${tenGuide}-${PRONUNCIATION.get(unit)}`;
}

function pronounceCompound(base, remainder, withEt = false) {
  const connector = withEt ? '-ay-' : '-';
  return `${PRONUNCIATION.get(base)}${connector}${numberToPronunciation(remainder)}`;
}

export function normalizeFrenchAnswer(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[\s\-']/g, '');
}

export function normalizeNumberAnswer(value) {
  const normalized = String(value).trim().replace(/[,\s._]/g, '');
  if (!/^\d+$/.test(normalized)) return Number.NaN;
  return Number(normalized);
}

export function validateAnswer(value, card, expectedKind) {
  if (expectedKind === 'number') {
    return normalizeNumberAnswer(value) === card.number;
  }

  return normalizeFrenchAnswer(value) === normalizeFrenchAnswer(card.french);
}

export function buildNumberCards() {
  return LEVELS.flatMap((level) => level.cardNumbers.map(buildNumberCard));
}

export function buildNumberCard(number) {
  if (!Number.isInteger(number) || number < 0 || number > MAX_SUPPORTED_NUMBER) {
    throw new RangeError('Count in French supports numbers from 0 to 999,999,999,999.');
  }

  return {
    number,
    french: numberToFrench(number),
    pronunciation: numberToPronunciation(number),
    levelId: number === 0 ? null : getLevelIdForNumber(number),
  };
}

function getLevelIdForNumber(number) {
  return LEVELS.find((level) => level.cardNumbers.includes(number))?.id || null;
}

export const NUMBER_CARDS = buildNumberCards();

export const PATTERN_LESSONS = {
  7: {
    eyebrow: 'Pattern lesson: 70 begins the twist',
    title: 'French builds 70 as 60 + 10',
    explanation:
      'Instead of a new word for seventy, French says soixante-dix: sixty-ten. This is the bridge into 70-79.',
    examples: [
      { number: 70, math: '60 + 10', french: numberToFrench(70) },
      { number: 71, math: '60 + 11', french: numberToFrench(71) },
      { number: 72, math: '60 + 12', french: numberToFrench(72) },
    ],
  },
  8: {
    eyebrow: 'Pattern lesson: 70-79 and 80',
    title: 'Finish the sixties-plus pattern, then meet four twenties',
    explanation:
      'The 70s continue as 60 plus a teen number. Then 80 becomes quatre-vingts, literally four twenties.',
    examples: [
      { number: 79, math: '60 + 19', french: numberToFrench(79) },
      { number: 80, math: '4 x 20', french: numberToFrench(80) },
    ],
  },
  9: {
    eyebrow: 'Pattern lesson: 80-89 and 90',
    title: 'After 80, count upward from four twenties',
    explanation:
      'For 81-89, French keeps quatre-vingt and adds the unit. At 90, it becomes quatre-vingt-dix: eighty-ten.',
    examples: [
      { number: 81, math: '80 + 1', french: numberToFrench(81) },
      { number: 89, math: '80 + 9', french: numberToFrench(89) },
      { number: 90, math: '80 + 10', french: numberToFrench(90) },
    ],
  },
  10: {
    eyebrow: 'Pattern lesson: 90-99',
    title: 'The 90s are 80 plus teen numbers',
    explanation:
      'French does not use a separate word for ninety. It says quatre-vingt plus ten through nineteen.',
    examples: [
      { number: 91, math: '80 + 11', french: numberToFrench(91) },
      { number: 95, math: '80 + 15', french: numberToFrench(95) },
      { number: 99, math: '80 + 19', french: numberToFrench(99) },
    ],
  },
  11: {
    eyebrow: 'Pattern lesson: hundreds',
    title: 'Cent changes only when it stands alone',
    explanation:
      'Use cent for one hundred. Add an s only for exact hundreds like deux cents; remove it when another number follows.',
    examples: [
      { number: 100, math: '100', french: numberToFrench(100) },
      { number: 200, math: '2 x 100', french: numberToFrench(200) },
      { number: 201, math: '200 + 1', french: numberToFrench(201) },
    ],
  },
  12: {
    eyebrow: 'Pattern lesson: thousands',
    title: 'Mille does not need un and does not change',
    explanation:
      'French says mille for 1,000, then adds the rest. For higher thousands, put the number before mille.',
    examples: [
      { number: 1000, math: '1,000', french: numberToFrench(1000) },
      { number: 2000, math: '2 x 1,000', french: numberToFrench(2000) },
      { number: 2345, math: '2,000 + 345', french: numberToFrench(2345) },
    ],
  },
  13: {
    eyebrow: 'Pattern lesson: large thousands',
    title: '10,000 and 100,000 are still built with mille',
    explanation:
      'Once mille is familiar, ten-thousands and hundred-thousands are just a larger number before mille.',
    examples: [
      { number: 10000, math: '10 x 1,000', french: numberToFrench(10000) },
      { number: 100000, math: '100 x 1,000', french: numberToFrench(100000) },
      { number: 456789, math: '456,000 + 789', french: numberToFrench(456789) },
    ],
  },
  14: {
    eyebrow: 'Pattern lesson: millions',
    title: 'Million is a noun, so it can become plural',
    explanation:
      'Say un million for 1,000,000 and add s for plural millions. Then attach the thousands and hundreds that follow.',
    examples: [
      { number: 1000000, math: '1,000,000', french: numberToFrench(1000000) },
      { number: 2000000, math: '2 x 1,000,000', french: numberToFrench(2000000) },
      { number: 1234567, math: '1,000,000 + 234,567', french: numberToFrench(1234567) },
    ],
  },
  15: {
    eyebrow: 'Pattern lesson: billions',
    title: 'English billion is French milliard',
    explanation:
      'French uses milliard for 1,000,000,000. Build the full number as milliards, millions, mille, then hundreds.',
    examples: [
      { number: 1000000000, math: '1,000,000,000', french: numberToFrench(1000000000) },
      { number: 2000000000, math: '2 x 1,000,000,000', french: numberToFrench(2000000000) },
      { number: 1234567890, math: '1B + 234M + 567k + 890', french: numberToFrench(1234567890) },
    ],
  },
};
