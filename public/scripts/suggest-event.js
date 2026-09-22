/* suggest-event.js — caribbean.countdowns.co */
var LANGS = ["en", "fr", "kr", "es"];
var lang  = localStorage.getItem("lang") || "en";

var TZ_MAP = {
  "Antigua and Barbuda":    "America/Antigua",
  "Anguilla":               "America/Anguilla",
  "Aruba":                  "America/Aruba",
  "Barbados":               "America/Barbados",
  "Bonaire":                "America/Curacao",
  "British Virgin Islands": "America/Tortola",
  "Cayman Islands":         "America/Cayman",
  "Curaçao":                "America/Curacao",
  "Dominica":               "America/Dominica",
  "Grenada":                "America/Grenada",
  "Guadeloupe":             "America/Guadeloupe",
  "La Désirade":            "America/Guadeloupe",
  "Les Saintes":            "America/Guadeloupe",
  "Marie-Galante":          "America/Guadeloupe",
  "Martinique":             "America/Martinique",
  "Montserrat":             "America/Montserrat",
  "Saba":                   "America/Curacao",
  "Saint Barthélemy":       "America/St_Barthelemy",
  "Saint Kitts and Nevis":  "America/St_Kitts",
  "Saint Lucia":            "America/St_Lucia",
  "Saint Martin":           "America/Martinique",
  "Saint Vincent and the Grenadines": "America/St_Vincent",
  "Sint Maarten":           "America/Lower_Princes",
  "Sint Eustatius":         "America/Curacao",
  "Trinidad and Tobago":    "America/Port_of_Spain",
  "Turks and Caicos Islands": "America/Grand_Turk",
  "U.S. Virgin Islands":    "America/Virgin",
  "Bahamas":                "America/Nassau",
  "Bermuda":                "America/Bermuda",
  "Cuba":                   "America/Havana",
  "Dominican Republic":     "America/Santo_Domingo",
  "Haiti":                  "America/Port-au-Prince",
  "Jamaica":                "America/Jamaica",
  "Puerto Rico":            "America/Puerto_Rico",
  "French Guiana":          "America/Cayenne",
  "Suriname":               "America/Paramaribo",
};
var COUNTRIES = Object.keys(TZ_MAP);

var DETAILS = ["rap","afro","dancehall","shatta","zouk","kompa","jazz","blues","soul","reggae","calypso","steelpan","soca","bouyon","roots","electro","trail","running","triathlon","cycling","swimming","competition","team sport","water sport"];

var TICKET_PLATFORMS = [
  { name: "Website",           placeholder: "https://..." },
  { name: "Bizouk",            placeholder: "https://www.bizouk.com/events/..." },
  { name: "Kiwol",             placeholder: "https://www.kiwol.com/..." },
  { name: "Billetweb",         placeholder: "https://www.billetweb.fr/..." },
  { name: "4 Circles Tickets", placeholder: "https://4circlestickets.com/..." },
  { name: "Sabouj",            placeholder: "https://sabouj.fr/..." },
  { name: "Other",             placeholder: "https://..." },
];

var ECO_CRITERIA = [
  { id: "transport",  label: { en: "Shared transport organized (shuttle, carpool)",  fr: "Transport partagé organisé (navette, covoiturage)",      kr: "Transpò patajé òganize (navèt, covwatiraj)",           es: "Transporte compartido organizado (lanzadera, carpool)" } },
  { id: "no_plastic", label: { en: "Single-use plastic banned on site",              fr: "Plastique à usage unique interdit sur le site",           kr: "Plastik itilizasyon inikal entèdi sou sit",            es: "Plástico de un solo uso prohibido en el recinto" } },
  { id: "reusable",   label: { en: "Reusable cups and plates used",                  fr: "Gobelets et assiettes réutilisables utilisés",            kr: "Gode ak asyèt reutilizab itilize",                    es: "Vasos y platos reutilizables utilizados" } },
  { id: "water",      label: { en: "Free water refill stations on site",             fr: "Points de recharge d'eau gratuits sur le site",           kr: "Estasyon ranplisman dlo gratis sou sit",               es: "Puntos de recarga de agua gratuitos en el recinto" } },
  { id: "ngo",        label: { en: "Partners with an environmental NGO",             fr: "Partenariat avec une ONG environnementale",               kr: "Patnè ak yon ONG anviwonmantal",                      es: "Socio de una ONG medioambiental" } },
];

var LABELS = {
  back:        { en: "← Back",            fr: "← Retour",                    kr: "← Retounen",       es: "← Volver" },
  next:        { en: "Next →",            fr: "Suivant →",                    kr: "Swivan →",          es: "Siguiente →" },
  skip:        { en: "Skip →",            fr: "Passer →",                     kr: "Pase →",            es: "Omitir →" },
  done:        { en: "✓ All done!",       fr: "✓ C'est fait !",               kr: "✓ Fini !",          es: "✓ ¡Listo!" },
  doneHint:    { en: "Click below to submit your suggestion — nothing else is sent.",
                 fr: "Cliquez ci-dessous pour envoyer votre suggestion — rien d'autre n'est transmis.",
                 kr: "Klike anba a pou voye sijesyon ou an — nou pa voye anyen ankò.",
                 es: "Haz clic abajo para enviar tu sugerencia — no se transmite nada más." },
  submit:      { en: "Submit suggestion", fr: "Envoyer la suggestion",        kr: "Voye sijesyon an",  es: "Enviar la sugerencia" },
  sending:     { en: "Sending…",          fr: "Envoi…",                       kr: "Voye…",             es: "Enviando…" },
  sentTitle:   { en: "✓ Suggestion sent!", fr: "✓ Suggestion envoyée !",      kr: "✓ Sijesyon voye !", es: "✓ ¡Sugerencia enviada!" },
  sentHint:    { en: "We review suggestions within a few days. Thanks!",
                 fr: "Nous examinons les suggestions sous quelques jours. Merci !",
                 kr: "Nou egzamine sijesyon yo nan kèk jou. Mèsi !",
                 es: "Revisamos las sugerencias en unos días. ¡Gracias!" },
  errorHint:   { en: "Something went wrong — please try again.",
                 fr: "Une erreur s'est produite — veuillez réessayer.",
                 kr: "Gen yon erè — tanpri eseye ankò.",
                 es: "Algo salió mal — inténtalo de nuevo." },
  rateLimited: { en: "Too many submissions — try again in a minute.",
                 fr: "Trop de soumissions — réessayez dans une minute.",
                 kr: "Twòp soumisyon — eseye ankò nan yon minit.",
                 es: "Demasiados envíos — inténtalo en un minuto." },
  retry:       { en: "Retry",             fr: "Réessayer",                    kr: "Eseye ankò",        es: "Reintentar" },
};

var STEPS = [
  { id:"name",        required:true,  type:"text",
    question:{ en:"What's the name of the event?",        fr:"Quel est le nom de l'événement ?",       kr:"Ki jan yo rele évènman an ?",        es:"¿Cuál es el nombre del evento?" },
    hint:    { en:"e.g. ADI Music Festival",              fr:"ex. ADI Music Festival",                  kr:"egz. ADI Music Festival",             es:"ej. ADI Music Festival" } },
  { id:"website",     required:false, type:"url",
    question:{ en:"What's the website URL?",              fr:"Quelle est l'URL du site web ?",          kr:"Ki URL sit web la ?",                 es:"¿Cuál es la URL del sitio web?" },
    hint:    { en:"Leave blank if none",                  fr:"Laissez vide si aucun",                   kr:"Kite vid si pa gen youn",             es:"Dejar en blanco si no hay" } },
  { id:"description", required:false, type:"textarea",
    question:{ en:"Describe the event in one sentence.",  fr:"Décrivez l'événement en une phrase.",     kr:"Dekri évènman an an yon fraz.",        es:"Describe el evento en una frase." },
    hint:    { en:"Keep it short — one sentence",        fr:"Court et précis — une phrase",             kr:"Kout — yon fraz",                     es:"Breve — una frase" } },
  { id:"dates",       required:true,  type:"date-range",
    question:{ en:"When does it take place?",             fr:"Quand se déroule-t-il ?",                 kr:"Ki lè li fèt ?",                      es:"¿Cuándo tiene lugar?" },
    hint:    { en:"Same date for both if it's a single day", fr:"Même date si c'est un seul jour",     kr:"Menm dat si se yon sèl jou",          es:"La misma fecha si es un solo día" } },
  { id:"country",     required:true,  type:"select",      options:COUNTRIES,
    question:{ en:"Where does it take place?",            fr:"Où se déroule-t-il ?",                    kr:"Kote li fèt ?",                       es:"¿Dónde tiene lugar?" },
    hint:    { en:"Timezone is set automatically",        fr:"Le fuseau horaire est défini automatiquement", kr:"Fizo orè a regle otomatikman",   es:"La zona horaria se establece automáticamente" } },
  { id:"city",        required:false, type:"text",
    question:{ en:"Which city or area?",                  fr:"Quelle ville ou zone ?",                  kr:"Ki vil oswa zòn ?",                   es:"¿Qué ciudad o zona?" },
    hint:    { en:"e.g. Le Moule (blank if island-wide)", fr:"ex. Le Moule (vide si à l'échelle de l'île)", kr:"egz. Le Moule (kite vid si nan tout zile a)", es:"ej. Le Moule (en blanco si es en toda la isla)" } },
  { id:"type",        required:true,  type:"select",
    options:["music festival","carnival","sailing race","art","sport","other"],
    optionLabels:{
      "music festival":{ en:"Music festival", fr:"Festival de musique", kr:"Fèstival mizik",  es:"Festival de música" },
      "carnival":      { en:"Carnival",       fr:"Carnaval",            kr:"Kanaval",         es:"Carnaval" },
      "sailing race":  { en:"Sailing race",   fr:"Course à la voile",   kr:"Kous vwal",       es:"Carrera de vela" },
      "art":           { en:"Art",            fr:"Art",                 kr:"Atizay",          es:"Arte" },
      "sport":         { en:"Sport",          fr:"Sport",               kr:"Spo",             es:"Deporte" },
      "other":         { en:"Other",          fr:"Autre",               kr:"Le restan",       es:"Otro" },
    },
    question:{ en:"What type of event is it?",            fr:"Quel type d'événement est-ce ?",          kr:"Ki kalité évènman li ye ?",            es:"¿Qué tipo de evento es?" },
    hint:    { en:"",                                     fr:"",                                        kr:"",                                    es:"" } },
  { id:"details",     required:false, type:"multiselect", options:DETAILS,
    question:{ en:"Event details (genres, activities...)",   fr:"Détails de l'événement (genres, activités...)", kr:"Détay évènman an (jan mizik, aktivite...)", es:"Detalles del evento (géneros, actividades...)" },
    hint:    { en:"Select all that apply",                fr:"Sélectionnez tout ce qui s'applique",     kr:"Chwazi tout sa ki aplike",            es:"Selecciona todos los que apliquen" } },
  { id:"image",       required:false, type:"url",
    question:{ en:"Do you have an image URL?",            fr:"Avez-vous une URL d'image ?",             kr:"Eske ou gen yon URL imaj ?",           es:"¿Tienes una URL de imagen?" },
    hint:    { en:"Link to a photo (blank if none)",      fr:"Lien vers une photo (vide si aucune)",    kr:"Lyen nan foto a (kite vid si pa gen)", es:"Enlace a una foto (en blanco si no hay)" } },
  { id:"tickets",     required:false, type:"tickets",
    question:{ en:"Where can people buy tickets?",        fr:"Où peut-on acheter des billets ?",        kr:"Ki kote moun ka achte tikè ?",         es:"¿Dónde puede la gente comprar entradas?" },
    hint:    { en:"Select platforms and paste the URL. Leave all blank if free.", fr:"Sélectionnez les plateformes et collez l'URL. Tout vide = gratuit.", kr:"Chwazi platfòm yo epi kole URL. Tout vide = gratis.", es:"Selecciona plataformas y pega la URL. Todo vacío = gratuito." } },
  { id:"eco",         required:false, type:"eco",
    question:{ en:"Does this festival have any of these practices?",          fr:"Ce festival applique-t-il certaines de ces pratiques ?",       kr:"Èske fèstival sa a gen okenn nan pratik sa yo ?",          es:"¿Este festival tiene alguna de estas prácticas?" },
    hint:    { en:"Select only what you know for certain — skip if unsure",   fr:"Cochez uniquement ce que vous savez avec certitude",           kr:"Chwazi sèlman sa ou konnen avèk sèten — pase si pa sèten", es:"Selecciona solo lo que sepas con certeza — omite si no estás seguro" } },
  { id:"notes",       required:false, type:"textarea",
    question:{ en:"Anything else to tell us?",            fr:"Autre chose à nous dire ?",               kr:"Eske gen lòt bagay ou vle di nou ?",   es:"¿Algo más que quieras decirnos?" },
    hint:    { en:"Edition number, contact, sustainability page URL... (not included in the listing)", fr:"Numéro d'édition, contact, URL page durabilité... (non inclus dans la fiche)", kr:"Nimewo edisyon, contact, URL paj dirab... (pa enkli nan lis la)", es:"Número de edición, contacto, URL página sostenibilidad... (no se incluye en el listado)" } },
];

var currentStep = 0;
var state = { details: [], tickets: [], ecoSignals: [] };

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

function isStepValid(n) {
  var step = STEPS[n];
  if (!step.required) return true;
  if (step.type === "date-range") return !!(state.startDate && state.endDate);
  if (step.type === "select")     return !!(state[step.id]);
  var input = document.getElementById("stepInput");
  return !!(input && input.value.trim());
}

function hasValue(n) {
  var step = STEPS[n];
  if (step.type === "date-range")  return !!(state.startDate || state.endDate);
  if (step.type === "multiselect") return state.details.length > 0;
  if (step.type === "tickets")     return state.tickets.length > 0;
  if (step.type === "eco")         return state.ecoSignals.length > 0;
  return !!(state[step.id]);
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

function renderStep(n) {
  var step      = STEPS[n];
  var container = document.getElementById("wizardStep");
  if (!container) return;
  var q    = step.question[lang] || step.question.en;
  var hint = step.hint ? (step.hint[lang] || step.hint.en) : "";

  var html = '<div class="step-num">' + (n + 1) + ' / ' + (STEPS.length + 1) + '</div>'
           + '<div class="step-question">' + escHtml(q) + '</div>'
           + (hint ? '<div class="step-hint">' + escHtml(hint) + '</div>' : '');

  if (step.type === "text" || step.type === "url") {
    html += '<input type="' + (step.type === "url" ? "url" : "text") + '" id="stepInput" class="step-input" aria-label="' + escHtml(q) + '" value="' + escHtml(state[step.id] || "") + '" autocomplete="off" />';
  } else if (step.type === "textarea") {
    html += '<textarea id="stepInput" class="step-input step-textarea" aria-label="' + escHtml(q) + '">' + escHtml(state[step.id] || "") + '</textarea>';
  } else if (step.type === "date-range") {
    var sd = state.startDate || "", ed = state.endDate || "";
    var sdLabel = { en: "Start date", fr: "Date de début", kr: "Dat kòmansman", es: "Fecha de inicio" };
    var edLabel = { en: "End date", fr: "Date de fin", kr: "Dat lafen", es: "Fecha de fin" };
    html += '<div class="date-row">'
          + '<div><div class="date-label t-en">Start date</div><div class="date-label t-fr">Date de début</div><div class="date-label t-kr">Dat kòmansman</div><div class="date-label t-es">Fecha de inicio</div>'
          + '<input type="date" id="startDate" class="step-input" aria-label="' + escHtml(sdLabel[lang] || sdLabel.en) + '" value="' + escHtml(sd) + '" /></div>'
          + '<div><div class="date-label t-en">End date</div><div class="date-label t-fr">Date de fin</div><div class="date-label t-kr">Dat lafen</div><div class="date-label t-es">Fecha de fin</div>'
          + '<input type="date" id="endDate" class="step-input" aria-label="' + escHtml(edLabel[lang] || edLabel.en) + '" value="' + escHtml(ed) + '" /></div>'
          + '</div>';
  } else if (step.type === "select") {
    var current = state[step.id] || "";
    html += '<select id="stepInput" class="step-input" aria-label="' + escHtml(q) + '"><option value="">—</option>';
    step.options.forEach(function(opt) {
      var label = step.optionLabels ? (step.optionLabels[opt][lang] || step.optionLabels[opt].en) : opt;
      html += '<option value="' + escHtml(opt) + '"' + (current === opt ? " selected" : "") + '>' + escHtml(label) + '</option>';
    });
    html += '</select>';
    if (step.id === "country" && state.timezone) {
      html += '<div class="tz-note">→ ' + escHtml(state.timezone) + '</div>';
    }
  } else if (step.type === "multiselect") {
    html += '<div class="details-grid" id="detailsGrid">';
    step.options.forEach(function(opt) {
      var sel = state.details.indexOf(opt) !== -1;
      html += '<button class="detail-option' + (sel ? " selected" : "") + '" data-detail="' + escHtml(opt) + '" type="button">' + escHtml(opt) + '</button>';
    });
    html += '</div>';
  } else if (step.type === "tickets") {
    html += '<div id="ticketPlatforms">';
    TICKET_PLATFORMS.forEach(function(p) {
      var existing = state.tickets.find(function(t) { return t.name === p.name; });
      var sel = !!existing;
      html += '<div class="ticket-row">'
            + '<button class="detail-option' + (sel ? " selected" : "") + '" data-platform="' + escHtml(p.name) + '" type="button">' + escHtml(p.name) + '</button>'
            + '<input type="url" class="platform-url step-input' + (sel ? " visible" : "") + '" data-platform="' + escHtml(p.name) + '" placeholder="' + escHtml(p.placeholder) + '" value="' + escHtml(existing ? existing.url : "") + '" />'
            + '</div>';
    });
    html += '</div>';
  } else if (step.type === "eco") {
    html += '<div class="details-grid" id="ecoGrid">';
    ECO_CRITERIA.forEach(function(c) {
      var sel = state.ecoSignals.indexOf(c.id) !== -1;
      html += '<button class="detail-option' + (sel ? " selected" : "") + '" data-eco="' + escHtml(c.id) + '" type="button">' + escHtml(c.label[lang] || c.label.en) + '</button>';
    });
    html += '</div>';
  }

  container.innerHTML = html;
  applyLang();

  if (step.type === "date-range") {
    var sdEl = container.querySelector("#startDate");
    var edEl = container.querySelector("#endDate");
    if (sdEl) sdEl.addEventListener("change", function() { state.startDate = sdEl.value; updateNav(n); });
    if (edEl) edEl.addEventListener("change", function() { state.endDate   = edEl.value; updateNav(n); });
  } else if (step.type === "select") {
    var selEl = container.querySelector("#stepInput");
    if (selEl) {
      selEl.addEventListener("change", function() {
        state[step.id] = selEl.value;
        if (step.id === "country") {
          state.timezone = TZ_MAP[selEl.value] || "";
          var note = container.querySelector(".tz-note");
          if (!note) { note = document.createElement("div"); note.className = "tz-note"; selEl.parentNode.insertBefore(note, selEl.nextSibling); }
          note.textContent = state.timezone ? ("→ " + state.timezone) : "";
        }
        updateNav(n);
      });
    }
  } else if (step.type === "multiselect") {
    container.querySelectorAll(".detail-option").forEach(function(btn) {
      btn.addEventListener("click", function() {
        var v = btn.getAttribute("data-detail"), idx = state.details.indexOf(v);
        if (idx === -1) { state.details.push(v); btn.classList.add("selected"); }
        else            { state.details.splice(idx, 1); btn.classList.remove("selected"); }
        updateNav(n);
      });
    });
  } else if (step.type === "tickets") {
    container.querySelectorAll("button[data-platform]").forEach(function(btn) {
      btn.addEventListener("click", function() {
        var pName = btn.getAttribute("data-platform");
        var urlInput = container.querySelector('input[data-platform="' + pName + '"]');
        if (btn.classList.contains("selected")) {
          btn.classList.remove("selected"); urlInput.classList.remove("visible"); urlInput.value = "";
          state.tickets = state.tickets.filter(function(t) { return t.name !== pName; });
        } else {
          btn.classList.add("selected"); urlInput.classList.add("visible");
          if (pName === "Website" && state.website) urlInput.value = state.website;
          state.tickets.push({ name: pName, url: urlInput.value });
          urlInput.focus();
        }
        updateNav(n);
      });
    });
    container.querySelectorAll("input[data-platform]").forEach(function(urlInput) {
      urlInput.addEventListener("input", function() {
        var pName    = urlInput.getAttribute("data-platform");
        var existing = state.tickets.find(function(t) { return t.name === pName; });
        if (existing) existing.url = urlInput.value.trim();
      });
    });
  } else if (step.type === "eco") {
    container.querySelectorAll("button[data-eco]").forEach(function(btn) {
      btn.addEventListener("click", function() {
        var v = btn.getAttribute("data-eco"), idx = state.ecoSignals.indexOf(v);
        if (idx === -1) { state.ecoSignals.push(v); btn.classList.add("selected"); }
        else            { state.ecoSignals.splice(idx, 1); btn.classList.remove("selected"); }
        updateNav(n);
      });
    });
  } else {
    var input = container.querySelector("#stepInput");
    if (input) {
      input.addEventListener("input", function() { updateNav(n); });
      setTimeout(function() { input.focus(); }, 50);
    }
  }
  updateNav(n);
}

function saveStep(n) {
  var step = STEPS[n];
  if (step.type === "text" || step.type === "url" || step.type === "textarea") {
    var input = document.getElementById("stepInput");
    if (input) state[step.id] = input.value.trim();
  } else if (step.type === "select") {
    var input = document.getElementById("stepInput");
    if (input) { state[step.id] = input.value; if (step.id === "country") state.timezone = TZ_MAP[input.value] || ""; }
  } else if (step.type === "date-range") {
    var sd = document.getElementById("startDate"), ed = document.getElementById("endDate");
    if (sd) state.startDate = sd.value;
    if (ed) state.endDate   = ed.value || (sd ? sd.value : "");
  }
  // multiselect, tickets, eco update state in real-time via event listeners
}

function buildPayload() {
  return {
    name:        state.name        || "",
    website:     state.website     || "",
    description: state.description || "",
    startDate:   state.startDate   || "",
    endDate:     state.endDate     || "",
    city:        state.city        || "",
    country:     state.country     || "",
    timezone:    state.timezone    || "",
    type:        state.type        || "",
    details:     state.details.slice(),
    image:       state.image       || "",
    tickets:     state.tickets.filter(function(t) { return t.url; }),
    eco:         state.ecoSignals.slice(),
    notes:       state.notes       || ""
  };
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
  if (finalState === "error") {
    html += '<p class="submit-error">' + escHtml(L(finalErrorKey)) + '</p>';
  }
  html += '<button id="btnSubmit" class="btn-submit"' + (finalState === "sending" ? " disabled" : "") + '>'
        + escHtml(finalState === "sending" ? L("sending") : (finalState === "error" ? L("retry") : L("submit")))
        + '</button>';
  container.innerHTML = html;

  document.getElementById("btnNext").style.display = "none";
  var btnBack = document.getElementById("btnBack");
  if (btnBack) { btnBack.classList.remove("is-hidden"); btnBack.textContent = L("back"); }
  updateProgress();

  var btn = document.getElementById("btnSubmit");
  if (btn) btn.addEventListener("click", submitSuggestion);
}

function submitSuggestion() {
  if (finalState === "sending") return;
  finalState = "sending";
  renderFinal();
  fetch("/api/suggest", {
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
      currentStep++;
      updateProgress();
      if (currentStep === STEPS.length) { renderFinal(); } else { renderStep(currentStep); }
    }
  });

  document.getElementById("btnBack").addEventListener("click", function() {
    if (currentStep > 0) {
      currentStep--;
      updateProgress();
      document.getElementById("btnNext").style.display = "";
      renderStep(currentStep);
    }
  });
});
