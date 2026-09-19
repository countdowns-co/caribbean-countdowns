/* sponsor-simulator.js — caribbean.countdowns.co/sponsor
 * Rate is adjustable (defaults to 60%, French mécénat d'entreprise).
 * Reduction cap (€20,000/year or 0.5% of revenue) not modeled here —
 * see page disclaimer. Source: economie.gouv.fr (see disclaimer for link). */
var DEFAULT_RATE = 60;

function formatEuro(n) {
  var rounded = Math.round(n);
  return "€" + rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function formatRate(r) {
  return (Math.round(r * 10) / 10).toString();
}

function tierForAmount(amount) {
  if (amount < 5000) return "friend";
  if (amount < 50000) return "supporter";
  return "partner";
}

function updateSimulator() {
  var amountInput = document.getElementById("donationAmount");
  var rateInput = document.getElementById("reductionRate");
  if (!amountInput || !rateInput) return;

  var amount = parseFloat(amountInput.value);
  if (!isFinite(amount) || amount < 0) amount = 0;

  var rate = parseFloat(rateInput.value);
  if (!isFinite(rate) || rate < 0) rate = DEFAULT_RATE;
  if (rate > 100) rate = 100;

  var reduction = amount * (rate / 100);
  var netCost = amount - reduction;

  var elReduction = document.getElementById("resultReduction");
  var elNetCost = document.getElementById("resultNetCost");
  var elNgoReceives = document.getElementById("resultNgoReceives");
  if (elReduction) elReduction.textContent = formatEuro(reduction);
  if (elNetCost) elNetCost.textContent = formatEuro(netCost);
  if (elNgoReceives) elNgoReceives.textContent = formatEuro(amount);

  document.querySelectorAll(".rate-display").forEach(function (el) {
    el.textContent = formatRate(rate);
  });

  var tier = tierForAmount(amount);
  document.querySelectorAll(".simulator-tier-panel").forEach(function (panel) {
    panel.classList.toggle("active", panel.getAttribute("data-tier") === tier);
  });
}

document.addEventListener("DOMContentLoaded", function () {
  var amountInput = document.getElementById("donationAmount");
  var rateInput = document.getElementById("reductionRate");
  if (amountInput) amountInput.addEventListener("input", updateSimulator);
  if (rateInput) rateInput.addEventListener("input", updateSimulator);
  updateSimulator();
});
