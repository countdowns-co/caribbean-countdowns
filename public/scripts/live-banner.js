(function () {
  var dataEl = document.getElementById("live-banner-data");
  if (!dataEl) return;

  if (sessionStorage.getItem("live-banner-dismissed") === "1") return;

  // The banner is decorative — everything below is deferred to idle time so
  // it never competes with first paint / input readiness (Lighthouse TBT:
  // this script was 732 ms of main-thread bootup when run synchronously).
  var schedule = window.requestIdleCallback || function (fn) { setTimeout(fn, 1); };

  schedule(function () {
    var festivals = JSON.parse(dataEl.getAttribute("data-festivals"));

    // Intl.DateTimeFormat construction is expensive — one formatter per
    // timezone, one offset computation per (date, timezone) pair.
    var tzFormatters = {};
    function tzFormatter(tz) {
      return tzFormatters[tz] || (tzFormatters[tz] = new Intl.DateTimeFormat("en-US", {
        timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false
      }));
    }

    var tzOffsets = {};

    // Returns UTC offset in ms for a timezone on a given date string.
    // e.g. tzOffsetMs("2026-05-10", "America/St_Lucia") → -14400000
    function tzOffsetMs(dateStr, tz) {
      var key = dateStr + "|" + tz;
      if (key in tzOffsets) return tzOffsets[key];
      var noonUTC = new Date(dateStr + "T12:00:00Z");
      var parts = tzFormatter(tz).formatToParts(noonUTC);
      var h = parseInt(parts.find(function(p) { return p.type === "hour"; }).value);
      var m = parseInt(parts.find(function(p) { return p.type === "minute"; }).value);
      tzOffsets[key] = ((h - 12) * 60 + m) * 60000;
      return tzOffsets[key];
    }

    function tzDayStart(dateStr, tz) {
      var p = dateStr.split("-").map(Number);
      return Date.UTC(p[0], p[1] - 1, p[2], 0, 0, 0) - tzOffsetMs(dateStr, tz);
    }

    function tzDayEnd(dateStr, tz) {
      var p = dateStr.split("-").map(Number);
      return Date.UTC(p[0], p[1] - 1, p[2], 23, 59, 59, 999) - tzOffsetMs(dateStr, tz);
    }

    var nowMs = Date.now();

    var live = festivals.filter(function (f) {
      var tz = f.timezone || "America/Martinique";
      return nowMs >= tzDayStart(f.startDate, tz) && nowMs <= tzDayEnd(f.endDate, tz);
    });

    if (!live.length) return;

    var months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

    function getDateStr(f) {
      var s = new Date(f.startDate + "T12:00:00Z");
      var e = new Date(f.endDate + "T12:00:00Z");
      return s.getUTCMonth() === e.getUTCMonth()
        ? months[s.getUTCMonth()] + " " + s.getUTCDate() + "–" + e.getUTCDate()
        : months[s.getUTCMonth()] + " " + s.getUTCDate() + " – " + months[e.getUTCMonth()] + " " + e.getUTCDate();
    }

    function formatMs(ms) {
      if (ms <= 0) return "—";
      var s = Math.floor(ms / 1000);
      var d = Math.floor(s / 86400);
      var h = Math.floor((s % 86400) / 3600);
      var m = Math.floor((s % 3600) / 60);
      var sec = s % 60;
      return d + "d " + pad(h) + "h " + pad(m) + "m " + pad(sec) + "s";
    }

    function pad(n) { return n < 10 ? "0" + n : n; }

    function el(tag, cls, text) {
      var e = document.createElement(tag);
      if (cls) e.className = cls;
      if (text !== undefined) e.textContent = text;
      return e;
    }

    function buildContent(container) {
      live.forEach(function (f, i) {
        if (i > 0) container.appendChild(el("span", "live-tsep-big", "✦"));

        var a = document.createElement("a");
        a.className = "live-tname";
        a.href = f.website || "#";
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = f.name;
        container.appendChild(a);

        container.appendChild(el("span", "live-tsep", "·"));
        container.appendChild(el("span", "live-tloc", f.city ? f.city + ", " + f.country : f.country));
        container.appendChild(el("span", "live-tsep", "·"));
        container.appendChild(el("span", "live-tdates", getDateStr(f)));
        container.appendChild(el("span", "live-tsep", "·"));
        container.appendChild(el("span", "live-tends", "ends in"));

        var tz = f.timezone || "America/Martinique";
        var endTs = tzDayEnd(f.endDate, tz);

        var counter = el("span", "live-counter");
        counter.setAttribute("data-endts", endTs);
        counter.textContent = formatMs(endTs - Date.now());
        container.appendChild(counter);
      });
    }

    var tickerA = document.getElementById("live-ticker-a");
    var tickerB = document.getElementById("live-ticker-b");
    var ticker  = document.getElementById("live-ticker");
    var banner  = document.getElementById("live-banner");
    var closeEl = document.getElementById("live-banner-close");

    if (!tickerA || !tickerB || !ticker || !banner || !closeEl) return;

    buildContent(tickerA);

    // tickerB is the aria-hidden duplicate for the seamless scroll loop —
    // clone A instead of rebuilding. tabIndex=-1 alone isn't enough: axe's
    // aria-hidden-focus rule (correctly) still flags an <a href> inside an
    // aria-hidden container as focusable via assistive tech / programmatic
    // focus. These clones are purely visual, so strip href entirely —
    // removes the element from the tab order for real, no residual link
    // semantics.
    Array.prototype.slice.call(tickerA.childNodes).forEach(function (n) {
      tickerB.appendChild(n.cloneNode(true));
    });
    tickerB.querySelectorAll("a").forEach(function (a) { a.removeAttribute("href"); });

    banner.classList.add("is-visible");

    requestAnimationFrame(function () {
      var w = tickerA.offsetWidth + 80;
      ticker.style.animationDuration = Math.max(8, w / 80) + "s";
    });

    var counters = document.querySelectorAll(".live-counter[data-endts]");
    function tick() {
      counters.forEach(function (c) {
        c.textContent = formatMs(Number(c.getAttribute("data-endts")) - Date.now());
      });
    }
    setInterval(tick, 1000);

    closeEl.addEventListener("click", function () {
      banner.classList.remove("is-visible");
      sessionStorage.setItem("live-banner-dismissed", "1");
    });
  });
})();
