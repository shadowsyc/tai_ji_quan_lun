(function () {
  "use strict";

  var root = document.documentElement;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var STORE = "taijilun.prefs";

  function loadPrefs() {
    try {
      return JSON.parse(localStorage.getItem(STORE) || "{}");
    } catch (e) {
      return {};
    }
  }

  function savePrefs(patch) {
    var next = Object.assign(loadPrefs(), patch);
    try {
      localStorage.setItem(STORE, JSON.stringify(next));
    } catch (e) {
      /* storage may be unavailable */
    }
  }

  var prefs = loadPrefs();
  if (prefs.theme) root.dataset.theme = prefs.theme;
  if (prefs.size) root.dataset.size = prefs.size;

  /* ============================================================
     i18n
     ============================================================ */
  var LANGS = {
    "zh-Hans": { code: "简" },
    "zh-Hant": { code: "繁" },
    en: { code: "EN" },
    ja: { code: "日" },
    ko: { code: "한" },
    es: { code: "ES" },
    fr: { code: "FR" },
    de: { code: "DE" }
  };

  var zhText = {};
  var zhAria = {};
  var zhTitle = document.title;
  var zhDesc = (document.querySelector('meta[name="description"]') || {}).content || "";
  var descEl = document.querySelector('meta[name="description"]');

  document.querySelectorAll("[data-i18n]").forEach(function (el) {
    zhText[el.dataset.i18n] = el.innerHTML;
  });
  document.querySelectorAll("[data-i18n-aria]").forEach(function (el) {
    zhAria[el.dataset.i18nAria] = el.getAttribute("aria-label") || "";
  });

  var currentLang = "zh-Hans";

  function dict(lang) {
    if (lang === "zh-Hans") return null;
    return (window.I18N && window.I18N[lang]) || null;
  }

  function applyLang(lang, animate) {
    if (!LANGS[lang]) lang = "zh-Hans";
    currentLang = lang;
    var d = dict(lang);

    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var key = el.dataset.i18n;
      var value = d && d[key] != null ? d[key] : zhText[key];
      if (value != null && el.innerHTML !== value) el.innerHTML = value;
    });

    document.querySelectorAll("[data-i18n-aria]").forEach(function (el) {
      var key = el.dataset.i18nAria;
      var value = d && d[key] ? d[key] : zhAria[key];
      if (value) el.setAttribute("aria-label", value);
    });

    root.lang = lang;
    root.dataset.lang = lang;

    document.title = (d && d.docTitle) || zhTitle;
    if (descEl) descEl.setAttribute("content", (d && d.docDesc) || zhDesc);

    var codeEl = document.getElementById("langCode");
    if (codeEl) codeEl.textContent = LANGS[lang].code;

    document.querySelectorAll("#langMenu [data-lang]").forEach(function (b) {
      b.setAttribute("aria-selected", String(b.dataset.lang === lang));
    });

    syncToggles();
  }

  /* ---------- language menu ---------- */
  var langBtn = document.getElementById("langBtn");
  var langMenu = document.getElementById("langMenu");

  function openMenu(open) {
    langMenu.hidden = !open;
    langBtn.setAttribute("aria-expanded", String(open));
  }

  langBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    openMenu(langMenu.hidden);
  });

  langMenu.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-lang]");
    if (!btn) return;
    applyLang(btn.dataset.lang, true);
    savePrefs({ lang: btn.dataset.lang });
    openMenu(false);
    langBtn.focus();
  });

  document.addEventListener("click", function (e) {
    if (!langMenu.hidden && !e.target.closest(".lang")) openMenu(false);
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !langMenu.hidden) {
      openMenu(false);
      langBtn.focus();
    }
  });

  /* ---------- header state + progress ---------- */
  var hd = document.getElementById("hd");
  var bar = document.getElementById("progress");
  var ticking = false;

  function onScroll() {
    var y = window.scrollY || 0;
    var h = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.width = (h > 0 ? Math.min(y / h, 1) * 100 : 0) + "%";
    hd.classList.toggle("is-stuck", y > 12);
    ticking = false;
  }

  window.addEventListener(
    "scroll",
    function () {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(onScroll);
      }
    },
    { passive: true }
  );
  onScroll();

  /* ---------- reveal on scroll ---------- */
  var revealables = document.querySelectorAll(".reveal");

  if (reduceMotion || !("IntersectionObserver" in window)) {
    revealables.forEach(function (el) {
      el.classList.add("is-in");
    });
  } else {
    var revealObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );
    revealables.forEach(function (el) {
      revealObserver.observe(el);
    });
  }

  /* ---------- chapter rail ---------- */
  var railLinks = Array.prototype.slice.call(document.querySelectorAll(".rail a"));
  var sections = railLinks
    .map(function (a) {
      return document.querySelector(a.getAttribute("href"));
    })
    .filter(Boolean);

  if (sections.length && "IntersectionObserver" in window) {
    var visible = new Map();
    var railObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          visible.set(entry.target.id, entry.isIntersecting ? entry.intersectionRatio : 0);
        });
        var bestId = null;
        var bestRatio = 0;
        visible.forEach(function (ratio, id) {
          if (ratio > bestRatio) {
            bestRatio = ratio;
            bestId = id;
          }
        });
        if (bestId) {
          railLinks.forEach(function (a) {
            a.classList.toggle("is-active", a.getAttribute("href") === "#" + bestId);
          });
        }
      },
      { threshold: [0, 0.15, 0.4, 0.75] }
    );
    sections.forEach(function (s) {
      railObserver.observe(s);
    });
  }

  /* ---------- reading settings ---------- */
  var sizeOrder = ["s", "m", "l"];

  function applySize(dir) {
    var current = root.dataset.size || "m";
    var idx = sizeOrder.indexOf(current);
    var next = sizeOrder[Math.min(Math.max(idx + dir, 0), sizeOrder.length - 1)];
    root.dataset.size = next;
    savePrefs({ size: next });
  }

  document.getElementById("fontDec").addEventListener("click", function () {
    applySize(-1);
  });
  document.getElementById("fontInc").addEventListener("click", function () {
    applySize(1);
  });

  var expBtn = document.getElementById("expToggle");
  var themeBtn = document.getElementById("themeToggle");

  /* ---------- per-sentence reveal ---------- */
  var articles = Array.prototype.slice.call(document.querySelectorAll(".s"));

  function isOpen(a) {
    return a.dataset.open !== "false";
  }

  function setOpen(a, open, animate) {
    var was = isOpen(a);
    a.dataset.open = open ? "true" : "false";
    var btn = a.querySelector(".s__orig");
    if (btn) btn.setAttribute("aria-expanded", String(open));
    if (open && animate && !was) {
      var exp = a.querySelector(".s__exp");
      if (exp) {
        exp.classList.remove("is-revealing");
        void exp.offsetWidth;
        exp.classList.add("is-revealing");
      }
    }
  }

  function allOpen() {
    return articles.every(isOpen);
  }

  function anyOpen() {
    return articles.some(isOpen);
  }

  articles.forEach(function (a, i) {
    var btn = a.querySelector(".s__orig");
    var exp = a.querySelector(".s__exp");
    if (btn && exp) {
      if (!exp.id) exp.id = "exp-" + i;
      btn.setAttribute("aria-controls", exp.id);
    }
    a.addEventListener("click", function (e) {
      if (e.target.closest("a")) return;
      var sel = window.getSelection();
      if (sel && String(sel).length > 1) return;
      setOpen(a, !isOpen(a), true);
      syncToggles();
    });
  });

  function openTarget() {
    var id = location.hash.slice(1);
    if (!id) return;
    var target = document.getElementById(id);
    if (target && target.classList.contains("s") && !isOpen(target)) {
      setOpen(target, true, true);
      syncToggles();
    }
  }

  window.addEventListener("hashchange", openTarget);

  function label(key, fallback) {
    var d = dict(currentLang);
    return (d && d[key]) || fallback;
  }

  function syncToggles() {
    var open = anyOpen();
    var night = root.dataset.theme === "night";
    root.dataset.explain = open ? "on" : "off";
    expBtn.setAttribute("aria-pressed", String(open));
    expBtn.textContent = open ? label("tools.ann", "译文") : label("tools.annOff", "原文");
    themeBtn.setAttribute("aria-pressed", String(night));
    themeBtn.textContent = night ? label("tools.day", "日读") : label("tools.night", "夜读");
  }

  expBtn.addEventListener("click", function () {
    var open = !allOpen();
    articles.forEach(function (a) {
      setOpen(a, open, true);
    });
    savePrefs({ explain: open });
    syncToggles();
  });

  themeBtn.addEventListener("click", function () {
    root.dataset.theme = root.dataset.theme === "night" ? "day" : "night";
    savePrefs({ theme: root.dataset.theme });
    syncToggles();
  });

  /* ---------- boot ---------- */
  var startOpen = prefs.explain !== false;
  articles.forEach(function (a) {
    setOpen(a, startOpen);
  });
  openTarget();
  applyLang(prefs.lang || "zh-Hans");
})();
