/* ngo.js — caribbean.countdowns.co */

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

// Fallback values used while the Worker responds or if it fails
var communityProgress = 0;
var communityContributors = 0;

var MAX_USER_TOTAL   = 25;   // max % a single user can contribute in total
var MAX_PER_SESSION  = 5;    // max % per quiz session (perfect score)

// ─── Quiz → ngo-stats bridge ───────────────────────────────────────────────
// The quiz score still feeds ngo-stats' communityProgress (0-100%) — that's
// what workers/ngo-fight's checkQuizTrigger reads to decide whether to extend
// or force-close the current fight season (see the Fight module below). There
// is no visible gauge for it anymore (the old .gauge-wrap markup is gone,
// replaced by the Fight block) — this is purely the data pipeline plus the
// 100%-threshold trigger, decoupled from any rendering.

function getUserContribution() {
  return Math.min(parseFloat(localStorage.getItem("ngo_contribution") || "0"), MAX_USER_TOTAL);
}

function addUserContribution(pct) {
  var current = getUserContribution();
  var next = Math.min(current + pct, MAX_USER_TOTAL);
  localStorage.setItem("ngo_contribution", next.toFixed(2));
  return next - current;
}

function getTotalProgress() {
  return Math.min(communityProgress + getUserContribution(), 100);
}

function checkMissionThreshold(pct) {
  if (pct >= 100) {
    showMissionAccomplished();
  }
}

// ─── Worker API ──────────────────────────────────────────────────────────────

function fetchStats() {
  fetch(STATS_URL)
    .then(function(r) { return r.json(); })
    .then(function(data) {
      communityProgress = data.communityProgress !== null ? data.communityProgress : communityProgress;
      communityContributors = data.contributors !== null ? data.contributors : communityContributors;
      checkMissionThreshold(getTotalProgress());
    })
    .catch(function() {
      // Worker unreachable — keep fallback values already displayed
    });
}

function postContribution(pct) {
  return fetch(STATS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contribution: pct })
  })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      communityProgress = data.communityProgress !== null ? data.communityProgress : communityProgress;
      communityContributors = data.contributors !== null ? data.contributors : communityContributors;
    })
    .catch(function() {
      // Worker unreachable — local state still updated
    });
}

// ─── Fight ───────────────────────────────────────────────────────────────────

var FIGHT_STATUS_URL = "/api/ngo-fight/status";
var FIGHT_SUBMIT_URL = "/api/ngo-fight/submit";
var fightSeasonEnd = null;

function formatFightEuro(n) {
  var rounded = Math.round(n);
  return "€" + rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function renderFight(season) {
  fightSeasonEnd = season.end;

  // Worker only tracks seasonId (an epoch timestamp, unique but not sequential) —
  // history.length + 1 gives the human-readable "Season N" display number.
  var seasonNum = (season.history || []).length + 1;
  ["fight-season-num", "fight-season-num-fr", "fight-season-num-kr", "fight-season-num-es"].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.textContent = seasonNum;
  });

  var companyPct = season.goalCompany > 0 ? Math.min((season.companyTotal / season.goalCompany) * 100, 100) : 0;
  var communityPct = season.goalCommunity > 0 ? Math.min((season.communityTotal / season.goalCommunity) * 100, 100) : 0;

  document.getElementById("fight-company-amount").textContent = formatFightEuro(season.companyTotal);
  document.getElementById("fight-company-goal").textContent = formatFightEuro(season.goalCompany);
  document.getElementById("fight-company-fill").style.width = companyPct + "%";
  document.getElementById("fight-company-contributors").textContent = season.companyContributors;

  document.getElementById("fight-community-amount").textContent = formatFightEuro(season.communityTotal);
  document.getElementById("fight-community-goal").textContent = formatFightEuro(season.goalCommunity);
  document.getElementById("fight-community-fill").style.width = communityPct + "%";
  document.getElementById("fight-community-contributors").textContent = season.communityContributors;

  document.getElementById("fight-company-card").classList.toggle("leading", season.companyTotal > season.communityTotal);
  document.getElementById("fight-community-card").classList.toggle("leading", season.communityTotal > season.companyTotal);

  renderFightHistory(season.history || []);
}

function renderFightHistory(history) {
  var el = document.getElementById("fight-history-list");
  if (!el) return;
  while (el.firstChild) el.removeChild(el.firstChild);

  // history entries come straight from workers/ngo-fight's closeSeasonEntry() — only
  // numbers and a fixed 3-value enum (winner), never user-submitted text (name/note/
  // siret aren't part of this shape) — but built via textContent/DOM methods anyway,
  // not innerHTML, since no HTML formatting is actually needed here.
  history.slice().reverse().forEach(function(h, i) {
    var winnerLabel = h.winner === "tie" ? "Égalité" : (h.winner === "company" ? "Entreprises" : "Communauté");
    var row = document.createElement("div");
    row.className = "fight-history-row";

    var seasonSpan = document.createElement("span");
    seasonSpan.textContent = "Saison " + (history.length - i);

    var resultSpan = document.createElement("span");
    resultSpan.textContent = winnerLabel + " — " + formatFightEuro(h.companyFinal) + " vs " + formatFightEuro(h.communityFinal);

    row.appendChild(seasonSpan);
    row.appendChild(resultSpan);
    el.appendChild(row);
  });
}

function updateFightCountdown() {
  var el = document.getElementById("fight-countdown");
  if (!el || !fightSeasonEnd) return;
  var diff = fightSeasonEnd - Date.now();
  if (diff <= 0) { el.textContent = "00j 00h 00m"; return; }
  var total = Math.floor(diff / 1000);
  var d = Math.floor(total / 86400);
  var h = Math.floor((total % 86400) / 3600);
  var m = Math.floor((total % 3600) / 60);
  el.textContent = d + "j " + (h < 10 ? "0" + h : h) + "h " + (m < 10 ? "0" + m : m) + "m";
}

function fetchFightStatus() {
  fetch(FIGHT_STATUS_URL)
    .then(function(r) { return r.json(); })
    .then(renderFight)
    .catch(function() { /* Worker unreachable — keep last-known rendered values */ });
}

function submitFightEntry(payload) {
  var msg = document.getElementById("fight-form-msg");
  return fetch(FIGHT_SUBMIT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })
    .then(function(r) { if (!r.ok) throw new Error("submit failed"); return r.json(); })
    .then(function() {
      if (msg) {
        msg.textContent = "Merci — votre contribution est en cours de vérification.";
        msg.className = "fight-form-msg visible";
      }
      document.getElementById("fight-form").reset();
    })
    .catch(function() {
      if (msg) {
        msg.textContent = "Erreur d'envoi — réessayez.";
        msg.className = "fight-form-msg visible error";
      }
    });
}

document.addEventListener("DOMContentLoaded", function() {
  fetchFightStatus();
  setInterval(updateFightCountdown, 60000);
  setInterval(fetchFightStatus, 120000); // picks up admin approvals / quiz extensions without a page reload

  var btnToggle = document.getElementById("btn-report-contribution");
  var form = document.getElementById("fight-form");
  if (btnToggle && form) {
    btnToggle.addEventListener("click", function() { form.classList.toggle("visible"); });
  }
  if (form) {
    form.addEventListener("submit", function(e) {
      e.preventDefault();
      var side = form.querySelector('input[name="side"]:checked');
      submitFightEntry({
        side: side ? side.value : "community",
        amount: parseFloat(document.getElementById("fight-amount").value),
        name: document.getElementById("fight-name").value,
        siret: document.getElementById("fight-siret").value,
        note: document.getElementById("fight-note").value
      });
    });
  }
});

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

  // Style options
  var opts = document.querySelectorAll(".quiz-option");
  opts.forEach(function(btn, i) {
    btn.disabled = true;
    if (i === correct) btn.classList.add("correct");
    else if (i === chosen && !isCorrect) btn.classList.add("wrong");
  });

  // Feedback
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

  // Show next button
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
  var pct = Math.round((score / total) * MAX_PER_SESSION * 10) / 10;

  addUserContribution(pct);
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

  postContribution(pct).then(function() {
    var newTotal = getTotalProgress();
    var contributionTexts = {
      en: "+" + pct.toFixed(1) + "% added to the community gauge → now at " + newTotal.toFixed(1) + "%",
      fr: "+" + pct.toFixed(1) + "% ajoutés à la jauge collective → maintenant à " + newTotal.toFixed(1) + "%",
      kr: "+" + pct.toFixed(1) + "% ajoute nan jwaj kominotè a → kounye a " + newTotal.toFixed(1) + "%",
      es: "+" + pct.toFixed(1) + "% añadidos al marcador colectivo → ahora en " + newTotal.toFixed(1) + "%"
    };
    document.getElementById("result-contribution").textContent = contributionTexts[lang] || contributionTexts.en;
    checkMissionThreshold(newTotal);
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

// Show local estimate immediately, then update with real Worker data
setTimeout(function() {
  checkMissionThreshold(getTotalProgress());
  fetchStats();
}, 400);

updateQuizButton();
