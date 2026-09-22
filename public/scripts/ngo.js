/* ngo.js — caribbean.countdowns.co/ngo/ */

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
};

document.querySelectorAll(".lang-btn").forEach(function(btn) {
  btn.addEventListener("click", function() {
    window.setLang(btn.getAttribute("data-lang"));
  });
});

applyLang();
