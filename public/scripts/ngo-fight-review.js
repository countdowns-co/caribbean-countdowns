/* ngo-fight-review.js — caribbean.countdowns.co/ngo-fight-review
 * Internal moderation page for the NGO Fight (workers/ngo-fight). Page itself sits
 * behind Cloudflare Access — see specs/2026-09-19-ngo-fight-design.md §3.1 — this
 * script has no auth logic of its own.
 */

function fetchPending() {
  fetch("/api/ngo-fight/pending")
    .then(function(r) { return r.json(); })
    .then(renderList)
    .catch(function() {
      var list = document.getElementById("list");
      if (list) list.textContent = "Erreur de chargement — vérifiez l'accès Cloudflare Access.";
    });
}

// Built via createElement/textContent throughout, never innerHTML — entry.name and
// entry.note are free text submitted by any anonymous visitor via POST /submit (the
// Worker validates side as an enum and siret as a 14-digit regex, but never sanitizes
// name/note). Interpolating those into innerHTML would be a stored XSS against
// whoever's reviewing this page.
function renderList(entries) {
  var list = document.getElementById("list");
  var empty = document.getElementById("empty");
  if (!list || !empty) return;
  while (list.firstChild) list.removeChild(list.firstChild);

  if (entries.length === 0) { empty.style.display = "block"; return; }
  empty.style.display = "none";

  entries.forEach(function(e) {
    var div = document.createElement("div");
    div.className = "entry";

    var top = document.createElement("div");
    top.className = "entry-top";

    var sideSpan = document.createElement("span");
    sideSpan.className = "side " + (e.side === "company" ? "company" : "community");
    sideSpan.textContent = e.side === "company" ? "Entreprise" : "Communauté";

    var amountSpan = document.createElement("span");
    amountSpan.className = "amount";
    amountSpan.textContent = "€" + e.amount;

    top.appendChild(sideSpan);
    top.appendChild(amountSpan);

    var meta = document.createElement("div");
    meta.className = "meta";
    if (e.name) {
      var nameStrong = document.createElement("strong");
      nameStrong.textContent = e.name;
      meta.appendChild(nameStrong);
    } else {
      meta.appendChild(document.createTextNode("Anonyme"));
    }
    if (e.siret) {
      meta.appendChild(document.createTextNode(" · SIRET " + e.siret));
    }

    div.appendChild(top);
    div.appendChild(meta);

    if (e.note) {
      var note = document.createElement("div");
      note.className = "note";
      note.textContent = "Note : « " + e.note + " »";
      div.appendChild(note);
    }

    var approveBtn = document.createElement("button");
    approveBtn.className = "approve";
    approveBtn.textContent = "✓ Approuver";
    approveBtn.addEventListener("click", function() { decide(e.entryId, "approve"); });

    var rejectBtn = document.createElement("button");
    rejectBtn.className = "reject";
    rejectBtn.textContent = "✕ Rejeter";
    rejectBtn.addEventListener("click", function() { decide(e.entryId, "reject"); });

    div.appendChild(approveBtn);
    div.appendChild(rejectBtn);
    list.appendChild(div);
  });
}

function decide(entryId, decision) {
  fetch("/api/ngo-fight/approve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entryId: entryId, decision: decision })
  }).then(fetchPending);
}

fetchPending();
