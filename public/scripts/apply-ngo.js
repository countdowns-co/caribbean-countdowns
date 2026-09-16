/* apply-ngo.js — caribbean.countdowns.co/apply-ngo
 * NGO-only application wizard. Companies never use this — they deal
 * directly with the featured NGO for sponsorship. */
var LANGS = ["en", "fr", "kr", "es"];
var lang  = localStorage.getItem("lang") || "en";

var COUNTRIES = [
  "Antigua and Barbuda", "Anguilla", "Aruba", "Barbados", "Bonaire",
  "British Virgin Islands", "Cayman Islands", "Curaçao", "Dominica", "Grenada",
  "Guadeloupe", "La Désirade", "Les Saintes", "Marie-Galante", "Martinique",
  "Montserrat", "Saba", "Saint Barthélemy", "Saint Kitts and Nevis", "Saint Lucia",
  "Saint Martin", "Saint Vincent and the Grenadines", "Sint Maarten", "Sint Eustatius",
  "Trinidad and Tobago", "Turks and Caicos Islands", "U.S. Virgin Islands",
  "Bahamas", "Bermuda", "Cuba", "Dominican Republic", "Haiti", "Jamaica",
  "Puerto Rico", "French Guiana", "Suriname",
];

var LABELS = {
  back:        { en: "← Back",            fr: "← Retour",                    kr: "← Retounen",       es: "← Volver" },
  next:        { en: "Next →",            fr: "Suivant →",                    kr: "Swivan →",          es: "Siguiente →" },
  skip:        { en: "Skip →",            fr: "Passer →",                     kr: "Pase →",            es: "Omitir →" },
  done:        { en: "✓ All done!",       fr: "✓ C'est fait !",               kr: "✓ Fini !",          es: "✓ ¡Listo!" },
  doneHint:    { en: "Click below to submit your application — nothing else is sent.",
                 fr: "Cliquez ci-dessous pour envoyer votre candidature — rien d'autre n'est transmis.",
                 kr: "Klike anba a pou voye kandidati ou — nou pa voye anyen ankò.",
                 es: "Haz clic abajo para enviar tu solicitud — no se transmite nada más." },
  submit:      { en: "Submit application", fr: "Envoyer la candidature",       kr: "Voye kandidati a",  es: "Enviar la solicitud" },
  sending:     { en: "Sending…",          fr: "Envoi…",                       kr: "Voye…",             es: "Enviando…" },
  sentTitle:   { en: "✓ Application sent!", fr: "✓ Candidature envoyée !",    kr: "✓ Kandidati voye !", es: "✓ ¡Solicitud enviada!" },
  sentHint:    { en: "We review applications within a few days — book a call above if you haven't already. Thanks!",
                 fr: "Nous examinons les candidatures sous quelques jours — réservez un appel ci-dessus si ce n'est pas déjà fait. Merci !",
                 kr: "Nou egzamine kandidati yo nan kèk jou — rezève yon apèl anwo a si ou poko fè sa. Mèsi !",
                 es: "Revisamos las solicitudes en unos días — reserva una llamada arriba si aún no lo has hecho. ¡Gracias!" },
  errorHint:   { en: "Something went wrong — please try again.",
                 fr: "Une erreur s'est produite — veuillez réessayer.",
                 kr: "Gen yon erè — tanpri eseye ankò.",
                 es: "Algo salió mal — inténtalo de nuevo." },
  rateLimited: { en: "Too many submissions — try again in a minute.",
                 fr: "Trop de soumissions — réessayez dans une minute.",
                 kr: "Twòp soumisyon — eseye ankò nan yon minit.",
                 es: "Demasiados envíos — inténtalo en un minuto." },
  retry:       { en: "Retry",             fr: "Réessayer",                    kr: "Eseye ankò",        es: "Reintentar" },
  addAction:   { en: "+ Add another",     fr: "+ Ajouter",                    kr: "+ Ajoute",          es: "+ Añadir" },
  removeAction:{ en: "Remove",            fr: "Retirer",                      kr: "Retire",            es: "Quitar" },
  chooseFile:  { en: "Choose image",      fr: "Choisir une image",            kr: "Chwazi yon imaj",   es: "Elegir imagen" },
  removeFile:  { en: "Remove",            fr: "Retirer",                      kr: "Retire",            es: "Quitar" },
  fileTooBig:  { en: "Image too large — 4 MB max.", fr: "Image trop volumineuse — 4 Mo max.", kr: "Imaj twò gwo — 4 Mo maksimòm.", es: "Imagen demasiado grande — 4 MB máx." },
  fileBadType: { en: "Only PNG or JPG images are accepted.", fr: "Seules les images PNG ou JPG sont acceptées.", kr: "Sèlman imaj PNG oswa JPG aksepte.", es: "Solo se aceptan imágenes PNG o JPG." },
};

var MAX_RECEIPT_BYTES = 4 * 1024 * 1024;

var STEPS = [
  { id:"name",        required:true,  type:"text",
    question:{ en:"What's the name of your NGO?",         fr:"Quel est le nom de votre ONG ?",          kr:"Ki jan yo rele ONG ou a ?",            es:"¿Cuál es el nombre de tu ONG?" },
    hint:    { en:"e.g. L'Asso-Mer",                       fr:"ex. L'Asso-Mer",                          kr:"egz. L'Asso-Mer",                      es:"ej. L'Asso-Mer" } },
  { id:"website",     required:true,  type:"url",
    question:{ en:"What's your website?",                 fr:"Quel est votre site web ?",               kr:"Ki sit web ou a ?",                    es:"¿Cuál es tu sitio web?" },
    hint:    { en:"This is how we verify and reach you — we don't collect email or phone here.", fr:"C'est ce qui nous sert à vous vérifier et vous contacter — nous ne collectons ni email ni téléphone ici.", kr:"Se konsa nou verifye epi kontakte ou — nou pa kolekte email oswa telefòn isit la.", es:"Así te verificamos y contactamos — no recogemos email ni teléfono aquí." } },
  { id:"location",    required:true,  type:"select",      options:COUNTRIES,
    question:{ en:"Where is your NGO based?",             fr:"Où votre ONG est-elle basée ?",           kr:"Kote ONG ou a baze ?",                 es:"¿Dónde tiene sede tu ONG?" },
    hint:    { en:"",                                     fr:"",                                        kr:"",                                    es:"" } },
  { id:"foundedYear", required:true,  type:"number",
    question:{ en:"What year was it founded?",            fr:"En quelle année a-t-elle été fondée ?",   kr:"Ki ane li te fonde ?",                 es:"¿En qué año fue fundada?" },
    hint:    { en:"e.g. 2016",                             fr:"ex. 2016",                                kr:"egz. 2016",                            es:"ej. 2016" } },
  { id:"volunteers",  required:false, type:"number",
    question:{ en:"How many volunteers do you have?",     fr:"Combien de bénévoles avez-vous ?",        kr:"Konbyen benevol ou genyen ?",          es:"¿Cuántos voluntarios tienes?" },
    hint:    { en:"Leave blank if unsure",                fr:"Laissez vide si incertain",               kr:"Kite vid si ou pa sèten",              es:"Deja en blanco si no estás seguro" } },
  { id:"actions",     required:true,  type:"list",        maxItems:5,
    question:{ en:"List up to 5 of your key actions",     fr:"Listez jusqu'à 5 de vos actions clés",    kr:"Lis jiska 5 nan aksyon kle ou yo",     es:"Enumera hasta 5 de tus acciones clave" },
    hint:    { en:"e.g. Sea turtle nesting surveys",      fr:"ex. Suivis des nids de tortues marines",  kr:"egz. Sondaj nich tòti maren",          es:"ej. Seguimiento de nidos de tortugas" } },
  { id:"donationStatus", required:true, type:"select",
    options:["yes","no"],
    optionLabels:{
      "yes": { en:"Yes, a company has already donated", fr:"Oui, une entreprise a déjà fait un don", kr:"Wi, yon konpayi deja fè yon don", es:"Sí, una empresa ya ha donado" },
      "no":  { en:"Not yet",                             fr:"Pas encore",                              kr:"Poko",                             es:"Todavía no" },
    },
    question:{ en:"Has a company already made a donation to support your listing?", fr:"Une entreprise a-t-elle déjà fait un don pour soutenir votre référencement ?", kr:"Èske yon konpayi deja fè yon don pou sipòte enskripsyon ou an ?", es:"¿Ya ha hecho una empresa una donación para apoyar tu listado?" },
    hint:    { en:"",                                     fr:"",                                        kr:"",                                    es:"" } },
  { id:"receipt",     required:false, type:"file",
    skipIf:  function(s) { return s.donationStatus !== "yes"; },
    question:{ en:"Upload the donation receipt (optional)", fr:"Téléversez le reçu de don (optionnel)",  kr:"Telechaje resi don an (opsyonèl)",     es:"Sube el comprobante de donación (opcional)" },
    hint:    { en:"PNG or JPG, 4 MB max. Helps us verify faster — not required to submit.", fr:"PNG ou JPG, 4 Mo max. Accélère la vérification — non obligatoire pour soumettre.", kr:"PNG oswa JPG, 4 Mo maksimòm. Ede nou verifye pi vit — pa obligatwa pou soumèt.", es:"PNG o JPG, 4 MB máx. Ayuda a verificar más rápido — no es obligatorio para enviar." } },
  { id:"notes",       required:false, type:"textarea",
    question:{ en:"Anything else to tell us?",            fr:"Autre chose à nous dire ?",               kr:"Eske gen lòt bagay ou vle di nou ?",   es:"¿Algo más que quieras decirnos?" },
    hint:    { en:"Social media links, press coverage, partner organizations...", fr:"Réseaux sociaux, presse, organisations partenaires...", kr:"Rezo sosyal, laprès, òganizasyon patnè...", es:"Redes sociales, prensa, organizaciones asociadas..." } },
];

var currentStep = 0;
var state = { actions: [""] };

function applyLang() {
  LANGS.forEach(function(l) {
    document.querySelectorAll(".t-" + l).forEach(function(el) {
      el.style.display = l === lang ? "" : "none";
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
  if (currentStep < STEPS.length) { renderStep(currentStep); } else { renderFinal(); }
};

function escHtml(s) {
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function updateProgress() {
  var bar = document.getElementById("wizardProgress");
  if (!bar) return;
  bar.textContent = "";
  var total = STEPS.length + 1;
  for (var i = 0; i < total; i++) {
    var seg = document.createElement("div");
    seg.className = "progress-seg" + (i <= currentStep ? " filled" : "");
    bar.appendChild(seg);
  }
}

function nonEmptyActions() {
  return state.actions.filter(function(a) { return a && a.trim(); });
}

function isStepValid(n) {
  var step = STEPS[n];
  if (!step.required) return true;
  if (step.type === "select") return !!(state[step.id]);
  if (step.type === "list")   return nonEmptyActions().length > 0;
  var input = document.getElementById("stepInput");
  return !!(input && input.value.trim());
}

function hasValue(n) {
  var step = STEPS[n];
  if (step.type === "list") return nonEmptyActions().length > 0;
  if (step.type === "file") return !!state.receiptImage;
  return !!(state[step.id]);
}

function nextVisibleStep(n) {
  var i = n;
  while (i < STEPS.length && STEPS[i].skipIf && STEPS[i].skipIf(state)) i++;
  return i;
}

function prevVisibleStep(n) {
  var i = n;
  while (i > 0 && STEPS[i] && STEPS[i].skipIf && STEPS[i].skipIf(state)) i--;
  return i;
}

function updateNav(n) {
  var btnNext = document.getElementById("btnNext");
  var btnBack = document.getElementById("btnBack");
  if (!btnNext) return;
  var step = STEPS[n];
  btnNext.disabled = step.required && !isStepValid(n);
  btnNext.textContent = (!step.required && !hasValue(n))
    ? (LABELS.skip[lang] || LABELS.skip.en)
    : (LABELS.next[lang] || LABELS.next.en);
  if (btnBack) {
    btnBack.classList.toggle("is-hidden", n === 0);
    btnBack.textContent = LABELS.back[lang] || LABELS.back.en;
  }
}

function renderActionsList(container, n) {
  var wrap = document.createElement("div");
  wrap.id = "actionsList";
  state.actions.forEach(function(val, i) {
    var row = document.createElement("div");
    row.className = "action-row";
    var input = document.createElement("input");
    input.type = "text";
    input.className = "step-input action-input";
    input.value = val;
    input.maxLength = 120;
    input.setAttribute("data-idx", i);
    input.addEventListener("input", function() {
      state.actions[i] = input.value;
      updateNav(n);
    });
    row.appendChild(input);
    if (state.actions.length > 1) {
      var rm = document.createElement("button");
      rm.type = "button";
      rm.className = "btn-remove-action";
      rm.textContent = "×";
      rm.title = LABELS.removeAction[lang] || LABELS.removeAction.en;
      rm.addEventListener("click", function() {
        state.actions.splice(i, 1);
        renderStep(n);
      });
      row.appendChild(rm);
    }
    wrap.appendChild(row);
  });
  container.appendChild(wrap);

  if (state.actions.length < 5) {
    var addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "btn-add-action";
    addBtn.textContent = LABELS.addAction[lang] || LABELS.addAction.en;
    addBtn.addEventListener("click", function() {
      state.actions.push("");
      renderStep(n);
    });
    container.appendChild(addBtn);
  }
}

function renderStep(n) {
  var step      = STEPS[n];
  var container = document.getElementById("wizardStep");
  if (!container) return;
  var q    = step.question[lang] || step.question.en;
  var hint = step.hint ? (step.hint[lang] || step.hint.en) : "";

  var html = '<div class="step-num">' + (n + 1) + ' / ' + (STEPS.length + 1) + '</div>'
           + '<div class="step-question">' + escHtml(q) + '</div>'
           + (hint ? '<div class="step-hint">' + escHtml(hint) + '</div>' : '');

  if (step.type === "text" || step.type === "url" || step.type === "number") {
    var inputType = step.type === "number" ? "number" : (step.type === "url" ? "url" : "text");
    html += '<input type="' + inputType + '" id="stepInput" class="step-input" aria-label="' + escHtml(q) + '" value="' + escHtml(state[step.id] || "") + '" autocomplete="off" />';
  } else if (step.type === "textarea") {
    html += '<textarea id="stepInput" class="step-input step-textarea" aria-label="' + escHtml(q) + '">' + escHtml(state[step.id] || "") + '</textarea>';
  } else if (step.type === "select") {
    var current = state[step.id] || "";
    html += '<select id="stepInput" class="step-input" aria-label="' + escHtml(q) + '"><option value="">—</option>';
    step.options.forEach(function(opt) {
      var label = step.optionLabels ? (step.optionLabels[opt][lang] || step.optionLabels[opt].en) : opt;
      html += '<option value="' + escHtml(opt) + '"' + (current === opt ? " selected" : "") + '>' + escHtml(label) + '</option>';
    });
    html += '</select>';
  } else if (step.type === "file") {
    html += '<div id="fileWrap"></div>';
  }

  container.innerHTML = html;

  if (step.type === "list") {
    renderActionsList(container, n);
  } else if (step.type === "file") {
    renderFileStep(container, n);
  }

  applyLang();

  if (step.type === "select") {
    var selEl = container.querySelector("#stepInput");
    if (selEl) selEl.addEventListener("change", function() { state[step.id] = selEl.value; updateNav(n); });
  } else if (step.type !== "list" && step.type !== "file") {
    var input = container.querySelector("#stepInput");
    if (input) {
      input.addEventListener("input", function() { updateNav(n); });
      setTimeout(function() { input.focus(); }, 50);
    }
  }
  updateNav(n);
}

function renderFileStep(container, n) {
  var wrap = container.querySelector("#fileWrap");
  var errorMsg = "";

  function draw() {
    wrap.innerHTML = "";
    if (state.receiptImage) {
      var preview = document.createElement("img");
      preview.className = "receipt-preview";
      preview.src = "data:" + state.receiptImage.contentType + ";base64," + state.receiptImage.data;
      wrap.appendChild(preview);

      var rm = document.createElement("button");
      rm.type = "button";
      rm.className = "btn-remove-file";
      rm.textContent = LABELS.removeFile[lang] || LABELS.removeFile.en;
      rm.addEventListener("click", function() {
        state.receiptImage = null;
        draw();
        updateNav(n);
      });
      wrap.appendChild(rm);
    } else {
      var fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = "image/png,image/jpeg";
      fileInput.id = "receiptFileInput";
      fileInput.addEventListener("change", function() {
        var file = fileInput.files[0];
        if (!file) return;
        if (file.type !== "image/png" && file.type !== "image/jpeg") {
          errorMsg = LABELS.fileBadType[lang] || LABELS.fileBadType.en;
          draw();
          return;
        }
        if (file.size > MAX_RECEIPT_BYTES) {
          errorMsg = LABELS.fileTooBig[lang] || LABELS.fileTooBig.en;
          draw();
          return;
        }
        errorMsg = "";
        var reader = new FileReader();
        reader.onload = function() {
          var base64 = reader.result.split(",")[1];
          state.receiptImage = { data: base64, contentType: file.type };
          draw();
          updateNav(n);
        };
        reader.readAsDataURL(file);
      });
      wrap.appendChild(fileInput);
      if (errorMsg) {
        var err = document.createElement("div");
        err.className = "submit-error";
        err.textContent = errorMsg;
        wrap.appendChild(err);
      }
    }
  }
  draw();
}

function saveStep(n) {
  var step = STEPS[n];
  if (step.type === "text" || step.type === "url" || step.type === "number" || step.type === "textarea") {
    var input = document.getElementById("stepInput");
    if (input) state[step.id] = input.value.trim();
  } else if (step.type === "select") {
    var selInput = document.getElementById("stepInput");
    if (selInput) state[step.id] = selInput.value;
  }
  // list and contact-pair update state in real-time via event listeners
}

function buildPayload() {
  var payload = {
    name:           state.name           || "",
    website:        state.website        || "",
    location:       state.location       || "",
    foundedYear:    state.foundedYear    || "",
    volunteers:     state.volunteers     || "",
    actions:        nonEmptyActions(),
    donationStatus: state.donationStatus || "",
    notes:          state.notes          || "",
  };
  if (state.donationStatus === "yes" && state.receiptImage) {
    payload.receiptImage = state.receiptImage;
  }
  return payload;
}

var finalState    = "idle"; // idle | sending | sent | error
var finalErrorKey = "errorHint";

function renderFinal() {
  var container = document.getElementById("wizardStep");
  if (!container) return;
  var L = function(k) { return LABELS[k][lang] || LABELS[k].en; };

  if (finalState === "sent") {
    container.innerHTML =
      '<div class="done-title">' + escHtml(L("sentTitle")) + '</div>' +
      '<div class="done-hint">'  + escHtml(L("sentHint"))  + '</div>';
    document.getElementById("btnNext").style.display = "none";
    var bb = document.getElementById("btnBack");
    if (bb) bb.classList.add("is-hidden");
    updateProgress();
    return;
  }

  var html =
    '<div class="done-title">' + escHtml(L("done"))     + '</div>' +
    '<div class="done-hint">'  + escHtml(L("doneHint")) + '</div>';
  html += '<div class="booking-box">'
        + '<a class="booking-link" href="https://cal.com/countdowns" target="_blank" rel="noopener noreferrer">'
        + '<span class="t-en">📅 Book a call to verify your information</span>'
        + '<span class="t-fr">📅 Réservez un appel pour vérifier vos informations</span>'
        + '<span class="t-kr">📅 Rezève yon apèl pou verifye enfòmasyon ou yo</span>'
        + '<span class="t-es">📅 Reserva una llamada para verificar tu información</span>'
        + '</a>'
        + '<p class="booking-note">'
        + '<span class="t-en">Not required to submit, but speeds up review.</span>'
        + '<span class="t-fr">Non obligatoire pour soumettre, mais accélère l\'examen.</span>'
        + '<span class="t-kr">Pa obligatwa pou soumèt, men li akselere revizyon an.</span>'
        + '<span class="t-es">No es obligatorio para enviar, pero acelera la revisión.</span>'
        + '</p></div>';
  if (finalState === "error") {
    html += '<p class="submit-error">' + escHtml(L(finalErrorKey)) + '</p>';
  }
  html += '<button id="btnSubmit" class="btn-submit"' + (finalState === "sending" ? " disabled" : "") + '>'
        + escHtml(finalState === "sending" ? L("sending") : (finalState === "error" ? L("retry") : L("submit")))
        + '</button>';
  container.innerHTML = html;
  applyLang();

  document.getElementById("btnNext").style.display = "none";
  var btnBack = document.getElementById("btnBack");
  if (btnBack) { btnBack.classList.remove("is-hidden"); btnBack.textContent = L("back"); }
  updateProgress();

  var btn = document.getElementById("btnSubmit");
  if (btn) btn.addEventListener("click", submitApplication);
}

function submitApplication() {
  if (finalState === "sending") return;
  finalState = "sending";
  renderFinal();
  fetch("/api/ngo-apply", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildPayload())
  }).then(function(res) {
    if (res.status === 201) { finalState = "sent"; }
    else { finalState = "error"; finalErrorKey = res.status === 429 ? "rateLimited" : "errorHint"; }
    renderFinal();
  }).catch(function() {
    finalState = "error"; finalErrorKey = "errorHint";
    renderFinal();
  });
}

document.addEventListener("DOMContentLoaded", function() {
  applyLang();
  updateProgress();
  renderStep(0);

  document.querySelectorAll(".lang-btn").forEach(function(btn) {
    btn.addEventListener("click", function() { window.setLang(btn.getAttribute("data-lang")); });
  });

  document.getElementById("btnNext").addEventListener("click", function() {
    if (currentStep < STEPS.length) {
      saveStep(currentStep);
      currentStep = nextVisibleStep(currentStep + 1);
      updateProgress();
      if (currentStep === STEPS.length) { renderFinal(); } else { renderStep(currentStep); }
    }
  });

  document.getElementById("btnBack").addEventListener("click", function() {
    if (currentStep > 0) {
      currentStep = prevVisibleStep(currentStep - 1);
      updateProgress();
      document.getElementById("btnNext").style.display = "";
      renderStep(currentStep);
    }
  });
});
