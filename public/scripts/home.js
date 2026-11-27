/* home.js — caribbean.countdowns.co (accueil, nouveau design)
 * Thème clair/nuit/auto, compte à rebours, filtres (types, gratuit, en cours, terminés, pays, note écologique, recherche),
 * carte (bulle, clic = filtre par pays), chargement des affiches 300 px avant l'écran.
 * Aucun innerHTML, aucun style en ligne (CSP : script-src 'self'; style-src 'self'). Syntaxe ES2020, comme le reste de public/scripts/. */
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

  /* ---------- langue (lang.js met à jour document.documentElement.lang) ---------- */
  var WORDS = {
    en: { one: "event", many: "events", none: "no upcoming event", live: "live now" },
    fr: { one: "événement", many: "événements", none: "aucun événement à venir", live: "en cours" },
    kr: { one: "evènman", many: "evènman", none: "pa gen evènman k ap vini", live: "an kou" },
    es: { one: "evento", many: "eventos", none: "ningún evento próximo", live: "en vivo" },
  };
  function words() {
    return WORDS[document.documentElement.lang] || WORDS.en;
  }

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
      labelDone: card.querySelector(".lb-done"),
      state: "",
    };
  });
  var tiles = Array.prototype.slice.call(document.querySelectorAll(".tmini[data-start]"));
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
        r.card.classList.toggle("ended", state === "ended");
        if (r.liveFlag) r.liveFlag.classList.toggle("is-hidden", state !== "live");
        if (r.labelStart) r.labelStart.classList.toggle("is-hidden", state !== "upcoming");
        if (r.labelEnd) r.labelEnd.classList.toggle("is-hidden", state !== "live");
        if (r.labelDone) r.labelDone.classList.toggle("is-hidden", state !== "ended");
      }
      if (r.value) r.value.textContent = state === "ended" ? "—" : fmt((state === "upcoming" ? r.start : r.end) - now);
    });
    tiles.forEach(function (t) {
      t.textContent = fmt(Number(t.getAttribute("data-start")) - now);
    });
    if (nextCd) nextCd.textContent = fmt(nextStart - now);
    if (changed) {
      setStats(now);
      applyFilters();
    }
  }

  /* ---------- filtres ---------- */
  var filters = { type: "", free: false, live: false, ended: false, q: "", country: "", eco: "" };
  var autoEnded = false;
  var input = document.getElementById("q");
  var selCountry = document.getElementById("country");
  var selEco = document.getElementById("eco");
  var countEl = document.getElementById("count");
  var emptyEl = document.getElementById("empty");
  var sections = Array.prototype.slice.call(document.querySelectorAll(".msec"));
  var dots = Array.prototype.slice.call(document.querySelectorAll("#mapsvg .dot"));

  function applyFilters() {
    var shown = 0;
    rows.forEach(function (r) {
      var c = r.card;
      var ok = filters.ended ? r.state === "ended" : r.state !== "ended";   // « Terminés » = seulement les terminés ; sinon jamais de terminés
      if (ok && filters.type && c.getAttribute("data-type") !== filters.type) ok = false;
      if (ok && filters.free && c.getAttribute("data-free") !== "1") ok = false;
      if (ok && filters.live && r.state !== "live") ok = false;
      if (ok && filters.country && c.getAttribute("data-country") !== filters.country) ok = false;
      if (ok && filters.eco && c.getAttribute("data-eco") !== filters.eco) ok = false;
      if (ok && filters.q && (c.getAttribute("data-search") || "").indexOf(filters.q) === -1) ok = false;
      c.classList.toggle("is-hidden", !ok);
      if (ok) shown += 1;
    });
    sections.forEach(function (s) {
      s.classList.toggle("is-hidden", s.querySelectorAll(".dcard:not(.is-hidden)").length === 0);
    });
    dots.forEach(function (d) {
      var on = filters.country !== "" && d.getAttribute("data-k") === filters.country;
      d.classList.toggle("sel", on);
      d.setAttribute("aria-pressed", String(on));
    });
    if (countEl) countEl.textContent = String(shown);
    if (emptyEl) emptyEl.classList.toggle("is-hidden", shown !== 0);
  }

  function syncChip(name, on) {
    var chip = document.querySelector('.chip[data-filter="' + name + '"]');
    if (chip) chip.setAttribute("aria-pressed", String(on));
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
        /* « En cours » et « Terminés » s'excluent : activer l'un désactive l'autre */
        if (on && kind === "live") {
          filters.ended = false;
          autoEnded = false;
          syncChip("ended", false);
        }
        if (on && kind === "ended") {
          filters.live = false;
          syncChip("live", false);
        }
        if (kind === "ended") autoEnded = false;
      }
      applyFilters();
      if (kind === "ended" && filters.ended) {
        var ended = document.getElementById("ended");
        if (ended) ended.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });
  if (input) {
    input.addEventListener("input", function () {
      filters.q = input.value.trim().toLowerCase();
      applyFilters();
    });
  }
  if (selCountry) {
    selCountry.addEventListener("change", function () {
      filters.country = selCountry.value;
      applyFilters();
    });
  }
  if (selEco) {
    selEco.addEventListener("change", function () {
      filters.eco = selEco.value;
      applyFilters();
    });
  }

  /* ---------- carte : bulle d'information, clic = filtre par pays ---------- */
  var svg = document.getElementById("mapsvg");
  var tip = document.getElementById("cmap-tip");
  var tipRect = tip ? tip.querySelector("rect") : null;
  var tipText = tip ? tip.querySelector("text") : null;
  var viewW = svg ? Number(svg.getAttribute("viewBox").split(" ")[2]) : 0;

  function dotLabel(d) {
    var w = words();
    var n = Number(d.getAttribute("data-n"));
    var l = Number(d.getAttribute("data-l"));
    var name = d.getAttribute("data-short") || d.getAttribute("data-k");
    return name + " · " + (n ? n + " " + (n === 1 ? w.one : w.many) : w.none) + (l ? " · " + l + " " + w.live : "");
  }
  function refreshLabels() {
    dots.forEach(function (d) {
      d.setAttribute("aria-label", dotLabel(d));
    });
    [selCountry, selEco].forEach(function (sel) {
      if (!sel || sel.options.length === 0) return;
      var lang = document.documentElement.lang || "en";
      var label = sel.getAttribute("data-all-" + lang) || sel.getAttribute("data-all-en");
      if (label) sel.options[0].textContent = label;
    });
  }
  function showTip(d) {
    if (!tip || !tipRect || !tipText) return;
    var cx = Number(d.getAttribute("cx"));
    var cy = Number(d.getAttribute("cy"));
    var r = Number(d.getAttribute("r"));
    tipText.textContent = dotLabel(d);
    tip.setAttribute("visibility", "visible");
    var b = tipText.getBBox();
    var pw = b.width + 16;
    var ph = b.height + 10;
    var x = cx - pw / 2;
    var y = cy - r - 8 - ph;
    if (y < 4) y = cy + r + 8;
    x = Math.max(4, Math.min(viewW - pw - 4, x));
    tipRect.setAttribute("x", x);
    tipRect.setAttribute("y", y);
    tipRect.setAttribute("width", pw);
    tipRect.setAttribute("height", ph);
    tipText.setAttribute("x", x + 8);
    tipText.setAttribute("y", y + ph - 6);
  }
  function hideTip() {
    var selected = svg ? svg.querySelector(".dot.sel") : null;
    if (selected) showTip(selected);
    else if (tip) tip.setAttribute("visibility", "hidden");
  }
  function pickCountry(d) {
    var k = d.getAttribute("data-k");
    filters.country = filters.country === k ? "" : k;
    if (filters.country && Number(d.getAttribute("data-n")) === 0) {
      filters.ended = true;
      filters.live = false;
      syncChip("live", false);
      autoEnded = true;
    } else if (!filters.country && autoEnded) {
      filters.ended = false;
      autoEnded = false;
    }
    syncChip("ended", filters.ended);
    if (selCountry) selCountry.value = filters.country;
    applyFilters();
    hideTip();
    var controls = document.getElementById("controls");
    if (controls) controls.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  if (svg) {
    svg.addEventListener("mouseover", function (e) {
      var d = e.target.closest(".dot");
      if (d) showTip(d);
    });
    svg.addEventListener("mouseout", function (e) {
      if (e.target.closest(".dot")) hideTip();
    });
    svg.addEventListener("focusin", function (e) {
      var d = e.target.closest(".dot");
      if (d) showTip(d);
    });
    svg.addEventListener("focusout", hideTip);
    svg.addEventListener("click", function (e) {
      var d = e.target.closest(".dot");
      if (d) pickCountry(d);
    });
    svg.addEventListener("keydown", function (e) {
      var d = e.target.closest(".dot");
      if (d && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        pickCountry(d);
      }
    });
  }
  document.querySelectorAll(".lang-btn").forEach(function (btn) {
    btn.addEventListener("click", refreshLabels);
  });
  refreshLabels();

  /* ---------- images d'affiches : chargées 300 px avant d'entrer à l'écran (même marge que l'ancien accueil) ---------- */
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
