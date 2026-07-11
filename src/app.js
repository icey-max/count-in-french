import {
  ACTIVE_FRENCH_LOCALE,
  FRENCH_LOCALES,
  LEVELS,
  NUMBER_CARDS,
  PATTERN_LESSONS,
  QUESTION_TYPES,
  buildNumberCard,
  validateAnswer,
} from './numbers.js';
import {
  ESSENTIAL_GROUPS,
  ESSENTIAL_ITEMS,
  buildEssentialChallengeQuestions,
  getEssentialAnswerKind,
  isCalendarSequenceGroup,
  shouldAutoPlayEssentialQuestion,
  validateEssentialAnswer,
} from './essentials.js';

const STORAGE_KEY = 'countInFrench.progress.v1';
const LEGACY_STORAGE_KEY = 'frenchNumbersMastery.progress.v1';
const MASTERY_TARGET = 3;
const LEVEL_REVIEW_PASSING_SCORE = 90;
const FINAL_EXAM_PASSING_SCORE = 95;
const DIMENSION_MASTERY_SCORE = 100;
const MISSION_PASSING_SCORE = 100;
const UNAVAILABLE_LOCALE_TOOLTIP = 'Currently unavailable, coming in the next few updates.';
const GITHUB_REPO_URL = 'https://github.com/icey-max/count-in-french';
const AUDIO_BASE_URL = new URL('../assets/audio/', import.meta.url);
const ESSENTIAL_AUDIO_BASE_URL = new URL('../assets/audio/essentials/', import.meta.url);
const RECORDED_AUDIO_NUMBERS = new Set([0, ...NUMBER_CARDS.map((card) => card.number)]);
const GENERATED_AUDIO_NUMBERS = new Set();
const TOTAL_LEVELS = LEVELS.length;
const LEVEL_GROUPS = [
  {
    id: 'core',
    title: 'Core numbers',
    subtitle: 'Build automatic recall from 1 to 100 before combining larger chunks.',
    levels: LEVELS.filter((level) => level.id <= 10),
  },
  {
    id: 'forming',
    title: 'Number forming',
    subtitle: 'Assemble hundreds, thousands, millions, and milliards from reusable Standard French parts.',
    levels: LEVELS.filter((level) => level.id > 10),
  },
];

const MISSION_PHASES = [
  {
    id: 'hearing',
    label: 'Hearing',
    shortLabel: 'Hear',
    questionTypeId: 'audio-to-number',
  },
  {
    id: 'writing',
    label: 'Writing',
    shortLabel: 'Write',
    questionTypeId: 'number-to-french',
  },
];

const REVIEW_MODES = [
  {
    id: 'listening',
    title: 'Listening Review',
    description: 'Hear Standard French audio in random order. Type the number digits.',
  },
  {
    id: 'writing',
    title: 'Writing Review',
    description: 'See digits in random order. Type the Standard French spelling, then hear it.',
  },
  {
    id: 'mixed',
    title: 'Mixed Recall',
    description: 'Random order and random direction for exam-style switching.',
  },
  {
    id: 'adaptive',
    title: 'Adaptive Review',
    description: 'Weighted mixed practice for missed and low-streak numbers.',
  },
];

const MISSIONS = [
  {
    id: 'count-1-10',
    title: 'Count 1-10',
    description: 'Practice numbers 1 to 10 by ear and in writing.',
    levelId: 1,
    range: [1, 10],
    badge: '1-10',
    legacyPhaseIds: {
      hearing: 'count-1-10-by-ear',
      writing: 'write-1-10-in-french',
    },
  },
  {
    id: 'count-by-10s-10-100',
    title: 'Count by 10s',
    description: 'Practice 10, 20, 30 ... 100 by ear and in writing.',
    levelId: 10,
    range: [10, 100],
    step: 10,
    badge: 'Base 10',
  },
  {
    id: 'count-by-5s-0-100',
    title: 'Count by 5s',
    description: 'Practice every multiple of 5 from 0 through 100 by ear and in writing.',
    levelId: 10,
    range: [0, 100],
    step: 5,
    badge: 'Base 5',
  },
];

const app = document.querySelector('#app');

seedLocalhostMasterProgress();

let progress = loadProgress();
let route = { name: 'dashboard' };
let activeSession = null;
let activeEssentialSession = null;
let activeAnswer = null;
let activeAudio = null;
let activeSpeech = null;
let lastAutoPlayKey = null;
let lastLearnAutoPlayKey = null;
let lastEssentialAutoPlayKey = null;

// Global Enter handler: while feedback is showing, Enter advances to the next
// challenge. The answer input is disabled during feedback, so the form's own
// submit cannot catch the keystroke here.
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' || event.repeat) return;
  const inQuiz = activeSession && !activeSession.finished;
  if (inQuiz && activeAnswer) {
    event.preventDefault();
    nextQuestion();
  }
  const inEssentialChallenge = route.name === 'essential-challenge' && activeEssentialSession && !activeEssentialSession.finished;
  if (inEssentialChallenge && activeAnswer) {
    event.preventDefault();
    nextEssentialQuestion();
  }
});

render();

function seedLocalhostMasterProgress() {
  const params = new URLSearchParams(window.location.search);
  const isLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  if (!isLocalhost || params.get('master') !== '1') return;

  const seeded = createInitialProgress();
  for (const level of LEVELS) {
    const levelState = seeded.levels[level.id];
    levelState.learnComplete = true;
    levelState.reviewPassed = true;
    levelState.completed = true;
    levelState.mastery.writing = { passed: true, bestScore: 100, lastScore: 100 };
    levelState.mastery.hearing = { passed: true, bestScore: 100, lastScore: 100 };
    for (const card of Object.values(levelState.cards)) {
      card.streak = MASTERY_TARGET;
      card.mastered = true;
      card.attempts = MASTERY_TARGET;
      card.misses = 0;
    }
  }

  const clearedAt = new Date().toISOString();
  for (const mission of MISSIONS) {
    for (const phase of MISSION_PHASES) {
      seeded.missions[mission.id].phases[phase.id] = {
        bestScore: 100,
        lastScore: 100,
        attempts: 1,
        clears: 1,
        lastClearedAt: clearedAt,
      };
    }
  }

  seeded.finalExam = { unlocked: true, passed: true, bestScore: 100, lastScore: 100 };
  writeStoredProgress(JSON.stringify(seeded));
  window.history.replaceState({}, '', window.location.pathname || '/');
}

function loadProgress() {
  const saved = readStoredProgress();
  if (saved) {
    try {
      return hydrateProgress(JSON.parse(saved));
    } catch {
      removeStoredProgress();
    }
  }
  return createInitialProgress();
}

function hydrateProgress(saved) {
  const initial = createInitialProgress();
  const merged = {
    ...initial,
    ...saved,
    levels: { ...initial.levels, ...(saved.levels || {}) },
    missions: { ...initial.missions },
    finalExam: { ...initial.finalExam, ...(saved.finalExam || {}) },
  };

  for (const level of LEVELS) {
    const savedLevel = saved.levels?.[level.id] || {};
    const initialMastery = createEmptyLevelMastery();
    merged.levels[level.id] = {
      ...initial.levels[level.id],
      ...savedLevel,
      mastery: {
        writing: {
          ...initialMastery.writing,
          ...(savedLevel.mastery?.writing || {}),
        },
        hearing: {
          ...initialMastery.hearing,
          ...(savedLevel.mastery?.hearing || {}),
        },
      },
      cards: {
        ...initial.levels[level.id].cards,
        ...(savedLevel.cards || {}),
      },
    };
  }

  for (const mission of MISSIONS) {
    merged.missions[mission.id] = hydrateMissionProgress(mission, saved.missions || {});
  }

  return merged;
}

function hydrateMissionProgress(mission, savedMissions) {
  const initial = createEmptyMissionProgress();
  const savedMission = savedMissions[mission.id] || {};

  for (const phase of MISSION_PHASES) {
    const legacyId = mission.legacyPhaseIds?.[phase.id];
    const legacyPhase = legacyId ? savedMissions[legacyId] : null;
    const savedPhase = savedMission.phases?.[phase.id];
    const sameIdLegacyPhase = !savedMission.phases && phase.id === 'writing' ? savedMission : null;

    initial.phases[phase.id] = {
      ...initial.phases[phase.id],
      ...extractMissionPhaseProgress(legacyPhase),
      ...extractMissionPhaseProgress(sameIdLegacyPhase),
      ...extractMissionPhaseProgress(savedPhase),
    };
  }

  return initial;
}

function extractMissionPhaseProgress(value) {
  if (!value) return {};
  return {
    bestScore: Number(value.bestScore) || 0,
    lastScore: value.lastScore ?? null,
    attempts: Number(value.attempts) || 0,
    clears: Number(value.clears) || 0,
    lastClearedAt: value.lastClearedAt || null,
  };
}

function createInitialProgress() {
  const levels = {};
  for (const level of LEVELS) {
    const cards = {};
    getLevelCards(level.id).forEach((card) => {
      cards[card.number] = {
        streak: 0,
        mastered: false,
        attempts: 0,
        misses: 0,
      };
    });
    levels[level.id] = {
      learnComplete: false,
      reviewPassed: false,
      completed: false,
      mastery: createEmptyLevelMastery(),
      cards,
    };
  }

  return {
    levels,
    missions: createInitialMissionProgress(),
    finalExam: {
      unlocked: false,
      passed: false,
      bestScore: 0,
      lastScore: null,
    },
  };
}

function createInitialMissionProgress() {
  return Object.fromEntries(
    MISSIONS.map((mission) => [mission.id, createEmptyMissionProgress()]),
  );
}

function createEmptyMissionProgress() {
  return {
    phases: Object.fromEntries(MISSION_PHASES.map((phase) => [phase.id, createEmptyMissionPhaseProgress()])),
  };
}

function createEmptyMissionPhaseProgress() {
  return { bestScore: 0, lastScore: null, attempts: 0, clears: 0, lastClearedAt: null };
}

function createEmptyLevelMastery() {
  return {
    writing: { passed: false, bestScore: 0, lastScore: null },
    hearing: { passed: false, bestScore: 0, lastScore: null },
  };
}

function saveProgress() {
  progress.finalExam.unlocked = allLevelsComplete();
  writeStoredProgress(JSON.stringify(progress));
}

function readStoredProgress() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return saved;

    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) writeStoredProgress(legacy);
    return legacy;
  } catch {
    return null;
  }
}

function writeStoredProgress(value) {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Progress remains usable in memory when storage is blocked or full.
  }
}

function removeStoredProgress() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // Ignore storage failures so the app can still render.
  }
}

function getLevelCards(levelId) {
  return NUMBER_CARDS.filter((card) => card.levelId === levelId);
}

function getLevelState(levelId) {
  return progress.levels[levelId];
}

function isLevelUnlocked(levelId) {
  return levelId === 1 || progress.levels[levelId - 1].completed;
}

function allLevelsComplete() {
  return LEVELS.every((level) => progress.levels[level.id].completed);
}

function currentLevelId() {
  return LEVELS.find((level) => !progress.levels[level.id].completed)?.id || LEVELS.at(-1).id;
}

function masteredCount(levelId) {
  return Object.values(getLevelState(levelId).cards).filter((card) => card.mastered).length;
}

function levelMasteryStats(levelId) {
  const cardStates = Object.values(getLevelState(levelId).cards);
  const total = cardStates.length * MASTERY_TARGET;
  const achieved = cardStates.reduce((sum, card) => {
    return sum + Math.min(card.streak, MASTERY_TARGET);
  }, 0);

  return {
    achieved,
    total,
    percent: total > 0 ? Math.round((achieved / total) * 100) : 0,
  };
}

function isLevelDimensionMastered(levelId, dimension) {
  return Boolean(getLevelState(levelId).mastery?.[dimension]?.passed);
}

function isLevelFullyMastered(levelId) {
  return isLevelDimensionMastered(levelId, 'writing') && isLevelDimensionMastered(levelId, 'hearing');
}

function nextLevelMasteryDimension(levelId) {
  if (!isLevelDimensionMastered(levelId, 'hearing')) return 'hearing';
  if (!isLevelDimensionMastered(levelId, 'writing')) return 'writing';
  return 'writing';
}

function dimensionLabel(dimension) {
  return dimension === 'hearing' ? 'Hearing' : 'Writing';
}

function formatNumber(number) {
  return new Intl.NumberFormat('en-US').format(number);
}

function overallProficiency() {
  const total = NUMBER_CARDS.length * MASTERY_TARGET;
  const achieved = NUMBER_CARDS.reduce((sum, card) => {
    return sum + Math.min(progress.levels[card.levelId].cards[card.number].streak, MASTERY_TARGET);
  }, 0);
  return Math.round((achieved / total) * 100);
}

function render() {
  const routeClass = `route-${route.name}`;
  app.innerHTML = `
    <section class="hero-card ${routeClass}" aria-live="polite">
      ${renderHeader()}
      ${renderRoute()}
    </section>
  `;
  bindActions();
}

function renderHeader() {
  const status = progress.finalExam.passed ? 'Mastered' : `${overallProficiency()}% proficient`;
  return `
    <header class="app-header">
      <button class="brand" data-action="dashboard" aria-label="Go to dashboard">
        <span class="brand-mark">FR</span>
        <span>
          <strong>Count in French</strong>
          <small>${ACTIVE_FRENCH_LOCALE.shortLabel} number trainer</small>
        </span>
      </button>
      <div class="header-actions">
        ${renderLocaleSwitcher()}
        ${renderGitHubHeaderLink()}
        <div class="status-pill ${progress.finalExam.passed ? 'status-mastered' : ''}">${status}</div>
      </div>
    </header>
  `;
}

function renderGitHubHeaderLink() {
  return `
    <a class="github-link" href="${GITHUB_REPO_URL}" target="_blank" rel="noopener" aria-label="View Count in French on GitHub">
      <svg aria-hidden="true" viewBox="0 0 16 16" focusable="false">
        <path d="M8 0C3.58 0 0 3.69 0 8.24c0 3.64 2.29 6.72 5.47 7.8.4.07.55-.18.55-.4 0-.2-.01-.85-.01-1.54-2.01.38-2.53-.5-2.69-.96-.09-.24-.48-.96-.82-1.16-.28-.16-.68-.55-.01-.56.63-.01 1.08.6 1.23.85.72 1.24 1.87.89 2.33.68.07-.54.28-.89.51-1.09-1.78-.21-3.64-.92-3.64-4.06 0-.9.31-1.64.82-2.21-.08-.21-.36-1.05.08-2.18 0 0 .67-.22 2.2.84A7.44 7.44 0 0 1 8 3.97c.68 0 1.36.09 1.99.28 1.53-1.07 2.2-.84 2.2-.84.44 1.13.16 1.97.08 2.18.51.57.82 1.31.82 2.21 0 3.15-1.87 3.85-3.65 4.06.29.26.54.75.54 1.51 0 1.09-.01 1.97-.01 2.24 0 .22.15.48.55.4A8.17 8.17 0 0 0 16 8.24C16 3.69 12.42 0 8 0Z" />
      </svg>
      <span>GitHub</span>
    </a>
  `;
}

function renderLocaleSwitcher() {
  return `
    <div class="locale-switcher" aria-label="French number locale">
      ${FRENCH_LOCALES.map(renderLocaleOption).join('')}
    </div>
  `;
}

function renderLocaleOption(locale) {
  if (locale.available) {
    return `
      <button class="locale-option is-active" type="button" data-locale="${locale.id}" aria-pressed="true" title="${locale.description}">
        <strong>${locale.shortLabel}</strong>
        <span>${locale.label}</span>
      </button>
    `;
  }

  return `
    <span class="locale-option-wrap" data-tooltip="${UNAVAILABLE_LOCALE_TOOLTIP}" tabindex="0" aria-label="${locale.label}: ${UNAVAILABLE_LOCALE_TOOLTIP}">
      <button class="locale-option is-disabled" type="button" data-locale="${locale.id}" disabled aria-disabled="true" title="${UNAVAILABLE_LOCALE_TOOLTIP}">
        <strong>${locale.shortLabel}</strong>
        <span>${locale.label}</span>
      </button>
    </span>
  `;
}

function renderRoute() {
  if (route.name === 'learn') return renderLearn(route.levelId, route.index || 0);
  if (route.name === 'quiz') return renderQuestionSession();
  if (route.name === 'review') return renderReviewScreen();
  if (route.name === 'exam') return renderQuestionSession();
  if (route.name === 'essential-challenge') return renderEssentialChallenge();
  return renderDashboard();
}

function renderDashboard() {
  const current = currentLevelId();
  const completed = LEVELS.filter((level) => progress.levels[level.id].completed).length;
  return `
    <section class="dashboard-grid">
      <div class="intro-panel">
        <p class="eyebrow">${ACTIVE_FRENCH_LOCALE.label} numbers</p>
        <h1>Build instant Standard French number fluency.</h1>
        <p class="lede">Move through focused levels using the France/standard number forms, hear available audio, write from memory, then optionally master each completed level in Writing and Hearing at 100%.</p>
        <div class="metric-row">
          <div class="metric-card">
            <strong>${current}</strong>
            <span>Current level</span>
          </div>
          <div class="metric-card">
            <strong>${completed}/${TOTAL_LEVELS}</strong>
            <span>Levels complete</span>
          </div>
          <div class="metric-card">
            <strong>${progress.finalExam.bestScore}%</strong>
            <span>Best exam</span>
          </div>
        </div>
        ${renderPrimaryDashboardAction(current)}
      </div>
      <aside class="review-panel">
        <p class="eyebrow">Practice direction</p>
        <h2>Train one recall path at a time.</h2>
        ${renderReviewModeButtons()}
      </aside>
    </section>
    ${renderLevelGroups()}
    ${renderMissionsSection()}
    ${renderEssentialsSection()}
  `;
}

function renderLevelGroups() {
  return `
    <section class="level-groups" aria-label="Learning levels">
      ${LEVEL_GROUPS.map(renderLevelGroup).join('')}
    </section>
  `;
}

function renderLevelGroup(group) {
  return `
    <section class="level-group level-group-${group.id}" aria-labelledby="level-group-${group.id}">
      <div class="level-group-heading">
        <div>
          <p class="eyebrow">${group.id === 'forming' ? 'Second chapter' : 'Foundation'}</p>
          <h2 id="level-group-${group.id}">${group.title}</h2>
        </div>
        <p>${group.subtitle}</p>
      </div>
      <div class="level-ladder">
        ${group.levels.map(renderLevelCard).join('')}
      </div>
    </section>
  `;
}

function renderMissionsSection() {
  return `
    <section class="missions-section" aria-label="Missions">
      <div class="section-heading">
        <p class="eyebrow">Repeatable missions</p>
        <h2>Perfect-run challenges.</h2>
        <p>Each mission can be replayed anytime. Clearing a mission requires 100% with no mistakes.</p>
      </div>
      <div class="mission-grid">
        ${MISSIONS.map(renderMissionCard).join('')}
      </div>
    </section>
  `;
}

function renderEssentialsSection() {
  return `
    <section class="essentials-section" aria-labelledby="essentials-heading">
      <div class="section-heading essentials-heading">
        <p class="eyebrow">French essentials</p>
        <h2 id="essentials-heading">Quick recall challenges.</h2>
        <p>Practice verbs, prepositions, colors, days, and months with typed answers and Sound of Text pronunciation prompts.</p>
      </div>
      <div class="essential-challenge-grid">
        ${ESSENTIAL_GROUPS.map(renderEssentialChallengeCard).join('')}
      </div>
    </section>
  `;
}

function renderEssentialChallengeCard(group) {
  const challengeSummary =
    isCalendarSequenceGroup(group)
      ? `${group.items.length * 3 + 1} questions · dictation + final order`
      : `${group.items.length} questions · meaning + listening`;
  return `
    <article class="essential-challenge-card essential-challenge-${group.id}">
      <div class="essential-challenge-preview" aria-hidden="true">
        ${renderEssentialPreview(group)}
      </div>
      <div class="essential-challenge-copy">
        <p class="eyebrow">${group.eyebrow}</p>
        <h3>${group.title}</h3>
        <p>${group.description}</p>
        <span>${challengeSummary}</span>
      </div>
      <button class="primary-small essential-start" data-action="start-essential-challenge" data-group="${group.id}">
        Start challenge
      </button>
    </article>
  `;
}

function renderEssentialPreview(group) {
  if (!group.illustration) {
    return `<span class="calendar-preview">${group.items.slice(0, 3).map((item) => `<i>${item.display.slice(0, 3)}</i>`).join('')}</span>`;
  }

  return group.items
    .slice(0, 3)
    .map((item) => {
      const colorStyle = item.color ? ` style="--swatch:${item.color}"` : '';
      return `<span class="essential-illustration illustration-${group.id} illustration-${item.id}"${colorStyle}>${renderEssentialIllustration(group, item)}</span>`;
    })
    .join('');
}

function renderEssentialChallenge() {
  if (!activeEssentialSession) return renderDashboard();
  if (activeEssentialSession.finished) return renderEssentialResults();

  const question = activeEssentialSession.questions[activeEssentialSession.index];
  const item = question.item;
  const group = activeEssentialSession.group;
  const progressText = `${activeEssentialSession.index + 1} / ${activeEssentialSession.questions.length}`;
  const completedCount = activeAnswer ? activeEssentialSession.index + 1 : activeEssentialSession.index;
  const progressPercent = Math.round((completedCount / activeEssentialSession.questions.length) * 100);
  const footerState = activeAnswer ? (activeAnswer.correct ? 'is-correct' : 'is-wrong') : '';
  const answerKind = getEssentialAnswerKind(question);
  const answerLabel = getEssentialAnswerLabel(group, answerKind);
  const placeholder = getEssentialAnswerPlaceholder(group, answerKind);
  const footerHint = getEssentialFooterHint(answerKind);

  return `
    <section class="essential-quiz ${footerState}">
      <div class="quiz-topbar">
        <button type="button" class="quiz-quit" data-action="dashboard" aria-label="Exit session">&times;</button>
        <div class="session-progress" role="progressbar" aria-label="${group.title} challenge progress" aria-valuenow="${progressPercent}" aria-valuemin="0" aria-valuemax="100"><i style="width:${progressPercent}%"></i></div>
        <span class="quiz-count">${progressText}</span>
      </div>

      <form class="essential-quiz-board" data-action="submit-answer">
        <article class="essential-prompt-card">
          <div class="card-tag">${group.title}</div>
          ${renderEssentialPrompt(group, question)}
          ${
            item
              ? `<button type="button" class="card-audio" data-action="play-essential-audio" data-vocab="${item.id}" aria-label="Play French audio">
                  <span class="speaker" aria-hidden="true"></span>
                  Hear it
                </button>`
              : ''
          }
        </article>

        <div class="answer-zone">
          <label class="answer-label" for="answer-input">
            <span class="answer-kind-dot" aria-hidden="true"></span>
            ${answerLabel}
          </label>
          ${renderEssentialAnswerInput(answerKind, placeholder)}
        </div>

        <footer class="quiz-footer">
          ${activeAnswer ? renderEssentialFeedback(activeAnswer, question) : `<span class="footer-hint">${footerHint}</span>`}
          ${
            activeAnswer
              ? '<button type="button" class="footer-action" data-action="next-essential-question">Continue</button>'
              : '<button class="footer-action" type="submit">Check</button>'
          }
        </footer>
      </form>
    </section>
  `;
}

function getEssentialAnswerLabel(group, answerKind) {
  if (answerKind === 'english') return 'Type the English meaning';
  if (answerKind === 'sequence') return `Type the ${getEssentialSequenceNoun(group)} in order`;
  return 'Type the French word';
}

function getEssentialAnswerPlaceholder(group, answerKind) {
  if (answerKind === 'english') return `e.g. ${group.items[0].english}`;
  if (answerKind === 'sequence') return 'one French word per line';
  return `e.g. ${group.items[0].display}`;
}

function getEssentialFooterHint(answerKind) {
  if (answerKind === 'sequence') return 'One item per line - click Check when done';
  return 'Press Enter to submit';
}

function getEssentialSequenceNoun(group) {
  return group.id === 'months' ? 'months' : 'days';
}

function getEssentialSequenceRange(group) {
  return group.id === 'months' ? 'January to December' : 'Monday to Sunday';
}

function renderEssentialAnswerInput(answerKind, placeholder) {
  if (answerKind === 'sequence') {
    return `<textarea id="answer-input" class="sequence-answer" name="answer" data-expected-kind="french" rows="7" placeholder="${placeholder}" autocomplete="off" autocapitalize="off" spellcheck="false" ${activeAnswer ? 'disabled' : ''} autofocus></textarea>`;
  }

  return `<input id="answer-input" name="answer" type="text" data-expected-kind="french" placeholder="${placeholder}" autocomplete="off" autocapitalize="off" spellcheck="false" ${activeAnswer ? 'disabled' : ''} autofocus />`;
}

function renderEssentialPrompt(group, question) {
  const item = question.item;
  if (question.mode === 'sequence') {
    return `
      <div class="essential-meaning-prompt essential-sequence-prompt">
        <span>Final order check</span>
        <strong>Final Sequence</strong>
        <em>${getEssentialSequenceRange(group)}</em>
        <ol class="seed-lines" aria-label="${group.items.length} blank lines for the French ${getEssentialSequenceNoun(group)}">
          ${group.items.map(() => '<li><span></span></li>').join('')}
        </ol>
      </div>
    `;
  }

  if (question.mode === 'listening' || question.mode === 'dictation') {
    const hint = question.mode === 'dictation' ? 'Autoplay dictation' : 'Listen and type it';
    return `
      <button type="button" class="audio-prompt essential-audio-prompt" data-action="play-essential-audio" data-vocab="${item.id}" aria-label="Play French audio">
        <span class="audio-wave" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>
        <span class="audio-hint">${hint}</span>
      </button>
    `;
  }

  if (question.mode === 'translate') {
    return `
      <div class="essential-meaning-prompt essential-translation-prompt">
        <span>Listen, read, then translate</span>
        <strong>${item.display}</strong>
        ${renderHighlightedExample(item)}
      </div>
    `;
  }

  return `
    <div class="essential-meaning-prompt">
      ${
        group.illustration
          ? `<span class="essential-illustration illustration-${group.id} illustration-${item.id}"${item.color ? ` style="--swatch:${item.color}"` : ''} aria-hidden="true">${renderEssentialIllustration(group, item)}</span>`
          : ''
      }
      <span>What is the French for</span>
      <strong>${item.english}</strong>
      ${renderHighlightedExample(item)}
      ${renderConjugationSupport(item)}
    </div>
  `;
}

function renderHighlightedExample(item) {
  if (!item.example) return '';

  const example = escapeHtml(item.example);
  const highlight = item.highlight ? escapeHtml(item.highlight) : '';
  if (!highlight) return `<em class="essential-example">${example}</em>`;

  const index = example.toLocaleLowerCase().indexOf(highlight.toLocaleLowerCase());
  if (index === -1) return `<em class="essential-example">${example}</em>`;

  return `
    <em class="essential-example">
      ${example.slice(0, index)}<mark>${example.slice(index, index + highlight.length)}</mark>${example.slice(index + highlight.length)}
    </em>
  `;
}

function renderConjugationSupport(item) {
  if (!item.conjugation) return '';

  const forms = [
    ['je', item.conjugation.je],
    ['tu', item.conjugation.tu],
    ['il', item.conjugation.il],
    ['nous', item.conjugation.nous],
    ['vous', item.conjugation.vous],
    ['ils', item.conjugation.ils],
  ];

  return `
    <dl class="conjugation-grid" aria-label="${item.display} present indicative conjugation">
      ${forms.map(([pronoun, form]) => `<div><dt>${pronoun}</dt><dd>${form}</dd></div>`).join('')}
    </dl>
  `;
}

function renderEssentialFeedback(answer, question) {
  if (answer.expectedKind === 'sequence') {
    return `
      <div class="feedback ${answer.correct ? 'is-correct' : 'is-wrong'}" role="status">
        <span class="feedback-icon" aria-hidden="true">${answer.correct ? '&check;' : '&times;'}</span>
        <span class="feedback-body">
          <strong>${answer.correct ? 'Order locked' : 'Correct order'}</strong>
          <span>${question.items.map((item) => item.display).join(' - ')}</span>
        </span>
      </div>
    `;
  }

  const item = question.item;
  const expected = answer.expectedKind === 'english' ? item.english : item.display;
  const paired = answer.expectedKind === 'english' ? item.display : item.english;
  const example = item.example ? renderHighlightedExample(item) : '';
  return `
    <div class="feedback ${answer.correct ? 'is-correct' : 'is-wrong'}" role="status">
      <span class="feedback-icon" aria-hidden="true">${answer.correct ? '&check;' : '&times;'}</span>
      <span class="feedback-body">
        <strong>${answer.correct ? 'Correct' : 'Correct answer'}</strong>
        <span>${expected} · ${paired}</span>
        ${example}
      </span>
    </div>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderEssentialResults() {
  const score = Math.round((activeEssentialSession.correct / activeEssentialSession.answered) * 100) || 0;
  return `
    <section class="results-panel">
      <p class="eyebrow">${activeEssentialSession.group.title}</p>
      <h1>${score === 100 ? 'Challenge cleared' : 'Challenge complete'}</h1>
      <div class="score-orb"><strong>${score}%</strong><span>${activeEssentialSession.correct}/${activeEssentialSession.answered}</span></div>
      <p>${score === 100 ? 'Perfect recall for this set.' : 'Replay the challenge to lock in the misses.'}</p>
      <div class="result-actions">
        <button class="primary-action compact" data-action="restart-essential-challenge" data-group="${activeEssentialSession.group.id}">Replay challenge</button>
        <button class="secondary-action" data-action="dashboard">Dashboard</button>
      </div>
    </section>
  `;
}

function renderEssentialIllustration(group, item) {
  if (group.id === 'colors') {
    return '<span class="color-drop"></span><span class="color-chip"></span>';
  }

  if (group.id === 'prepositions') {
    return '<span class="prep-box"></span><span class="prep-dot"></span>';
  }

  return '<span class="verb-path"></span><span class="verb-dot"></span><span class="verb-line"></span>';
}

function renderReviewModeButtons() {
  return REVIEW_MODES.map(
    (mode) => `
      <button class="mode-card" data-action="start-review" data-mode="${mode.id}">
        <strong>${mode.title}</strong>
        <span>${mode.description}</span>
      </button>
    `,
  ).join('');
}

function renderMissionCard(mission) {
  const unlocked = isLevelUnlocked(mission.levelId);
  const cleared = isMissionCleared(mission.id);
  const nextPhaseId = nextMissionPhaseId(mission.id);
  const phaseSummary = missionPhaseSummary(mission.id);
  const totalAttempts = missionTotalAttempts(mission.id);
  return `
    <article class="mission-card ${cleared ? 'is-cleared' : ''} ${unlocked ? '' : 'is-locked'}">
      <button class="mission-main" data-action="start-mission" data-mission="${mission.id}" data-phase="${nextPhaseId}" ${unlocked ? '' : 'disabled'}>
        <span class="mission-badge">${mission.badge}</span>
        <strong>${mission.title}</strong>
        <span>${mission.description}</span>
        <span class="mission-stats">${phaseSummary} · Attempts ${totalAttempts}</span>
      </button>
      <div class="mission-phase-rail" aria-label="${mission.title} phases">
        ${MISSION_PHASES.map((phase) => renderMissionPhaseButton(mission, phase, unlocked)).join('')}
      </div>
    </article>
  `;
}

function renderMissionPhaseButton(mission, phase, unlocked) {
  const phaseState = progress.missions[mission.id].phases[phase.id];
  const cleared = phaseState.clears > 0;
  return `
    <button class="mission-phase is-${phase.id} ${cleared ? 'is-cleared' : ''}" data-action="start-mission" data-mission="${mission.id}" data-phase="${phase.id}" ${unlocked ? '' : 'disabled'}>
      <span class="phase-dot" aria-hidden="true"></span>
      <span class="mission-phase-copy">
        <strong>${phase.label}</strong>
        <em>${cleared ? '100%' : `${phaseState.bestScore}%`}</em>
      </span>
    </button>
  `;
}

function missionPhaseSummary(missionId) {
  const state = progress.missions[missionId];
  const cleared = MISSION_PHASES.filter((phase) => state.phases[phase.id].clears > 0).length;
  return `${cleared}/${MISSION_PHASES.length} phases cleared`;
}

function missionTotalAttempts(missionId) {
  const state = progress.missions[missionId];
  return MISSION_PHASES.reduce((sum, phase) => sum + state.phases[phase.id].attempts, 0);
}

function isMissionCleared(missionId) {
  const state = progress.missions[missionId];
  return MISSION_PHASES.every((phase) => state.phases[phase.id].clears > 0);
}

function nextMissionPhaseId(missionId) {
  const state = progress.missions[missionId];
  return MISSION_PHASES.find((phase) => state.phases[phase.id].clears === 0)?.id || MISSION_PHASES[0].id;
}

function renderPrimaryDashboardAction(current) {
  if (progress.finalExam.passed) {
    return `<div class="completion-banner"><strong>Standard French numbers mastered</strong><span>Status: Mastered</span></div>`;
  }

  if (allLevelsComplete()) {
    return `
      <button class="primary-action" data-action="start-exam">
        Start Final Exam
        <span>${NUMBER_CARDS.length} randomized questions - pass at 95%</span>
      </button>
    `;
  }

  const state = getLevelState(current);
  const level = LEVELS.find((item) => item.id === current);
  const label = state.learnComplete ? 'Continue Mastery' : 'Continue Learning';
  return `
    <button class="primary-action" data-action="continue-level" data-level="${current}">
      ${label}
      <span>Level ${current}: ${level.range}</span>
    </button>
  `;
}

function renderLevelCard(level) {
  const state = getLevelState(level.id);
  const unlocked = isLevelUnlocked(level.id);
  const mastered = masteredCount(level.id);
  const percent = levelMasteryStats(level.id).percent;
  const fullyMastered = isLevelFullyMastered(level.id);
  const current = unlocked && !state.completed;
  const totalCards = getLevelCards(level.id).length;
  const label = state.completed ? (fullyMastered ? 'Mastered' : 'Practice unlocked') : unlocked ? `${mastered}/${totalCards} mastered` : 'Locked';
  const action = state.completed
    ? `data-action="start-level-master" data-level="${level.id}"`
    : unlocked
      ? `data-action="continue-level" data-level="${level.id}"`
      : '';
  const classes = [
    'level-card',
    current ? 'is-current' : '',
    state.completed ? 'is-complete' : '',
    fullyMastered ? 'is-mastered' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return `
    <button class="${classes}" ${action} ${unlocked ? '' : 'disabled'}>
      <span class="level-topline">${level.title}</span>
      <strong>${level.range}</strong>
      <span class="level-status">${label}</span>
      ${state.completed ? renderLevelMasteryChips(state) : `<span class="mini-progress" aria-hidden="true"><i style="width:${percent}%"></i></span>`}
    </button>
  `;
}

function renderLevelMasteryChips(state) {
  return `
    <span class="level-mastery-track" aria-label="Level mastery progress">
      ${renderLevelMasteryChip('Hearing', state.mastery.hearing)}
      ${renderLevelMasteryChip('Writing', state.mastery.writing)}
    </span>
  `;
}

function renderLevelMasteryChip(label, state) {
  const passed = state.passed;
  return `
    <span class="level-mastery-chip ${passed ? 'is-passed' : ''}">
      <span class="level-mastery-dot" aria-hidden="true"></span>
      <span>${label}</span>
      <strong>${passed ? '100%' : `${state.bestScore}%`}</strong>
    </span>
  `;
}

function renderLearn(levelId, index) {
  const cards = getLevelCards(levelId);
  const level = LEVELS.find((item) => item.id === levelId);
  const lesson = PATTERN_LESSONS[levelId];

  if (lesson && index === 0) {
    return renderPatternLesson(levelId, lesson);
  }

  const adjustedIndex = lesson ? index - 1 : index;
  const card = cards[adjustedIndex];
  const isLast = adjustedIndex === cards.length - 1;
  const audioAvailable = hasPlayableAudio(card);

  return `
    <section class="learn-layout">
      <div class="phase-copy">
        <p class="eyebrow">Level ${levelId} Learn Mode · ${ACTIVE_FRENCH_LOCALE.shortLabel}</p>
        <h1>No testing yet. Just notice the shape, sound, and pattern.</h1>
        <p>Move card by card through ${level.range}. You will practice only after every number has been introduced.</p>
      </div>
      <article class="number-stage">
        <span class="counter">${adjustedIndex + 1} / ${cards.length}</span>
        <div class="giant-number">${formatNumber(card.number)}</div>
        <div class="french-word">${card.french}</div>
        <div class="pronunciation">${card.pronunciation}</div>
        <div class="control-row">
          <button class="secondary-action audio-action" data-action="play-audio" data-number="${card.number}" ${audioAvailable ? '' : 'disabled'}>${audioAvailable ? 'Play audio' : 'No recording'}</button>
          <button class="primary-small" data-action="next-learn" data-level="${levelId}" data-index="${index}">${isLast ? 'Start guided quiz' : 'Next'}</button>
        </div>
      </article>
    </section>
  `;
}

function renderPatternLesson(levelId, lesson) {
  return `
    <section class="pattern-panel">
      <p class="eyebrow">${lesson.eyebrow}</p>
      <h1>${lesson.title}</h1>
      <p>${lesson.explanation}</p>
      <div class="pattern-examples">
        ${lesson.examples
          .map(
            (example) => `
              <button class="pattern-example" data-action="play-audio" data-number="${example.number}">
                <span>${formatNumber(example.number)}</span>
                <strong>${example.math}</strong>
                <em>${example.french}</em>
              </button>
            `,
          )
          .join('')}
      </div>
      <button class="primary-action compact" data-action="next-learn" data-level="${levelId}" data-index="0">Begin Level ${levelId}</button>
    </section>
  `;
}

function renderQuestionSession() {
  if (!activeSession) return renderDashboard();

  if (activeSession.finished) return renderSessionResults();

  const question = activeSession.questions[activeSession.index];
  const card = question.card;
  const type = question.type;
  const prompt = renderQuestionPrompt(question);
  const inputMode = type.inputMode === 'numeric' ? 'numeric' : 'text';

  const sessionProgress = getSessionProgress(activeSession);
  const footerState = activeAnswer ? (activeAnswer.correct ? 'is-correct' : 'is-wrong') : '';
  // Color-code the whole challenge by what the user must TYPE so the switch in
  // direction is impossible to miss between questions.
  const answerKind = type.expectedKind === 'number' ? 'want-number' : 'want-french';
  const directionKey = `${activeSession.index}-${type.id}`;
  const placeholder = type.expectedKind === 'number' ? 'e.g. 1,234' : 'e.g. quarante-deux';
  const answerLabel = type.expectedKind === 'number' ? 'Type the number (digits)' : 'Type the Standard French spelling (words)';
  const audioAvailable = hasPlayableAudio(card);

  return `
    <section class="quiz-layout ${footerState} ${answerKind}">
      <div class="quiz-topbar">
        <button type="button" class="quiz-quit" data-action="dashboard" aria-label="Exit session">&times;</button>
        <div class="session-progress" role="progressbar" aria-label="${sessionProgress.label}" aria-valuenow="${sessionProgress.percent}" aria-valuemin="0" aria-valuemax="100"><i style="width:${sessionProgress.percent}%"></i></div>
        <span class="quiz-count">${sessionProgress.text}</span>
      </div>

      ${renderDirectionBanner(type, directionKey)}

      <form class="quiz-board" data-action="submit-answer">
        <div class="quiz-card">
          <div class="card-tag">${type.label}</div>
          ${prompt}
          <button type="button" class="card-audio" data-action="play-audio" data-number="${card.number}" aria-label="Play audio" ${audioAvailable ? '' : 'disabled'}>
            <span class="speaker" aria-hidden="true"></span>
            ${audioAvailable ? (type.audioOnly ? 'Replay' : 'Hear it') : 'No recording'}
          </button>
        </div>

        <div class="answer-zone">
          <label class="answer-label" for="answer-input">
            <span class="answer-kind-dot" aria-hidden="true"></span>
            ${answerLabel}
          </label>
          <input id="answer-input" name="answer" type="text" inputmode="${inputMode}" data-expected-kind="${type.expectedKind}" placeholder="${placeholder}" autocomplete="off" autocapitalize="off" spellcheck="false" ${activeAnswer ? 'disabled' : ''} autofocus />
        </div>

        <footer class="quiz-footer">
          ${activeAnswer ? renderFeedback(activeAnswer, card, type) : '<span class="footer-hint">Press Enter to submit</span>'}
          ${
            activeAnswer
              ? '<button type="button" class="footer-action" data-action="next-question">Continue</button>'
              : '<button class="footer-action" type="submit">Check</button>'
          }
        </footer>
      </form>
    </section>
  `;
}

function getSessionProgress(session) {
  if (session.kind === 'mastery') {
    const stats = levelMasteryStats(session.levelId);
    return {
      percent: stats.percent,
      text: `Mastery ${stats.percent}%`,
      label: `Level mastery progress: ${stats.achieved} of ${stats.total} streak points`,
    };
  }

  const percent = Math.round(((session.index + 1) / session.questions.length) * 100);
  return {
    percent,
    text: `${session.index + 1} / ${session.questions.length}`,
    label: 'Session progress',
  };
}

function renderDirectionBanner(type, directionKey) {
  // FROM -> TO chips. The TO chip (what the user must produce) is highlighted.
  const fromChip = type.audioOnly
    ? '<span class="dir-chip is-audio"><span class="dir-ico" aria-hidden="true"></span>Audio</span>'
    : type.expectedKind === 'french'
      ? '<span class="dir-chip is-digits">A number</span>'
      : '<span class="dir-chip is-words">Standard French word</span>';

  const toChip =
    type.expectedKind === 'number'
      ? '<span class="dir-chip dir-target is-digits">Type the number</span>'
      : '<span class="dir-chip dir-target is-words">Type Standard French</span>';

  // key forces the element to remount each question so the animation replays.
  return `
    <div class="direction-banner" data-key="${directionKey}">
      ${fromChip}
      <span class="dir-arrow" aria-hidden="true">&rarr;</span>
      ${toChip}
    </div>
  `;
}

function renderQuestionPrompt(question) {
  if (question.type.audioOnly) {
    return `
      <button type="button" class="audio-prompt" data-action="play-audio" data-number="${question.card.number}" aria-label="Play Standard French audio">
        <span class="audio-wave" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>
        <span class="audio-hint">Tap to listen</span>
      </button>
    `;
  }

  const prompt = question.type.expectedKind === 'french' ? formatNumber(question.card.number) : question.card.french;
  return `<div class="written-prompt">${prompt}</div>`;
}

function renderFeedback(answer, card, type) {
  const expected = type.expectedKind === 'number' ? formatNumber(card.number) : card.french;
  return `
    <div class="feedback ${answer.correct ? 'is-correct' : 'is-wrong'}" role="status">
      <span class="feedback-icon" aria-hidden="true">${answer.correct ? '&check;' : '&times;'}</span>
      <span class="feedback-body">
        <strong>${answer.correct ? 'Nice!' : 'Correct answer'}</strong>
        <span>${expected} &middot; ${card.pronunciation}</span>
      </span>
    </div>
  `;
}

function renderSessionResults() {
  const score = Math.round((activeSession.correct / activeSession.answered) * 100) || 0;
  const passed = didSessionPass(activeSession, score);
  const isExam = activeSession.kind === 'exam';
  const isDimensionMaster = activeSession.kind === 'dimension-master';
  const isMission = activeSession.kind === 'mission';
  const title = isExam && passed
      ? 'Standard French numbers mastered'
    : isDimensionMaster && passed
      ? `${dimensionLabel(activeSession.dimension)} mastered`
      : isMission && passed
        ? isMissionCleared(activeSession.missionId)
          ? 'Mission cleared'
          : `${missionPhaseLabel(activeSession.missionPhase)} cleared`
      : passed
        ? 'Session complete'
        : 'More practice needed';
  const detail = getResultDetail(score, passed);
  const actionLabel = getResultActionLabel(passed);

  return `
    <section class="results-panel">
      <p class="eyebrow">${activeSession.title}</p>
      <h1>${title}</h1>
      <div class="score-orb"><strong>${score}%</strong><span>${activeSession.correct}/${activeSession.answered}</span></div>
      <p>${detail}</p>
      <button class="primary-action compact" data-action="finish-session">${actionLabel}</button>
    </section>
  `;
}

function getResultActionLabel(passed) {
  if (activeSession.kind === 'dimension-master' && passed && !isLevelFullyMastered(activeSession.levelId)) {
    return 'Continue Level Mastery';
  }
  const followUpMissionPhase = passed ? getMissionFollowUpPhase(activeSession) : null;
  if (followUpMissionPhase) return `Continue to ${followUpMissionPhase.label}`;
  return 'Return to dashboard';
}

function getResultDetail(score, passed) {
  if (activeSession.kind === 'exam') {
    return passed
      ? 'Status changed to Mastered. You passed the final exam threshold of 95%.'
      : `Final exam requires 95%. Your best score is now ${progress.finalExam.bestScore}%.`;
  }
  if (activeSession.kind === 'level-review') {
    return passed
      ? 'Level review passed. The next level is now unlocked.'
      : `Level review requires ${LEVEL_REVIEW_PASSING_SCORE}% with no missed cards. Missed cards were returned to mastery review.`;
  }
  if (activeSession.kind === 'dimension-master') {
    const label = dimensionLabel(activeSession.dimension);
    if (!passed) return `${label} mastery requires 100%. Retry this dimension to master the level.`;
    if (isLevelFullyMastered(activeSession.levelId)) return `Level ${activeSession.levelId} is mastered in both Writing and Hearing.`;
    return `${label} mastery complete. The other dimension still needs 100%.`;
  }
  if (activeSession.kind === 'mission') {
    const followUpMissionPhase = passed ? getMissionFollowUpPhase(activeSession) : null;
    if (followUpMissionPhase) return `${missionPhaseLabel(activeSession.missionPhase)} phase cleared. ${followUpMissionPhase.label} still needs 100%.`;
    if (isMissionCleared(activeSession.missionId)) return 'Mission fully cleared in both Hearing and Writing.';
    return passed
      ? 'Perfect run recorded. You can repeat this phase anytime.'
      : `Missions require ${MISSION_PASSING_SCORE}% with no mistakes. Retry for a perfect clear.`;
  }
  return `Review complete with ${score}% accuracy.`;
}

function getMissionFollowUpPhase(session) {
  if (session?.kind !== 'mission') return null;
  const state = progress.missions[session.missionId];
  return MISSION_PHASES.find((phase) => phase.id !== session.missionPhase && state.phases[phase.id].clears === 0) || null;
}

function missionPhaseLabel(phaseId) {
  return MISSION_PHASES.find((phase) => phase.id === phaseId)?.label || 'Mission';
}

function renderReviewScreen() {
  return `
    <section class="review-screen">
      <p class="eyebrow">Review center</p>
      <h1>Choose how you want memory to be tested.</h1>
      <p>Listening and Writing keep one Standard French recall pathway isolated. Mixed and Adaptive are for switching practice once both pathways feel stable.</p>
      <div class="review-options">
        ${renderReviewModeButtons()}
      </div>
    </section>
  `;
}

function bindActions() {
  app.querySelectorAll('[data-action]').forEach((element) => {
    if (element.dataset.bound) return;
    element.dataset.bound = 'true';
    element.addEventListener('click', handleAction);
  });

  const form = app.querySelector('form[data-action="submit-answer"]');
  if (form) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      // When feedback is showing, the form's primary action is Continue.
      if (activeAnswer) {
        if (route.name === 'essential-challenge') {
          nextEssentialQuestion();
        } else {
          nextQuestion();
        }
        return;
      }
      if (route.name === 'essential-challenge') {
        submitEssentialAnswer(new FormData(form).get('answer'));
      } else {
        submitAnswer(new FormData(form).get('answer'));
      }
    });
  }

  const input = app.querySelector('#answer-input');
  if (input) {
    input.addEventListener('input', () => enforceAnswerKind(input));
  }

  focusAnswerInput();
  maybeAutoPlay();
  maybeAutoPlayLearnCard();
  maybeAutoPlayEssential();
}

// Allowed characters per expected answer kind:
//  - number  -> digits only
//  - french  -> letters (incl. accented), spaces, hyphens, apostrophes; no digits
const DISALLOWED_FOR = {
  number: /[^0-9]/g,
  french: /[^a-zA-ZàâäæçéèêëîïôœùûüÿÀÂÄÆÇÉÈÊËÎÏÔŒÙÛÜŸ\s'\-]/g,
};

function enforceAnswerKind(input) {
  const kind = input.dataset.expectedKind;
  const pattern = DISALLOWED_FOR[kind];
  if (!pattern) return;

  const cleaned = input.value.replace(pattern, '');
  if (cleaned === input.value) return;

  // Preserve caret position relative to removed characters.
  const removedBeforeCaret = input.value
    .slice(0, input.selectionStart ?? input.value.length)
    .replace(pattern, '').length;
  input.value = cleaned;
  input.setSelectionRange?.(removedBeforeCaret, removedBeforeCaret);
}

function maybeAutoPlay() {
  // Auto-play the number's audio whenever the user lands on a fresh, unanswered
  // challenge. Reaching a challenge is always preceded by a user gesture
  // (click/Enter), so browser autoplay policies allow this.
  if (route.name !== 'quiz' && route.name !== 'exam') {
    lastAutoPlayKey = null;
    return;
  }

  if (!activeSession || activeSession.finished || activeAnswer) {
    if (activeAnswer) lastAutoPlayKey = null;
    return;
  }

  const question = activeSession.questions[activeSession.index];
  if (!question) return;
  if (!question.type.audioOnly) return;

  const key = `${activeSession.index}-${question.card.number}-${question.type.id}`;
  if (key === lastAutoPlayKey) return; // guard against duplicate plays on re-render
  lastAutoPlayKey = key;

  speak(question.card);
}

function maybeAutoPlayLearnCard() {
  if (route.name !== 'learn') {
    lastLearnAutoPlayKey = null;
    return;
  }

  const levelId = route.levelId;
  const index = route.index || 0;
  const hasLesson = Boolean(PATTERN_LESSONS[levelId]);
  if (hasLesson && index === 0) return;

  const adjustedIndex = hasLesson ? index - 1 : index;
  const card = getLevelCards(levelId)[adjustedIndex];
  if (!card || !hasPlayableAudio(card)) return;

  const key = `${levelId}-${index}-${card.number}`;
  if (key === lastLearnAutoPlayKey) return;
  lastLearnAutoPlayKey = key;

  speak(card);
}

function maybeAutoPlayEssential() {
  if (route.name !== 'essential-challenge') {
    lastEssentialAutoPlayKey = null;
    return;
  }

  if (!activeEssentialSession || activeEssentialSession.finished || activeAnswer) {
    if (activeAnswer) lastEssentialAutoPlayKey = null;
    return;
  }

  const question = activeEssentialSession.questions[activeEssentialSession.index];
  if (!question || !shouldAutoPlayEssentialQuestion(question)) return;

  const key = `${activeEssentialSession.group.id}-${activeEssentialSession.index}-${question.item.id}`;
  if (key === lastEssentialAutoPlayKey) return;
  lastEssentialAutoPlayKey = key;

  speakEssential(question.item);
}

function focusAnswerInput() {
  if (activeAnswer) return;
  // Defer to the next frame so the freshly rendered input is laid out and
  // focusable, ensuring focus reliably returns on every challenge transition.
  window.requestAnimationFrame(() => {
    const input = app.querySelector('#answer-input');
    if (!input || input.disabled) return;
    input.focus();
    const caret = input.value.length;
    input.setSelectionRange?.(caret, caret);
  });
}

function handleAction(event) {
  const target = event.currentTarget;
  const action = target.dataset.action;
  if (action === 'dashboard') goDashboard();
  if (action === 'continue-level') continueLevel(Number(target.dataset.level));
  if (action === 'start-level-master') startLevelDimensionMastery(Number(target.dataset.level));
  if (action === 'start-mission') startMission(target.dataset.mission, target.dataset.phase);
  if (action === 'start-essential-challenge') startEssentialChallenge(target.dataset.group);
  if (action === 'restart-essential-challenge') startEssentialChallenge(target.dataset.group);
  if (action === 'next-learn') nextLearn(Number(target.dataset.level), Number(target.dataset.index));
  if (action === 'play-audio') playCardAudio(Number(target.dataset.number));
  if (action === 'play-essential-audio') playEssentialAudio(target.dataset.vocab);
  if (action === 'next-question') nextQuestion();
  if (action === 'next-essential-question') nextEssentialQuestion();
  if (action === 'start-review') startReview(target.dataset.mode);
  if (action === 'start-exam') startExam();
  if (action === 'finish-session') finishSession();
}

function goDashboard() {
  activeSession = null;
  activeEssentialSession = null;
  activeAnswer = null;
  lastAutoPlayKey = null;
  lastEssentialAutoPlayKey = null;
  stopAudio();
  route = { name: 'dashboard' };
  render();
}

function continueLevel(levelId) {
  if (!isLevelUnlocked(levelId)) return;
  const state = getLevelState(levelId);
  const totalCards = getLevelCards(levelId).length;
  activeAnswer = null;

  if (!state.learnComplete) {
    route = { name: 'learn', levelId, index: 0 };
  } else if (masteredCount(levelId) < totalCards) {
    startLevelMastery(levelId);
    return;
  } else if (!state.reviewPassed) {
    startLevelReview(levelId);
    return;
  } else {
    route = { name: 'dashboard' };
  }

  render();
}

function nextLearn(levelId, index) {
  const hasLesson = Boolean(PATTERN_LESSONS[levelId]);
  const maxIndex = getLevelCards(levelId).length + (hasLesson ? 1 : 0) - 1;

  if (index >= maxIndex) {
    progress.levels[levelId].learnComplete = true;
    saveProgress();
    startLevelMastery(levelId);
    return;
  }

  route = { name: 'learn', levelId, index: index + 1 };
  render();
}

function startLevelMastery(levelId) {
  activeEssentialSession = null;
  activeSession = {
    kind: 'mastery',
    title: `Level ${levelId} Mastery Review`,
    levelId,
    questions: buildMasteryQuestions(levelId),
    index: 0,
    answered: 0,
    correct: 0,
    finished: false,
  };
  activeAnswer = null;
  route = { name: 'quiz', levelId };
  render();
}

function buildMasteryQuestions(levelId) {
  const state = getLevelState(levelId);
  return getLevelCards(levelId)
    .filter((card) => !state.cards[card.number].mastered)
    .sort((a, b) => state.cards[b.number].misses - state.cards[a.number].misses || state.cards[a.number].streak - state.cards[b.number].streak)
    .map((card) => ({ card, type: pickQuestionType(card) }));
}

function startLevelReview(levelId) {
  activeSession = {
    kind: 'level-review',
    title: `Level ${levelId} Review`,
    levelId,
    questions: shuffle(getLevelCards(levelId)).map((card, index) => ({ card, type: pickMixedQuestionType(card, index) })),
    index: 0,
    answered: 0,
    correct: 0,
    missed: [],
    finished: false,
  };
  activeAnswer = null;
  route = { name: 'quiz', levelId };
  render();
}

function startLevelDimensionMastery(levelId, dimension = nextLevelMasteryDimension(levelId)) {
  if (!progress.levels[levelId].completed) return;
  activeEssentialSession = null;
  activeSession = {
    kind: 'dimension-master',
    title: `Level ${levelId} ${dimensionLabel(dimension)} Mastery`,
    levelId,
    dimension,
    questions: buildDimensionMasteryQuestions(levelId, dimension),
    index: 0,
    answered: 0,
    correct: 0,
    finished: false,
  };
  activeAnswer = null;
  route = { name: 'quiz', levelId };
  render();
}

function buildDimensionMasteryQuestions(levelId, dimension) {
  const types = getQuestionTypesForDimension(dimension);
  return shuffle(
    getLevelCards(levelId).flatMap((card) => getAvailableQuestionTypes(card, types).map((type) => ({ card, type }))),
  );
}

function getQuestionTypesForDimension(dimension) {
  return QUESTION_TYPES.filter((type) => (dimension === 'hearing' ? type.audioOnly : !type.audioOnly));
}

function startMission(missionId, phaseId) {
  const mission = MISSIONS.find((item) => item.id === missionId);
  if (!mission || !isLevelUnlocked(mission.levelId)) return;
  const phase = MISSION_PHASES.find((item) => item.id === (phaseId || nextMissionPhaseId(missionId)));
  if (!phase) return;

  activeEssentialSession = null;
  activeSession = {
    kind: 'mission',
    title: `${mission.title} ${phase.label}`,
    missionId: mission.id,
    missionPhase: phase.id,
    questions: buildMissionQuestions(mission, phase),
    index: 0,
    answered: 0,
    correct: 0,
    finished: false,
  };
  activeAnswer = null;
  route = { name: 'quiz' };
  render();
}

function buildMissionQuestions(mission, phase) {
  const type = QUESTION_TYPES.find((questionType) => questionType.id === phase.questionTypeId);
  return getMissionNumbers(mission)
    .map(getMissionCard)
    .filter((card) => !type.audioOnly || hasPlayableAudio(card))
    .map((card) => ({ card, type }));
}

function startEssentialChallenge(groupId) {
  const group = ESSENTIAL_GROUPS.find((item) => item.id === groupId);
  if (!group) return;

  activeSession = null;
  activeEssentialSession = {
    group,
    questions: buildEssentialQuestions(group),
    index: 0,
    answered: 0,
    correct: 0,
    finished: false,
  };
  activeAnswer = null;
  lastEssentialAutoPlayKey = null;
  route = { name: 'essential-challenge', groupId: group.id };
  render();
}

function buildEssentialQuestions(group) {
  const questions = buildEssentialChallengeQuestions(group);
  if (!isCalendarSequenceGroup(group)) return shuffle(questions);

  const sequenceQuestion = questions.find((question) => question.mode === 'sequence');
  return [
    ...shuffle(questions.filter((question) => question.mode !== 'sequence')),
    sequenceQuestion,
  ].filter(Boolean);
}

function submitEssentialAnswer(value) {
  if (!activeEssentialSession || activeAnswer) return;
  const question = activeEssentialSession.questions[activeEssentialSession.index];
  const expectedKind = getEssentialAnswerKind(question);
  const answerTarget = expectedKind === 'sequence' ? question.items : question.item;
  const correct = validateEssentialAnswer(value, answerTarget, expectedKind);
  activeEssentialSession.answered += 1;
  if (correct) activeEssentialSession.correct += 1;
  activeAnswer = { correct, expectedKind };
  render();
  if (question.item && (correct || expectedKind === 'english')) speakEssential(question.item);
}

function nextEssentialQuestion() {
  if (!activeEssentialSession) return;
  activeAnswer = null;

  if (activeEssentialSession.index < activeEssentialSession.questions.length - 1) {
    activeEssentialSession.index += 1;
  } else {
    activeEssentialSession.finished = true;
  }

  render();
}

function getMissionNumbers(mission) {
  if (Array.isArray(mission.numbers)) return mission.numbers;

  const [start, end] = mission.range;
  const step = mission.step || 1;
  const length = Math.floor((end - start) / step) + 1;
  return Array.from({ length }, (_, index) => start + index * step);
}

function getMissionCard(number) {
  return getCard(number) || buildNumberCard(number);
}

function startReview(mode) {
  const cards = getUnlockedCards();
  if (cards.length === 0) return;
  const reviewMode = getReviewMode(mode);
  const questions = buildReviewQuestions(cards, reviewMode.id);
  if (questions.length === 0) return;
  activeEssentialSession = null;
  activeSession = {
    kind: 'review',
    title: reviewMode.title,
    mode: reviewMode.id,
    questions,
    index: 0,
    answered: 0,
    correct: 0,
    finished: false,
  };
  activeAnswer = null;
  route = { name: 'quiz' };
  render();
}

function buildReviewQuestions(cards, mode) {
  if (mode === 'listening') {
    const audioToNumber = QUESTION_TYPES.find((type) => type.id === 'audio-to-number');
    return shuffle(cards)
      .filter((card) => hasPlayableAudio(card))
      .slice(0, Math.min(cards.length, 30))
      .map((card) => ({ card, type: audioToNumber }));
  }

  if (mode === 'writing') {
    const numberToFrench = QUESTION_TYPES.find((type) => type.id === 'number-to-french');
    return shuffle(cards)
      .slice(0, Math.min(cards.length, 30))
      .map((card) => ({ card, type: numberToFrench }));
  }

  const ordered = orderReviewCards(cards, mode).slice(0, Math.min(cards.length, 30));
  return ordered.map((card, index) => ({ card, type: pickMixedQuestionType(card, index) }));
}

function getReviewMode(mode) {
  if (mode === 'random') return REVIEW_MODES.find((item) => item.id === 'mixed');
  return REVIEW_MODES.find((item) => item.id === mode) || REVIEW_MODES.find((item) => item.id === 'mixed');
}

function startExam() {
  if (!allLevelsComplete()) return;
  activeEssentialSession = null;
  activeSession = {
    kind: 'exam',
    title: 'Final Exam',
    questions: buildFinalExamQuestions(),
    index: 0,
    answered: 0,
    correct: 0,
    finished: false,
  };
  activeAnswer = null;
  route = { name: 'exam' };
  render();
}

function submitAnswer(value) {
  if (!activeSession || activeAnswer) return;
  const question = activeSession.questions[activeSession.index];
  const correct = validateAnswer(value, question.card, question.type.expectedKind);
  const cardState = getProgressCardState(question.card);

  activeSession.answered += 1;
  if (correct) activeSession.correct += 1;

  if (activeSession.kind === 'mastery' || activeSession.kind === 'review') {
    updateCardMastery(question.card, correct);
  } else if (cardState) {
    cardState.attempts += 1;
    if (!correct) {
      cardState.misses += 1;
      activeSession.missed?.push(question.card.number);
    }
  } else if (!correct) {
    activeSession.missed?.push(question.card.number);
  }

  activeAnswer = { correct };
  saveProgress();
  render();
  if (shouldPlayAnswerAudio(question, correct)) speak(question.card);
}

function shouldPlayAnswerAudio(question, correct) {
  if (question.type.expectedKind === 'french') return true;
  return correct;
}

function updateCardMastery(card, correct) {
  const cardState = progress.levels[card.levelId].cards[card.number];
  cardState.attempts += 1;
  if (correct) {
    cardState.streak += 1;
    cardState.mastered = cardState.streak >= MASTERY_TARGET;
  } else {
    cardState.streak = 0;
    cardState.mastered = false;
    cardState.misses += 1;
  }
}

function getProgressCardState(card) {
  return progress.levels[card.levelId]?.cards?.[card.number] || null;
}

function nextQuestion() {
  if (!activeSession) return;
  activeAnswer = null;

  if (activeSession.kind === 'mastery') {
    activeSession.questions = buildMasteryQuestions(activeSession.levelId);
    activeSession.index = 0;
    if (activeSession.questions.length === 0) {
      startLevelReview(activeSession.levelId);
      return;
    }
    render();
    return;
  }

  if (activeSession.index < activeSession.questions.length - 1) {
    activeSession.index += 1;
  } else {
    completeSession();
  }

  render();
}

function completeSession() {
  activeSession.finished = true;
  const score = Math.round((activeSession.correct / activeSession.answered) * 100) || 0;

  if (activeSession.kind === 'level-review') {
    const passed = didSessionPass(activeSession, score);
    const levelState = progress.levels[activeSession.levelId];
    levelState.reviewPassed = passed;
    levelState.completed = passed;
    for (const number of activeSession.missed) {
      levelState.cards[number].streak = 0;
      levelState.cards[number].mastered = false;
    }
  }

  if (activeSession.kind === 'exam') {
    progress.finalExam.lastScore = score;
    progress.finalExam.bestScore = Math.max(progress.finalExam.bestScore, score);
    progress.finalExam.passed = score >= FINAL_EXAM_PASSING_SCORE;
  }

  if (activeSession.kind === 'dimension-master') {
    const dimensionState = progress.levels[activeSession.levelId].mastery[activeSession.dimension];
    dimensionState.lastScore = score;
    dimensionState.bestScore = Math.max(dimensionState.bestScore, score);
    dimensionState.passed = dimensionState.passed || score === DIMENSION_MASTERY_SCORE;
  }

  if (activeSession.kind === 'mission') {
    const missionState = progress.missions[activeSession.missionId].phases[activeSession.missionPhase];
    missionState.attempts += 1;
    missionState.lastScore = score;
    missionState.bestScore = Math.max(missionState.bestScore, score);
    if (score === MISSION_PASSING_SCORE) {
      missionState.clears += 1;
      missionState.lastClearedAt = new Date().toISOString();
    }
  }

  saveProgress();
}

function finishSession() {
  const followUpLevel = activeSession?.kind === 'level-review' && !progress.levels[activeSession.levelId].completed ? activeSession.levelId : null;
  const followUpDimensionLevel = activeSession?.kind === 'dimension-master'
    && isLevelDimensionMastered(activeSession.levelId, activeSession.dimension)
    && !isLevelFullyMastered(activeSession.levelId)
    ? activeSession.levelId
    : null;
  const score = activeSession ? Math.round((activeSession.correct / activeSession.answered) * 100) || 0 : 0;
  const followUpMissionPhase = didSessionPass(activeSession, score) ? getMissionFollowUpPhase(activeSession) : null;
  const followUpMissionId = followUpMissionPhase ? activeSession.missionId : null;
  activeSession = null;
  activeAnswer = null;
  lastAutoPlayKey = null;
  stopAudio();
  if (followUpMissionId && followUpMissionPhase) {
    startMission(followUpMissionId, followUpMissionPhase.id);
    return;
  }
  if (followUpDimensionLevel) {
    startLevelDimensionMastery(followUpDimensionLevel);
    return;
  }
  if (followUpLevel) {
    continueLevel(followUpLevel);
    return;
  }
  route = { name: 'dashboard' };
  render();
}

function getUnlockedCards() {
  const maxLevel = allLevelsComplete() ? LEVELS.at(-1).id : currentLevelId();
  return NUMBER_CARDS.filter((card) => card.levelId <= maxLevel && progress.levels[card.levelId].learnComplete);
}

function orderReviewCards(cards, mode) {
  if (mode === 'adaptive') {
    return buildAdaptiveReviewCards(cards);
  }
  return shuffle(cards);
}

function buildAdaptiveReviewCards(cards) {
  return shuffle(cards.flatMap((card) => Array.from({ length: adaptiveWeight(card) }, () => card)));
}

function adaptiveWeight(card) {
  return Math.min(6, Math.max(1, adaptiveScore(card)));
}

function adaptiveScore(card) {
  const cardState = progress.levels[card.levelId].cards[card.number];
  const streakGap = Math.max(0, MASTERY_TARGET - cardState.streak);
  return 1 + cardState.misses + streakGap + (cardState.mastered ? 0 : 2);
}

function pickQuestionType(card, forceMixed = false) {
  const cardState = progress.levels[card.levelId].cards[card.number];
  const offset = forceMixed ? card.number : cardState.attempts + cardState.misses;
  const types = getAvailableQuestionTypes(card);
  return types[offset % types.length];
}

function pickMixedQuestionType(card, index) {
  const types = shuffle(getAvailableQuestionTypes(card));
  return types[index % types.length];
}

function buildFinalExamQuestions() {
  return shuffle(NUMBER_CARDS).map((card, index) => ({ card, type: pickMixedQuestionType(card, index) }));
}

function getAvailableQuestionTypes(card, types = QUESTION_TYPES) {
  return types.filter((type) => !type.audioOnly || hasPlayableAudio(card));
}

function didSessionPass(session, score) {
  if (session.kind === 'exam') return score >= FINAL_EXAM_PASSING_SCORE;
  if (session.kind === 'dimension-master') return score === DIMENSION_MASTERY_SCORE;
  if (session.kind === 'mission') return score === MISSION_PASSING_SCORE;
  if (session.kind === 'level-review') {
    return score >= LEVEL_REVIEW_PASSING_SCORE && session.missed.length === 0;
  }
  return true;
}

function getCard(number) {
  return NUMBER_CARDS.find((card) => card.number === number) || (GENERATED_AUDIO_NUMBERS.has(number) ? buildNumberCard(number) : undefined);
}

function hasRecordedAudio(cardOrNumber) {
  const number = typeof cardOrNumber === 'number' ? cardOrNumber : cardOrNumber.number;
  return RECORDED_AUDIO_NUMBERS.has(number);
}

function hasPlayableAudio(cardOrNumber) {
  const number = typeof cardOrNumber === 'number' ? cardOrNumber : cardOrNumber.number;
  return hasRecordedAudio(number) || GENERATED_AUDIO_NUMBERS.has(number);
}

function speak(card) {
  if (!card) return;
  stopAudio();

  if (!hasRecordedAudio(card)) {
    speakGeneratedAudio(card);
    return;
  }

  const audio = new Audio(new URL(`${card.number}.mp3`, AUDIO_BASE_URL).href);
  audio.preload = 'auto';
  activeAudio = audio;
  audio.addEventListener('ended', () => {
    if (activeAudio === audio) activeAudio = null;
  });
  audio.addEventListener('error', () => {
    if (activeAudio === audio) activeAudio = null;
  });
  audio.play().catch(() => {
    if (activeAudio === audio) activeAudio = null;
  });
}

function speakGeneratedAudio(card) {
  if (!GENERATED_AUDIO_NUMBERS.has(card.number) || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
    return;
  }

  const utterance = new SpeechSynthesisUtterance(card.french);
  utterance.lang = 'fr-FR';
  utterance.rate = 0.85;
  activeSpeech = utterance;
  utterance.addEventListener('end', () => {
    if (activeSpeech === utterance) activeSpeech = null;
  });
  utterance.addEventListener('error', () => {
    if (activeSpeech === utterance) activeSpeech = null;
  });
  window.speechSynthesis.speak(utterance);
}

function stopAudio() {
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.currentTime = 0;
    activeAudio = null;
  }
  if (activeSpeech) {
    window.speechSynthesis.cancel();
    activeSpeech = null;
  }
}

function playCardAudio(number) {
  speak(getCard(number));
}

function playEssentialAudio(id) {
  const item = ESSENTIAL_ITEMS.find((candidate) => candidate.id === id);
  if (!item) return;
  speakEssential(item);
}

function speakEssential(item) {
  stopAudio();
  const audio = new Audio(new URL(`${item.id}.mp3`, ESSENTIAL_AUDIO_BASE_URL).href);
  audio.preload = 'auto';
  activeAudio = audio;
  audio.addEventListener('ended', () => {
    if (activeAudio === audio) activeAudio = null;
  });
  audio.addEventListener(
    'error',
    () => {
      if (activeAudio === audio) activeAudio = null;
      speakEssentialFallback(item);
    },
    { once: true },
  );
  audio.play().catch(() => {
    if (activeAudio === audio) activeAudio = null;
    speakEssentialFallback(item);
  });
}

function speakEssentialFallback(item) {
  if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') return;

  const utterance = new SpeechSynthesisUtterance(item.french);
  utterance.lang = 'fr-FR';
  utterance.rate = 0.85;
  activeSpeech = utterance;
  utterance.addEventListener('end', () => {
    if (activeSpeech === utterance) activeSpeech = null;
  });
  utterance.addEventListener('error', () => {
    if (activeSpeech === utterance) activeSpeech = null;
  });
  window.speechSynthesis.speak(utterance);
}

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}
