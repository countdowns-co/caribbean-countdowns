/* design-v29.js — caribbean.countdowns.co (page d'essai design v29)
 * Thème clair/nuit/auto, compte à rebours, statistiques, filtres. Aucun innerHTML, aucun style en ligne
 * (CSP : script-src 'self'; style-src 'self'). Syntaxe ES2020, comme le reste de public/scripts/. */
(function () {
  var root = document.documentElement;

  /* ---------- thème : auto (suit l'appareil) → clair → nuit ---------- */
  var THEMES = ["auto", "light", "night"];
  var ICONS = { auto: "◐", light: "☀", night: "☾" };
  var themeBtn = document.getElementById("themeBtn");
  var ti = 0;
  try {
    var saved = localStorage.getItem("cc-theme");
    if (THEMES.indexOf(saved) !== -1) ti = THEMES.indexOf(saved);
  } catch {
    /* stockage indisponible : on garde « auto » */
  }
  function applyTheme() {
    var t = THEMES[ti];
    root.setAttribute("data-theme", t);
    if (themeBtn) {
      themeBtn.textContent = ICONS[t];
      themeBtn.title = "Theme: " + t;
    }
    try {
      localStorage.setItem("cc-theme", t);
    } catch {
      /* ignoré */
    }
  }
  if (themeBtn) {
    themeBtn.addEventListener("click", function () {
      ti = (ti + 1) % THEMES.length;
      applyTheme();
    });
  }
  applyTheme();

  /* ---------- compte à rebours, état LIVE, statistiques ---------- */
  function pad(n) {
    return n < 10 ? "0" + n : String(n);
  }
  function fmt(ms) {
    if (ms <= 0) return "—";
    var s = Math.floor(ms / 1000);
    return Math.floor(s / 86400) + "d " + pad(Math.floor((s % 86400) / 3600)) + "h " + pad(Math.floor((s % 3600) / 60)) + "m " + pad(s % 60) + "s";
  }

  var cards = Array.prototype.slice.call(document.querySelectorAll(".dcard"));
  var rows = cards.map(function (card) {
    return {
      card: card,
      start: Number(card.getAttribute("data-start")),
      end: Number(card.getAttribute("data-end")),
      value: card.querySelector(".dcd-v"),
      liveFlag: card.querySelector(".dlive"),
      labelStart: card.querySelector(".lb-start"),
      labelEnd: card.querySelector(".lb-end"),
      state: "",
    };
  });
  var nextCd = document.getElementById("next-cd");
  var nextStart = nextCd ? Number(nextCd.getAttribute("data-start")) : 0;

  function setStats(now) {
    var all = 0;
    var seen = {};
    rows.forEach(function (r) {
      if (now > r.end) return;
      all += 1;
      seen[r.card.getAttribute("data-country")] = true;
    });
    var set = function (id, v) {
      var el = document.getElementById(id);
      if (el) el.textContent = String(v);
    };
    set("st-all", all);
    set("st-countries", Object.keys(seen).length);
  }

  function tick() {
    var now = Date.now();
    var changed = false;
    rows.forEach(function (r) {
      var state = now > r.end ? "ended" : now >= r.start ? "live" : "upcoming";
      if (state !== r.state) {
        r.state = state;
        changed = true;
        r.card.classList.toggle("islive", state === "live");
        if (r.liveFlag) r.liveFlag.classList.toggle("is-hidden", state !== "live");
        if (r.labelStart) r.labelStart.classList.toggle("is-hidden", state === "live");
        if (r.labelEnd) r.labelEnd.classList.toggle("is-hidden", state !== "live");
      }
      if (r.value) r.value.textContent = fmt((state === "upcoming" ? r.start : r.end) - now);
    });
    if (nextCd) nextCd.textContent = fmt(nextStart - now);
    if (changed) {
      setStats(now);
      applyFilters();
    }
  }

  /* ---------- filtres ---------- */
  var filters = { type: "", free: false, live: false, q: "", country: "" };
  var input = document.getElementById("q");
  var select = document.getElementById("country");
  var countEl = document.getElementById("count");
  var emptyEl = document.getElementById("empty");
  var sections = Array.prototype.slice.call(document.querySelectorAll(".msec"));

  function applyFilters() {
    var now = Date.now();
    var shown = 0;
    rows.forEach(function (r) {
      var c = r.card;
      var ok = now <= r.end;
      if (ok && filters.type && c.getAttribute("data-type") !== filters.type) ok = false;
      if (ok && filters.free && c.getAttribute("data-free") !== "1") ok = false;
      if (ok && filters.live && !(now >= r.start)) ok = false;
      if (ok && filters.country && c.getAttribute("data-country") !== filters.country) ok = false;
      if (ok && filters.q && (c.getAttribute("data-search") || "").indexOf(filters.q) === -1) ok = false;
      c.classList.toggle("is-hidden", !ok);
      if (ok) shown += 1;
    });
    sections.forEach(function (s) {
      s.classList.toggle("is-hidden", s.querySelectorAll(".dcard:not(.is-hidden)").length === 0);
    });
    if (countEl) countEl.textContent = String(shown);
    if (emptyEl) emptyEl.classList.toggle("is-hidden", shown !== 0);
  }

  document.querySelectorAll(".chip").forEach(function (chip) {
    chip.addEventListener("click", function () {
      var kind = chip.getAttribute("data-filter");
      if (kind === "type") {
        document.querySelectorAll('.chip[data-filter="type"]').forEach(function (c) {
          c.setAttribute("aria-pressed", String(c === chip));
        });
        filters.type = chip.getAttribute("data-value") || "";
      } else {
        var on = chip.getAttribute("aria-pressed") !== "true";
        chip.setAttribute("aria-pressed", String(on));
        filters[kind] = on;
      }
      applyFilters();
    });
  });
  if (input) {
    input.addEventListener("input", function () {
      filters.q = input.value.trim().toLowerCase();
      applyFilters();
    });
  }
  if (select) {
    select.addEventListener("change", function () {
      filters.country = select.value;
      applyFilters();
    });
  }

  /* libellé « tous les pays » dans la langue choisie (lang.js met à jour document.documentElement.lang) */
  function setAllLabel() {
    if (!select) return;
    var lang = document.documentElement.lang || "en";
    var label = select.getAttribute("data-all-" + lang) || select.getAttribute("data-all-en");
    if (select.options.length > 0 && label) select.options[0].textContent = label;
  }
  document.querySelectorAll(".lang-btn").forEach(function (btn) {
    btn.addEventListener("click", setAllLabel);
  });
  setAllLabel();

  /* images d'affiches : chargées 300 px avant d'entrer à l'écran (même marge que l'accueil actuel) ;
   * le chargement natif « lazy » anticipe bien plus loin et télécharge beaucoup plus d'images au premier affichage */
  var lazyImgs = Array.prototype.slice.call(document.querySelectorAll("img[data-src]"));
  function loadImg(img) {
    img.src = img.getAttribute("data-src");
    img.removeAttribute("data-src");
  }
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          loadImg(entry.target);
          io.unobserve(entry.target);
        });
      },
      { rootMargin: "300px" }
    );
    lazyImgs.forEach(function (img) {
      io.observe(img);
    });
  } else {
    lazyImgs.forEach(loadImg);
  }

  tick();
  setInterval(tick, 1000);
})();
