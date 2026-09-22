/* ngo-quiz.js — caribbean.countdowns.co/ngo-quiz/ */

// ─── Language ───────────────────────────────────────────────────────────────

var LANGS = ["en", "fr", "kr", "es"];
var lang = localStorage.getItem("lang") || "en";

function applyLang() {
  LANGS.forEach(function(l) {
    document.querySelectorAll(".t-" + l).forEach(function(el) {
      el.style.display = l === lang ? (el.tagName === "DIV" || el.tagName === "P" ? "block" : "inline") : "none";
    });
  });
  document.documentElement.lang = lang;
  document.querySelectorAll(".lang-btn").forEach(function(btn) {
    btn.classList.toggle("active", btn.getAttribute("data-lang") === lang);
  });
}

window.setLang = function(l) {
  lang = l;
  localStorage.setItem("lang", lang);
  applyLang();
  renderQuizQuestion(); // re-render current question in new lang
};

document.querySelectorAll(".lang-btn").forEach(function(btn) {
  btn.addEventListener("click", function() {
    window.setLang(btn.getAttribute("data-lang"));
  });
});

applyLang();

// ─── Config ──────────────────────────────────────────────────────────────────

var STATS_URL = "/api/ngo-stats";
var QUIZ_TRIGGER_THRESHOLD = 25; // must match workers/ngo-stats' TRIGGER_THRESHOLD

// Fallback value used while the Worker responds or if it fails
var passingRounds = 0;

// ─── Quiz → ngo-stats bridge ───────────────────────────────────────────────
// Every passing round (score/total >= 3/5) increments a shared, community-wide
// counter in ngo-stats — that's what workers/ngo-fight's checkQuizTrigger reads
// to decide whether to extend or force-close the current fight season (see
// /ngo-support/'s ngo-support.js). No per-user local tracking anymore: passing is
// a plain per-round server-side yes/no, nothing to blend with a personal total.

function checkMissionThreshold(rounds) {
  if (rounds >= QUIZ_TRIGGER_THRESHOLD) {
    showMissionAccomplished();
  }
}

// ─── Worker API ──────────────────────────────────────────────────────────────

function fetchStats() {
  fetch(STATS_URL)
    .then(function(r) { return r.json(); })
    .then(function(data) {
      passingRounds = typeof data.passingRounds === "number" ? data.passingRounds : passingRounds;
      checkMissionThreshold(passingRounds);
    })
    .catch(function() {
      // Worker unreachable — keep fallback value already displayed
    });
}

function postRoundResult(score, total) {
  return fetch(STATS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ score: score, total: total })
  })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      passingRounds = typeof data.passingRounds === "number" ? data.passingRounds : passingRounds;
      return passingRounds;
    })
    .catch(function() {
      // Worker unreachable — local state still updated
      return passingRounds;
    });
}

// ─── Quiz data ───────────────────────────────────────────────────────────────
// Edit questions in src/data/quiz-questions.json — no JS changes needed.

var QUESTIONS = JSON.parse(document.getElementById("quiz-data").getAttribute("data-questions"));

var QUESTIONS_PER_SESSION = 5;
var MAX_SESSIONS = 3;
var sessionQuestions = [];
var sessionCurrentIndices = [];

function shuffle(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

function getSessionCount() {
  return parseInt(localStorage.getItem("ngo_quiz_sessions") || "0", 10);
}

function getShownIndices() {
  try { return JSON.parse(localStorage.getItem("ngo_quiz_shown") || "[]"); }
  catch { return []; }
}

function saveSessionComplete(indices) {
  var shown = getShownIndices().concat(indices);
  localStorage.setItem("ngo_quiz_shown", JSON.stringify(shown));
  localStorage.setItem("ngo_quiz_sessions", getSessionCount() + 1);
}

function updateQuizButton() {
  var sessions = getSessionCount();
  var btn = document.getElementById("btn-start-quiz");
  if (sessions >= MAX_SESSIONS) {
    btn.disabled = true;
    btn.textContent = "";
    btn.appendChild(Object.assign(document.createElement("span"), { className: "t-en", textContent: "Quiz completed — thank you! 🌊" }));
    btn.appendChild(Object.assign(document.createElement("span"), { className: "t-fr", textContent: "Quiz terminé — merci ! 🌊" }));
    btn.appendChild(Object.assign(document.createElement("span"), { className: "t-kr", textContent: "Quiz fini — mèsi ! 🌊" }));
    btn.appendChild(Object.assign(document.createElement("span"), { className: "t-es", textContent: "Quiz completado — ¡gracias! 🌊" }));
    applyLang();
  }
}

// ─── Quiz state ───────────────────────────────────────────────────────────────

var quizState = {
  current: 0,
  score: 0,
  answered: false,
  active: false
};

function startQuiz() {
  if (getSessionCount() >= MAX_SESSIONS) return;

  // Quiz auto-starts on page load (see Init below) — the "Take the quiz" button
  // is now redundant once a session actually begins. Hidden here rather than in
  // the early-return above so a maxed-out visitor still sees the disabled button
  // + "Quiz completed" message from updateQuizButton().
  var quizCta = document.querySelector(".quiz-cta");
  if (quizCta) quizCta.style.display = "none";

  var shown = getShownIndices();
  var unseen = shuffle(
    QUESTIONS.map(function(_, i) { return i; })
      .filter(function(i) { return shown.indexOf(i) === -1; })
  ).slice(0, QUESTIONS_PER_SESSION);

  sessionCurrentIndices = unseen;
  sessionQuestions = unseen.map(function(i) { return QUESTIONS[i]; });

  quizState.current = 0;
  quizState.score = 0;
  quizState.answered = false;
  quizState.active = true;

  document.getElementById("quiz-section").classList.add("visible");
  document.getElementById("quiz-result").classList.remove("visible");
  document.getElementById("mission-accomplished").classList.remove("visible");
  document.getElementById("btn-start-quiz").disabled = true;

  buildDots();
  renderQuizQuestion();
  document.getElementById("quiz-section").scrollIntoView({ behavior: "smooth", block: "start" });
}

function buildDots() {
  var container = document.getElementById("quiz-dots");
  while (container.firstChild) container.removeChild(container.firstChild);
  sessionQuestions.forEach(function(_, i) {
    var dot = document.createElement("div");
    dot.className = "quiz-dot" + (i === 0 ? " active" : "");
    dot.id = "dot-" + i;
    container.appendChild(dot);
  });
}

function updateDots() {
  sessionQuestions.forEach(function(_, i) {
    var dot = document.getElementById("dot-" + i);
    if (!dot) return;
    dot.className = "quiz-dot" +
      (i < quizState.current ? " done" : "") +
      (i === quizState.current ? " active" : "");
  });
}

function renderQuizQuestion() {
  if (!quizState.active) return;
  var idx = quizState.current;
  if (idx >= sessionQuestions.length) return;

  var q = sessionQuestions[idx];
  var data = q[lang] || q.en;

  var stepLabel = document.getElementById("quiz-step-label");
  var stepTexts = {
    en: "Question " + (idx + 1) + " of " + sessionQuestions.length,
    fr: "Question " + (idx + 1) + " sur " + sessionQuestions.length,
    kr: "Kèstyon " + (idx + 1) + " sou " + sessionQuestions.length,
    es: "Pregunta " + (idx + 1) + " de " + sessionQuestions.length
  };
  stepLabel.textContent = stepTexts[lang] || stepTexts.en;

  document.getElementById("quiz-question").textContent = data.q;

  var optContainer = document.getElementById("quiz-options");
  optContainer.innerHTML = "";
  var letters = ["A", "B", "C", "D"];
  data.opts.forEach(function(opt, i) {
    var btn = document.createElement("button");
    btn.className = "quiz-option";

    var letterSpan = document.createElement("span");
    letterSpan.className = "opt-letter";
    letterSpan.textContent = letters[i];

    var textSpan = document.createElement("span");
    textSpan.className = "opt-text";
    textSpan.textContent = opt;

    btn.appendChild(letterSpan);
    btn.appendChild(textSpan);

    btn.addEventListener("click", function() {
      if (quizState.answered) return;
      selectAnswer(i);
    });
    optContainer.appendChild(btn);
  });

  var feedback = document.getElementById("quiz-feedback");
  feedback.textContent = "";
  feedback.className = "quiz-feedback";

  var nextBtn = document.getElementById("quiz-next");
  nextBtn.className = "quiz-next";

  updateDots();
}

function selectAnswer(chosen) {
  quizState.answered = true;
  var idx = quizState.current;
  var q = sessionQuestions[idx];
  var data = q[lang] || q.en;
  var correct = q.answer;
  var isCorrect = chosen === correct;

  if (isCorrect) quizState.score++;

  var opts = document.querySelectorAll(".quiz-option");
  opts.forEach(function(btn, i) {
    btn.disabled = true;
    if (i === correct) btn.classList.add("correct");
    else if (i === chosen && !isCorrect) btn.classList.add("wrong");
  });

  var feedback = document.getElementById("quiz-feedback");
  var correctTexts = {
    en: "Correct! ",
    fr: "Correct ! ",
    kr: "Korrèk ! ",
    es: "¡Correcto! "
  };
  var wrongTexts = {
    en: "Not quite. ",
    fr: "Pas tout à fait. ",
    kr: "Pa tout a fè. ",
    es: "No del todo. "
  };
  var prefix = isCorrect ? (correctTexts[lang] || correctTexts.en) : (wrongTexts[lang] || wrongTexts.en);
  feedback.textContent = prefix + (data.explain || "");
  feedback.className = "quiz-feedback visible" + (isCorrect ? "" : " wrong-fb");

  var nextBtn = document.getElementById("quiz-next");
  var isLast = (idx === sessionQuestions.length - 1);
  nextBtn.innerHTML = isLast
    ? '<span class="t-en">See my results →</span><span class="t-fr">Voir mes résultats →</span><span class="t-kr">Wè rezilta mwen →</span><span class="t-es">Ver mis resultados →</span>'
    : '<span class="t-en">Next →</span><span class="t-fr">Suivant →</span><span class="t-kr">Swivan →</span><span class="t-es">Siguiente →</span>';
  nextBtn.className = "quiz-next visible";
  applyLang();
}

function nextQuestion() {
  quizState.answered = false;
  quizState.current++;

  if (quizState.current >= sessionQuestions.length) {
    showResult();
    return;
  }

  renderQuizQuestion();
}

function showResult() {
  quizState.active = false;
  document.getElementById("quiz-section").classList.remove("visible");
  document.getElementById("quiz-result").classList.add("visible");
  document.getElementById("quiz-next").className = "quiz-next";

  var score = quizState.score;
  var total = sessionQuestions.length;
  var passed = score / total >= 0.6; // 3/5 — must match workers/ngo-stats' PASS_RATIO

  saveSessionComplete(sessionCurrentIndices);

  var sessionsNow = getSessionCount();
  var sessionsLeft = MAX_SESSIONS - sessionsNow;

  document.getElementById("result-score").textContent = score + "/" + total;

  var resultTexts = {
    en: score >= 4 ? "Excellent! You really know your Caribbean marine ecosystems." :
        score >= 3 ? "Good job! Every question answered helps the mission." :
                     "Thanks for playing — keep learning to do better next time!",
    fr: score >= 4 ? "Excellent ! Vous connaissez vraiment les écosystèmes marins de la Caraïbe." :
        score >= 3 ? "Bon travail ! Chaque réponse aide la mission." :
                     "Merci de jouer — continuez à apprendre pour faire mieux la prochaine fois !",
    kr: score >= 4 ? "Ekselan ! Ou vrèman konnen ekosistèm maren Karayib la." :
        score >= 3 ? "Bon travay ! Chak repons édé misyon an." :
                     "Mèsi pou jwe — kontinye aprann pou fè miyò pwochen fwa !",
    es: score >= 4 ? "¡Excelente! Realmente conoces los ecosistemas marinos del Caribe." :
        score >= 3 ? "¡Buen trabajo! Cada respuesta ayuda a la misión." :
                     "¡Gracias por jugar — sigue aprendiendo para hacerlo mejor la próxima vez!"
  };
  document.getElementById("result-label").textContent = resultTexts[lang] || resultTexts.en;

  var roundLabel = document.getElementById("result-round-label");
  if (roundLabel) {
    var roundTexts = sessionsLeft > 0
      ? {
          en: "Round " + sessionsNow + " of " + MAX_SESSIONS + " — " + sessionsLeft + " round" + (sessionsLeft > 1 ? "s" : "") + " remaining.",
          fr: "Manche " + sessionsNow + " sur " + MAX_SESSIONS + " — " + sessionsLeft + " manche" + (sessionsLeft > 1 ? "s" : "") + " restante" + (sessionsLeft > 1 ? "s" : "") + ".",
          kr: "Manche " + sessionsNow + " sou " + MAX_SESSIONS + " — " + sessionsLeft + " manche " + (sessionsLeft > 1 ? "rete yo" : "rete") + ".",
          es: "Ronda " + sessionsNow + " de " + MAX_SESSIONS + " — " + sessionsLeft + " ronda" + (sessionsLeft > 1 ? "s" : "") + " restante" + (sessionsLeft > 1 ? "s" : "") + "."
        }
      : {
          en: "You've completed all " + MAX_SESSIONS + " rounds — thank you for supporting L'Asso-Mer! 🌊",
          fr: "Vous avez terminé les " + MAX_SESSIONS + " manches — merci de soutenir L'Asso-Mer ! 🌊",
          kr: "Ou fini tout " + MAX_SESSIONS + " manche yo — mèsi pou sipòte L'Asso-Mer ! 🌊",
          es: "Has completado las " + MAX_SESSIONS + " rondas — ¡gracias por apoyar a L'Asso-Mer! 🌊"
        };
    roundLabel.textContent = roundTexts[lang] || roundTexts.en;
  }

  var replayBtn = document.getElementById("btn-replay");
  if (replayBtn) replayBtn.style.display = sessionsLeft > 0 ? "" : "none";

  updateQuizButton();

  postRoundResult(score, total).then(function(newPassingRounds) {
    var contributionTexts = passed
      ? {
          en: "This round counts! " + newPassingRounds + "/" + QUIZ_TRIGGER_THRESHOLD + " rounds toward the next countdown extension.",
          fr: "Cette manche compte ! " + newPassingRounds + "/" + QUIZ_TRIGGER_THRESHOLD + " manches avant la prochaine extension du décompte.",
          kr: "Manche sa a konte ! " + newPassingRounds + "/" + QUIZ_TRIGGER_THRESHOLD + " manche anvan pwochen ekstansyon dekont la.",
          es: "¡Esta ronda cuenta! " + newPassingRounds + "/" + QUIZ_TRIGGER_THRESHOLD + " rondas para la próxima extensión de la cuenta regresiva."
        }
      : {
          en: "Score 3/5 or higher to help extend the countdown.",
          fr: "Obtenez 3/5 ou plus pour aider à prolonger le décompte.",
          kr: "Fè 3/5 oswa plis pou ede pwolonje dekont la.",
          es: "Obtén 3/5 o más para ayudar a extender la cuenta regresiva."
        };
    document.getElementById("result-contribution").textContent = contributionTexts[lang] || contributionTexts.en;
    checkMissionThreshold(newPassingRounds);
  });

  applyLang();

  document.getElementById("quiz-result").scrollIntoView({ behavior: "smooth", block: "start" });
}

function showMissionAccomplished() {
  document.getElementById("quiz-result").classList.remove("visible");
  document.getElementById("quiz-section").classList.remove("visible");
  document.getElementById("mission-accomplished").classList.add("visible");
  document.getElementById("btn-start-quiz").disabled = true;
  document.getElementById("btn-start-quiz").innerHTML =
    '<span class="t-en">🎉 Mission complete!</span>' +
    '<span class="t-fr">🎉 Mission accomplie !</span>' +
    '<span class="t-kr">🎉 Misyon akonpli !</span>' +
    '<span class="t-es">🎉 ¡Misión cumplida!</span>';
  applyLang();
}

// ─── Event listeners ──────────────────────────────────────────────────────────

document.getElementById("btn-start-quiz").addEventListener("click", function() {
  startQuiz();
});

document.getElementById("quiz-next").addEventListener("click", function() {
  nextQuestion();
});

document.getElementById("btn-replay").addEventListener("click", function() {
  if (getSessionCount() >= MAX_SESSIONS) return;
  document.getElementById("quiz-result").classList.remove("visible");
  startQuiz();
});

// ─── Init ─────────────────────────────────────────────────────────────────────

setTimeout(function() {
  checkMissionThreshold(passingRounds);
  fetchStats();
}, 400);

updateQuizButton();

// Auto-start: question 1 is ready the moment the page loads, no click needed.
// No-ops via the existing session-limit check if this visitor already used all
// MAX_SESSIONS rounds — updateQuizButton() above already covers that state.
startQuiz();
