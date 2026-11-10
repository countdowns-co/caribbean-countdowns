/* index.js — caribbean.countdowns.co */
var LANGS = ["en", "fr", "kr", "es"];
var lang = localStorage.getItem("lang") || "en";

var searchPlaceholders = {
  en: "Search events...",
  fr: "Rechercher un évènement...",
  kr: "Chèché yon évènman...",
  es: "Buscar un evento..."
};

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
  var inp = document.getElementById("searchInput");
  if (inp) inp.placeholder = searchPlaceholders[lang] || searchPlaceholders.en;
}

window.setLang = function(l) {
  lang = l;
  localStorage.setItem("lang", lang);
  applyLang();
};

applyLang();

document.querySelectorAll(".lang-btn").forEach(function(btn) {
  btn.addEventListener("click", function() {
    window.setLang(btn.getAttribute("data-lang"));
  });
});

// External link toast
var toastTimer;
var toastMsgs = {
  en: "You are leaving Caribbean Countdowns",
  fr: "Vous quittez Caribbean Countdowns",
  kr: "Ou ka kité Caribbean Countdowns",
  es: "Estás saliendo de Caribbean Countdowns"
};

function showToast() {
  var toast = document.getElementById("extToast");
  if (!toast) return;
  toast.textContent = toastMsgs[lang] || toastMsgs.en;
  toast.style.display = "block";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function() { toast.style.display = "none"; }, 3000);
}

window.onclick = function(e) {
  var el = e.target;
  while (el && el !== document.body) {
    if (el.tagName === "A" && el.target === "_blank") {
      showToast();
      return;
    }
    el = el.parentElement;
  }
};

// Countdowns
function format(ms) {
  if (ms <= 0) return "—";
  var s = Math.floor(ms / 1000);
  var d = Math.floor(s / 86400);
  var h = Math.floor((s % 86400) / 3600);
  var m = Math.floor((s % 3600) / 60);
  var sec = s % 60;
  var unit = (lang === "fr" || lang === "kr") ? "j" : "d";
  return d + unit + " " + h + "h " + m + "m " + sec + "s";
}

function updateCountdowns() {
  document.querySelectorAll(".countdown[data-date]").forEach(function(el) {
    var target = Number(el.getAttribute("data-date"));
    if (!target) return;
    var diff = target - Date.now();
    el.textContent = format(diff);
  });
}

updateCountdowns();
setInterval(updateCountdowns, 1000);

// Filters
var searchQuery    = "";
var activeType     = "All"; // single select
var activeDetails  = [];    // multi-select (empty = all)
var activeCountries = [];   // multi-select (empty = all)
var activeEcoGrades = [];   // multi-select (empty = all)

function applyFilters() {
  var filtersActive = !!searchQuery || activeType !== "All" ||
    activeCountries.length > 0 || activeDetails.length > 0 || activeEcoGrades.length > 0;
  var pastEl = document.getElementById("past-events-section");
  var pastMatch = false;

  document.querySelectorAll(".festival-entry").forEach(function(row) {
    var rowName    = (row.getAttribute("data-name")   || "").toLowerCase();
    var rowType    = row.getAttribute("data-type")    || "";
    var rowDetails = (row.getAttribute("data-details") || "").split(",").filter(Boolean);
    var rowCountry = row.getAttribute("data-country") || "";
    var rowEco     = row.getAttribute("data-eco-grade") || "";
    var matchSearch  = !searchQuery || rowName.indexOf(searchQuery) !== -1;
    var matchType    = activeType === "All" || rowType === activeType;
    var matchCountry = activeCountries.length === 0 || activeCountries.indexOf(rowCountry) !== -1;
    var matchDetail  = activeDetails.length === 0 || activeDetails.some(function(v) { return rowDetails.indexOf(v) !== -1; });
    var matchEco     = activeEcoGrades.length === 0 || activeEcoGrades.indexOf(rowEco) !== -1;
    var show = matchSearch && matchType && matchCountry && matchDetail && matchEco;
    row.style.display = show ? "" : "none";
    var next = row.nextElementSibling;
    if (next && next.classList.contains("divider")) {
      next.style.display = show ? "" : "none";
    }
    if (show && pastEl && pastEl.contains(row)) pastMatch = true;
  });

  // Past events are collapsed by default. When a filter is active, reveal the
  // past section if it holds matches — otherwise an event whose only match is
  // past (e.g. a graded past edition) would silently vanish. With no filter,
  // restore the section to the user's toggle state.
  if (pastEl) {
    var showPast = filtersActive ? pastMatch : pastOpen;
    pastEl.classList.toggle("is-hidden", !showPast);
  }
}

function updateFilterBadge() {
  var count = (activeType !== "All" ? 1 : 0) + activeDetails.length + activeCountries.length + activeEcoGrades.length;
  var badge = document.getElementById("filterBadge");
  var toggle = document.getElementById("filterToggle");
  if (badge) { badge.textContent = count; badge.classList.toggle("is-hidden", count === 0); }
  if (toggle) toggle.classList.toggle("has-active", count > 0);
}

// Filter panel toggle
var filterToggle = document.getElementById("filterToggle");
var filterPanel  = document.getElementById("filterPanel");

if (filterToggle && filterPanel) {
  filterToggle.addEventListener("click", function(e) {
    e.stopPropagation();
    filterPanel.classList.toggle("open");
  });
}

document.addEventListener("click", function(e) {
  if (!filterPanel) return;
  var wrap = document.querySelector(".search-input-wrap");
  if (wrap && wrap.contains(e.target)) return;
  filterPanel.classList.remove("open");
});

// Filter chips
document.querySelectorAll(".filter-chip").forEach(function(btn) {
  btn.addEventListener("click", function() {
    var type  = btn.getAttribute("data-filter-type");
    var value = btn.getAttribute("data-value");

    if (type === "type") {
      // Single select
      document.querySelectorAll(".filter-chip[data-filter-type='type']").forEach(function(b) { b.classList.remove("active"); });
      btn.classList.add("active");
      activeType = value;

    } else if (type === "country") {
      if (value === "All") {
        activeCountries = [];
        document.querySelectorAll(".filter-chip[data-filter-type='country']").forEach(function(b) { b.classList.remove("active"); });
        btn.classList.add("active");
      } else {
        var idx = activeCountries.indexOf(value);
        if (idx === -1) { activeCountries.push(value); btn.classList.add("active"); }
        else            { activeCountries.splice(idx, 1); btn.classList.remove("active"); }
        var allBtn = document.querySelector(".filter-chip[data-filter-type='country'][data-value='All']");
        if (allBtn) allBtn.classList.toggle("active", activeCountries.length === 0);
      }

    } else if (type === "detail") {
      if (value === "All") {
        activeDetails = [];
        document.querySelectorAll(".filter-chip[data-filter-type='detail']").forEach(function(b) { b.classList.remove("active"); });
        btn.classList.add("active");
      } else {
        var idx = activeDetails.indexOf(value);
        if (idx === -1) { activeDetails.push(value); btn.classList.add("active"); }
        else            { activeDetails.splice(idx, 1); btn.classList.remove("active"); }
        var allBtn = document.querySelector(".filter-chip[data-filter-type='detail'][data-value='All']");
        if (allBtn) allBtn.classList.toggle("active", activeDetails.length === 0);
      }

    } else if (type === "eco") {
      if (value === "All") {
        activeEcoGrades = [];
        document.querySelectorAll(".filter-chip[data-filter-type='eco']").forEach(function(b) { b.classList.remove("active"); });
        btn.classList.add("active");
      } else {
        var idx = activeEcoGrades.indexOf(value);
        if (idx === -1) { activeEcoGrades.push(value); btn.classList.add("active"); }
        else            { activeEcoGrades.splice(idx, 1); btn.classList.remove("active"); }
        var allBtn = document.querySelector(".filter-chip[data-filter-type='eco'][data-value='All']");
        if (allBtn) allBtn.classList.toggle("active", activeEcoGrades.length === 0);
      }
    }

    updateFilterBadge();
    applyFilters();
  });
});

// Search input
var searchInput = document.getElementById("searchInput");
if (searchInput) {
  searchInput.addEventListener("focus", function() {
    if (filterPanel) filterPanel.classList.add("open");
  });
  searchInput.addEventListener("input", function() {
    searchQuery = this.value.trim().toLowerCase();
    applyFilters();
  });
}

// Past events toggle
var pastCard    = document.getElementById("past-toggle-card");
var pastSection = document.getElementById("past-events-section");
var pastOpen    = false;

if (pastCard && pastSection) {
  function togglePast() {
    pastOpen = !pastOpen;
    pastCard.classList.toggle("open", pastOpen);
    pastCard.setAttribute("aria-expanded", String(pastOpen));
    var l = pastCard.querySelector(".past-chevron-l");
    var r = pastCard.querySelector(".past-chevron-r");
    if (l) l.textContent = pastOpen ? "▼" : "▶";
    if (r) r.textContent = pastOpen ? "▼" : "◀";
    applyFilters();
  }
  pastCard.addEventListener("click", togglePast);
  pastCard.addEventListener("keydown", function(e) {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); togglePast(); }
  });
}

// Lazy-load below-the-fold card backgrounds. The first 3 active cards stay eager
// (LCP), so they are not in [data-bg]. .has-image already reserves the 180px box,
// so setting the image on scroll causes no layout shift. Hidden past-event cards
// are observed too and load when the section is revealed and scrolled into view.
(function () {
  // Eager (LCP) card backgrounds: the URL used to be an inline style attribute,
  // but CSP style-src 'self' (Observatory A+) forbids that. The preload <link>
  // still fetches the bytes early; we apply the background via CSSOM (not gated
  // by CSP) as the very first thing the deferred script does, so paint is prompt.
  document.querySelectorAll("[data-bg-eager]").forEach(function (el) {
    var url = el.getAttribute("data-bg-eager");
    if (url) { el.style.backgroundImage = "url('" + url + "')"; el.removeAttribute("data-bg-eager"); }
  });

  var lazyBgEls = document.querySelectorAll("[data-bg]");
  if (!lazyBgEls.length) return;
  function loadBg(el) {
    var url = el.getAttribute("data-bg");
    if (url) { el.style.backgroundImage = "url('" + url + "')"; el.removeAttribute("data-bg"); }
  }
  if (!("IntersectionObserver" in window)) {
    lazyBgEls.forEach(loadBg);
    return;
  }
  var bgObserver = new IntersectionObserver(function (entries, obs) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { loadBg(e.target); obs.unobserve(e.target); }
    });
  }, { rootMargin: "300px" });
  lazyBgEls.forEach(function (el) { bgObserver.observe(el); });
})();

