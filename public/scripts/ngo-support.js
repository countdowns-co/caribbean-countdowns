/* ngo-support.js — caribbean.countdowns.co/ngo-support/ */

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

// No renderQuizQuestion() call here (unlike ngo-quiz.js's setLang) — this page has no
// quiz, that function doesn't exist on it.
window.setLang = function(l) {
  lang = l;
  localStorage.setItem("lang", lang);
  applyLang();
};

document.querySelectorAll(".lang-btn").forEach(function(btn) {
  btn.addEventListener("click", function() {
    window.setLang(btn.getAttribute("data-lang"));
  });
});

applyLang();

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

  history.slice().reverse().forEach(function(h, i) {
    var winnerLabel = h.winner === "tie" ? "Égalité" : (h.winner === "company" ? "Entreprises" : "Communauté");
    var row = document.createElement("div");
    row.className = "fight-history-row";

    var seasonSpan = document.createElement("span");
    seasonSpan.textContent = "Projet " + (history.length - i);

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

// ─── Pre-select side from ?side= query param ──────────────────────────────
// /ngo/'s "As an engaged citizen" button links here with ?side=community. The
// form's "community" radio is already checked by default in the markup, so this
// is a no-op for that specific link today — it exists so the link is explicit
// and a future ?side=company deep link works with no further code change.

function preselectSideFromQuery() {
  var params = new URLSearchParams(window.location.search);
  var side = params.get("side");
  if (side !== "community" && side !== "company") return;
  var radio = document.querySelector('#fight-form input[name="side"][value="' + side + '"]');
  if (radio) radio.checked = true;
}

document.addEventListener("DOMContentLoaded", function() {
  preselectSideFromQuery();
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
