/* sponsor-simulator.js — caribbean.countdowns.co/sponsor
 * French mécénat d'entreprise: 60% tax reduction, capped at €20,000/year
 * or 0.5% of revenue if higher (not modeled here — see disclaimer).
 * Source: economie.gouv.fr (see page disclaimer for the link). */
var RATE = 0.6;

function formatEuro(n) {
  var rounded = Math.round(n);
  return "€" + rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function tierForAmount(amount) {
  if (amount < 5000) return "friend";
  if (amount < 50000) return "supporter";
  return "partner";
}

function updateSimulator() {
  var input = document.getElementById("donationAmount");
  if (!input) return;

  var amount = parseFloat(input.value);
  if (!isFinite(amount) || amount < 0) amount = 0;

  var reduction = amount * RATE;
  var netCost = amount - reduction;

  var elReduction = document.getElementById("resultReduction");
  var elNetCost = document.getElementById("resultNetCost");
  var elNgoReceives = document.getElementById("resultNgoReceives");
  if (elReduction) elReduction.textContent = formatEuro(reduction);
  if (elNetCost) elNetCost.textContent = formatEuro(netCost);
  if (elNgoReceives) elNgoReceives.textContent = formatEuro(amount);

  var tier = tierForAmount(amount);
  document.querySelectorAll(".simulator-tier-panel").forEach(function (panel) {
    panel.classList.toggle("active", panel.getAttribute("data-tier") === tier);
  });
}

document.addEventListener("DOMContentLoaded", function () {
  var input = document.getElementById("donationAmount");
  if (input) input.addEventListener("input", updateSimulator);
  updateSimulator();
});
