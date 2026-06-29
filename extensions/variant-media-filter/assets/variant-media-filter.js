(function () {
  // ─── 1. PARSE DATA FROM LIQUID ────────────────────────────────────────────
  function parseJson(id, fallback) {
    try {
      var el = document.getElementById(id);
      if (!el) return fallback;
      var text = (el.textContent || "").trim();
      var parsed = JSON.parse(text);
      // Handle double-encoded JSON (liquid | json on an already-JSON string)
      if (typeof parsed === "string") {
        try { parsed = JSON.parse(parsed); } catch (e2) {}
      }
      return parsed;
    } catch (e) { return fallback; }
  }

  var map            = parseJson("vmf-map", {});
  var mediaList      = parseJson("vmf-media", []);
  var variantsList   = parseJson("vmf-variants", []);
  var initialVariantId = parseJson("vmf-initial-variant", null);

  // Inject hide-class CSS once
  if (!document.getElementById("vmf-style")) {
    var st = document.createElement("style");
    st.id = "vmf-style";
    st.textContent =
      ".vmf-hidden{display:none!important;visibility:hidden!important;" +
      "opacity:0!important;pointer-events:none!important;position:absolute!important;" +
      "width:0!important;height:0!important;overflow:hidden!important;z-index:-1!important;}";
    document.head.appendChild(st);
  }

  // ─── 2. HIDE / SHOW ───────────────────────────────────────────────────────
  function setHidden(el, hidden) {
    if (!el) return;
    if (hidden) {
      el.classList.add("vmf-hidden");
      el.setAttribute("aria-hidden", "true");
    } else {
      el.classList.remove("vmf-hidden");
      el.removeAttribute("aria-hidden");
    }
  }

  // ─── 3. URL HELPERS ───────────────────────────────────────────────────────
  function stripShopifySizeSuffix(path) {
    return path.replace(/_\d+x\d*(?=\.[a-zA-Z0-9]+$)/, "");
  }
  function normalizeUrl(u) {
    if (!u) return "";
    var s = String(u).split(" ")[0].split(",")[0].trim();
    if (s.startsWith("//")) s = window.location.protocol + s;
    s = s.replace(/&amp;/g, "&");
    try {
      var url = new URL(s, window.location.origin);
      url.searchParams.delete("width");
      url.searchParams.delete("v");
      return url.origin + stripShopifySizeSuffix(url.pathname);
    } catch (e) { return stripShopifySizeSuffix(s.split("?")[0]); }
  }

  // Return all normalized URL candidates from an img element (handles lazy loading, srcset, picture)
  function getImgUrls(img) {
    if (!img) return [];
    var seen = {};
    var out  = [];
    function add(u) {
      var n = normalizeUrl(u);
      if (n && !seen[n]) { seen[n] = 1; out.push(n); }
    }
    // srcset / data-srcset
    ["srcset", "data-srcset"].forEach(function (attr) {
      var ss = img.getAttribute(attr) || "";
      if (ss) ss.split(",").forEach(function (p) { add(p.trim().split(" ")[0]); });
    });
    // picture sources
    var pic = img.closest("picture");
    if (pic) {
      Array.from(pic.querySelectorAll("source")).forEach(function (src) {
        var ss = src.getAttribute("srcset") || "";
        if (ss) ss.split(",").forEach(function (p) { add(p.trim().split(" ")[0]); });
      });
    }
    // direct attributes
    ["currentSrc", "src", "data-src", "data-lazy", "data-original", "data-image"].forEach(function (k) {
      var v = k === "currentSrc" ? img.currentSrc : img.getAttribute(k);
      if (v) add(v);
    });
    return out;
  }

  // ─── 4. ID HELPERS ────────────────────────────────────────────────────────
  function gidToNumeric(gid) { return String(gid || "").split("/").pop() || String(gid || ""); }
  function toNumericIdString(x) {
    var last = gidToNumeric(String(x || ""));
    var n = parseInt(last, 10);
    return Number.isFinite(n) ? String(n) : null;
  }
  // Extract numeric tail from "sectionId-mediaId" or plain "mediaId" strings
  function extractNumericTail(val) {
    var s = String(val || "");
    var parts = s.split("-");
    var tail = parts[parts.length - 1];
    return (tail && /^\d+$/.test(tail)) ? tail : null;
  }

  // ─── 5. MEDIA LOOKUP TABLE ────────────────────────────────────────────────
  var mediaIdToUrl = new Map();   // numericId(Number) → normalizedUrl
  var allMediaUrls = new Set();   // all product image URLs (normalized)

  mediaList.forEach(function (m) {
    var idStr = toNumericIdString(m && m.id);
    var url   = normalizeUrl(m && m.url);
    if (!idStr || !url) return;
    mediaIdToUrl.set(Number(idStr), url);
    allMediaUrls.add(url);
  });

  // ─── 6. MAP LOOKUP ────────────────────────────────────────────────────────
  function getMapEntryForVariant(variantId) {
    var k1 = String(variantId || "");
    if (map && Object.prototype.hasOwnProperty.call(map, k1)) return map[k1];
    var k2 = toNumericIdString(variantId);
    if (k2 && Object.prototype.hasOwnProperty.call(map, k2)) return map[k2];
    if (k2) {
      var gidKey = "gid://shopify/ProductVariant/" + k2;
      if (Object.prototype.hasOwnProperty.call(map, gidKey)) return map[gidKey];
    }
    return undefined;
  }

  // ─── 7. VARIANT DETECTION ─────────────────────────────────────────────────
  function getVariantIdFromUrl() {
    try { return new URL(window.location.href).searchParams.get("variant") || null; } catch (e) { return null; }
  }
  function getVariantIdFromHiddenInput() {
    var inp = document.querySelector('form[action*="/cart/add"] input[name="id"]') ||
              document.querySelector('form[id^="product-form"] input[name="id"]')  ||
              document.querySelector('input[name="id"]');
    return inp && inp.value ? String(inp.value) : null;
  }
  function getVariantIdFromOptions() {
    if (!Array.isArray(variantsList) || !variantsList.length) return null;
    var form = document.querySelector('form[action*="/cart/add"]') ||
               document.querySelector('form[id^="product-form"]')  ||
               document.querySelector("form.product-form");
    if (!form) return null;
    var selects = Array.from(form.querySelectorAll('select[name^="options["]'));
    var opts = selects.length
      ? selects.map(function (s) { return s.value; })
      : (function () {
          var radios = Array.from(form.querySelectorAll('input[type="radio"][name^="options["]:checked'));
          if (!radios.length) return null;
          var names = [];
          Array.from(form.querySelectorAll('input[type="radio"][name^="options["]')).forEach(function (r) {
            if (names.indexOf(r.name) === -1) names.push(r.name);
          });
          return names.map(function (name) {
            var c = form.querySelector('input[type="radio"][name="' + CSS.escape(name) + '"]:checked');
            return c ? c.value : null;
          });
        })();
    if (!opts || !opts.length || opts.some(function (x) { return !x; })) return null;
    var found = variantsList.find(function (v) {
      if (!v || !Array.isArray(v.options) || v.options.length !== opts.length) return false;
      for (var i = 0; i < opts.length; i++) {
        if (String(v.options[i]) !== String(opts[i])) return false;
      }
      return true;
    });
    return found ? gidToNumeric(found.id) : null;
  }
  function getVariantIdFromCustomElement() {
    var vs = document.querySelector("variant-selects, variant-radios");
    if (!vs) return null;
    if (vs.selectedVariant && vs.selectedVariant.id) return gidToNumeric(String(vs.selectedVariant.id));
    if (vs.currentVariant  && vs.currentVariant.id)  return gidToNumeric(String(vs.currentVariant.id));
    return null;
  }
  function getSelectedVariantId() {
    return (
      getVariantIdFromCustomElement() ||
      getVariantIdFromOptions()       ||
      getVariantIdFromUrl()           ||
      getVariantIdFromHiddenInput()   ||
      (initialVariantId ? String(initialVariantId) : null)
    );
  }

  // ─── 8. SUPPRESSION (prevents observer storm after our own DOM changes) ──
  var _suppressUntil = 0;
  function suppress(ms) { _suppressUntil = Date.now() + (ms || 500); }
  function isSuppressed() { return Date.now() < _suppressUntil; }

  // ─── 9. CAROUSEL REFRESH HELPERS ─────────────────────────────────────────
  function refreshSwipers(root) {
    if (!root) root = document;
    try {
      root.querySelectorAll(".swiper, .swiper-container, swiper-container").forEach(function (el) {
        var sw = el.swiper;
        if (sw && typeof sw.update === "function") { sw.update(); }
      });
    } catch (e) {}
    try {
      if (window.jQuery) window.jQuery(root).find(".slick-initialized").slick("setPosition");
    } catch (e) {}
    try {
      if (window.Flickity && window.Flickity.data) {
        root.querySelectorAll(".flickity-enabled").forEach(function (el) {
          var f = window.Flickity.data(el);
          if (f) { f.resize(); f.reposition(); }
        });
      }
    } catch (e) {}
  }

  // ─── 10.5. SLIDESHOW COMPONENT THEME (Newer Horizon/Dawn variants) ───────
  function slideshowComponentGetNumericId(el) {
    var pm = el.querySelector(".product-media[data-media-id]");
    if (pm) return extractNumericTail(pm.getAttribute("data-media-id"));
    var btn = el.querySelector("button[data-media-id]");
    if (btn) return extractNumericTail(btn.getAttribute("data-media-id"));
    return extractNumericTail(el.getAttribute("data-media-id") || el.getAttribute("id"));
  }

  function slideshowComponentApply(allowedIdSet, allowedUrlSet) {
    var mg = document.querySelector("media-gallery");
    if (!mg) return false;
    var sComp = mg.querySelector("slideshow-component");
    if (!sComp) return false;

    var slides = Array.from(sComp.querySelectorAll("slideshow-slide"));
    if (!slides.length) return false;

    suppress(800);

    slides.forEach(function (slide, idx) {
      var mid = slideshowComponentGetNumericId(slide);
      var match = false;
      if (mid && allowedIdSet.has(mid)) match = true;
      if (!match) {
        var imgs = Array.from(slide.querySelectorAll("img"));
        for (var i = 0; i < imgs.length; i++) {
          if (getImgUrls(imgs[i]).some(function(u) { return allowedUrlSet.has(u); })) {
            match = true; break;
          }
        }
      }
      setHidden(slide, !match);
      var dot = sComp.querySelector('.slideshow-controls__dots li:nth-child(' + (idx + 1) + ')');
      if (dot) setHidden(dot, !match);
    });

    var gridItems = Array.from(mg.querySelectorAll(".media-gallery__grid > li"));
    gridItems.forEach(function (li) {
      var mid = slideshowComponentGetNumericId(li);
      var match = false;
      if (mid && allowedIdSet.has(mid)) match = true;
      if (!match) {
        var imgs = Array.from(li.querySelectorAll("img"));
        for (var i = 0; i < imgs.length; i++) {
          if (getImgUrls(imgs[i]).some(function(u) { return allowedUrlSet.has(u); })) {
            match = true; break;
          }
        }
      }
      setHidden(li, !match);
    });

    window.dispatchEvent(new Event("resize"));
    setTimeout(function () { window.dispatchEvent(new Event("resize")); }, 200);
    return true;
  }

  function slideshowComponentShowAll() {
    var mg = document.querySelector("media-gallery");
    if (!mg) return false;
    var sComp = mg.querySelector("slideshow-component");
    if (!sComp) return false;

    suppress(500);
    sComp.querySelectorAll("slideshow-slide").forEach(function (li) { setHidden(li, false); });
    sComp.querySelectorAll(".slideshow-controls__dots li").forEach(function (li) { setHidden(li, false); });
    mg.querySelectorAll(".media-gallery__grid > li").forEach(function (li) { setHidden(li, false); });
    
    window.dispatchEvent(new Event("resize"));
    return true;
  }

  // ─── 10. DAWN THEME ───────────────────────────────────────────────────────
  // Dawn uses <media-gallery> custom element.
  // Slides are `li.product__media-item` with id="Slide-gallery-{sectionId}-{mediaId}".
  // Thumbnail buttons have data-media-id="{sectionId}-{mediaId}".
  // We always extract the numeric TAIL after the last "-".

  function dawnGetNumericId(el) {
    // Try button[data-media-id] inside the element
    var btn = el.querySelector("button[data-media-id]");
    if (btn) {
      var tail = extractNumericTail(btn.getAttribute("data-media-id"));
      if (tail) return tail;
    }
    // Try element's own id (Slide-gallery-sectionId-mediaId)
    var tail2 = extractNumericTail(el.getAttribute("id"));
    if (tail2) return tail2;
    // Try element's own data-media-id
    var tail3 = extractNumericTail(el.getAttribute("data-media-id"));
    if (tail3) return tail3;
    return null;
  }

  function dawnApply(allowedIdSet) {
    var mg = document.querySelector("media-gallery");
    if (!mg) return false;
    // Guard: if Horizon elements exist, skip Dawn path
    if (document.querySelector("horizon-media")) return false;

    var slides = Array.from(mg.querySelectorAll(".product__media-list > li.product__media-item"));
    if (!slides.length) return false;

    suppress(800);

    slides.forEach(function (li) {
      var mid = dawnGetNumericId(li);
      setHidden(li, mid ? !allowedIdSet.has(mid) : false);
    });

    // Thumbnails
    var thumbs = Array.from(mg.querySelectorAll(
      ".thumbnail-list__item[data-target], .thumbnail-list__item[data-media-id]"
    ));
    thumbs.forEach(function (li) {
      var raw = li.getAttribute("data-target") || li.getAttribute("data-media-id") || "";
      var mid = extractNumericTail(raw);
      setHidden(li, mid ? !allowedIdSet.has(mid) : false);
    });

    // If active slide is now hidden → activate first allowed one
    var active = mg.querySelector(".product__media-item.is-active, .product__media-item[aria-current]");
    if (!active || active.classList.contains("vmf-hidden")) {
      var firstId = null;
      allowedIdSet.forEach(function (id) { if (!firstId) firstId = id; });
      if (firstId) {
        // Try Dawn's own API first
        if (typeof mg.setActiveMedia === "function") {
          // Find the full data-media-id that ends with our numeric id
          var fullId = null;
          thumbs.forEach(function (li) {
            var raw = li.getAttribute("data-target") || li.getAttribute("data-media-id") || "";
            if (extractNumericTail(raw) === firstId) fullId = raw;
          });
          try { mg.setActiveMedia(fullId || firstId, true); } catch (e) {}
        } else {
          var firstVisibleThumb = thumbs.find(function (li) { return !li.classList.contains("vmf-hidden"); });
          if (firstVisibleThumb) {
            var b = firstVisibleThumb.querySelector("button");
            if (b) { try { b.click(); } catch (e) {} }
          }
        }
      }
    }

    // Hide prev/next arrows when only one slide
    var visible = slides.filter(function (li) { return !li.classList.contains("vmf-hidden"); }).length;
    mg.querySelectorAll(".slider-buttons .slider-button--prev, .slider-buttons .slider-button--next," +
                        ".thumbnail-slider .slider-button--prev, .thumbnail-slider .slider-button--next")
      .forEach(function (btn) { setHidden(btn, visible <= 1); });

    window.dispatchEvent(new Event("resize"));
    setTimeout(function () { window.dispatchEvent(new Event("resize")); }, 200);
    return true;
  }

  function dawnShowAll() {
    var mg = document.querySelector("media-gallery");
    if (!mg || document.querySelector("horizon-media")) return false;
    var slides = Array.from(mg.querySelectorAll(".product__media-list > li.product__media-item"));
    if (!slides.length) return false;
    suppress(500);
    slides.forEach(function (li) { setHidden(li, false); });
    mg.querySelectorAll(".thumbnail-list__item").forEach(function (li) { setHidden(li, false); });
    mg.querySelectorAll(".slider-button--prev, .slider-button--next").forEach(function (b) { setHidden(b, false); });
    window.dispatchEvent(new Event("resize"));
    return true;
  }

  // ─── 11. HORIZON THEME ────────────────────────────────────────────────────
  // Horizon uses <horizon-media> custom elements inside <swiper-slide> (or <li>).
  // We MUST hide the swiper-slide wrapper — hiding just horizon-media leaves an
  // empty slide in the carousel that Swiper still counts and renders.

  function horizonGetSlideWrapper(el) {
    // Walk up from horizon-media to find its slide container
    return el.closest("swiper-slide") ||
           el.closest("li.product__media-item") ||
           el.closest("li") ||
           el.parentElement ||
           el;
  }

  function horizonGetNumericId(el) {
    // horizon-media may carry data-media-id="12345" or "sectionId-12345"
    var tail = extractNumericTail(el.getAttribute("data-media-id") || el.getAttribute("id") || "");
    return tail;
  }

  function horizonApply(allowedIdSet, allowedUrlSet) {
    var horizonEls = Array.from(document.querySelectorAll("horizon-media"));
    if (!horizonEls.length) return false;

    suppress(800);

    horizonEls.forEach(function (el) {
      var mid = horizonGetNumericId(el);
      var matchById  = mid && allowedIdSet.has(mid);
      var matchByUrl = false;

      if (!matchById) {
        var imgs = Array.from(el.querySelectorAll("img"));
        outer: for (var i = 0; i < imgs.length; i++) {
          var urls = getImgUrls(imgs[i]);
          for (var j = 0; j < urls.length; j++) {
            if (allowedUrlSet.has(urls[j])) { matchByUrl = true; break outer; }
          }
        }
      }

      // Hide the slide wrapper so Swiper removes it from layout
      var wrapper = horizonGetSlideWrapper(el);
      setHidden(wrapper, !(matchById || matchByUrl));
    });

    // Thumbnails (if any)
    var scope = document.querySelector("media-gallery") ||
                document.querySelector(".product__media-wrapper") ||
                document;
    Array.from(scope.querySelectorAll(
      ".thumbnail-list__item[data-target], .thumbnail-list__item[data-media-id], " +
      ".thumbnail[data-media-id], .product-gallery__thumbnail[data-media-id]"
    )).forEach(function (li) {
      var raw = li.getAttribute("data-target") || li.getAttribute("data-media-id") || "";
      var mid = extractNumericTail(raw);
      var matchById  = mid && allowedIdSet.has(mid);
      var matchByUrl = false;
      if (!matchById) {
        var imgs = Array.from(li.querySelectorAll("img"));
        outer2: for (var i = 0; i < imgs.length; i++) {
          var urls = getImgUrls(imgs[i]);
          for (var j = 0; j < urls.length; j++) {
            if (allowedUrlSet.has(urls[j])) { matchByUrl = true; break outer2; }
          }
        }
      }
      setHidden(li, !(matchById || matchByUrl));
    });

    // Tell Swiper to recalculate after we hid slides
    setTimeout(function () { refreshSwipers(document); }, 50);
    window.dispatchEvent(new Event("resize"));
    setTimeout(function () { window.dispatchEvent(new Event("resize")); }, 200);
    return true;
  }

  function horizonShowAll() {
    var horizonEls = Array.from(document.querySelectorAll("horizon-media"));
    if (!horizonEls.length) return false;
    suppress(500);
    horizonEls.forEach(function (el) {
      setHidden(horizonGetSlideWrapper(el), false);
    });
    var scope = document.querySelector("media-gallery") ||
                document.querySelector(".product__media-wrapper") || document;
    scope.querySelectorAll(".thumbnail-list__item, .thumbnail, .product-gallery__thumbnail")
         .forEach(function (li) { setHidden(li, false); });
    setTimeout(function () { refreshSwipers(document); }, 50);
    window.dispatchEvent(new Event("resize"));
    return true;
  }

  // ─── 12. CORANO THEME ─────────────────────────────────────────────────────
  function coranoGetSlides() {
    var track = document.querySelector("[data-gallery-track], .product-gallery__track");
    return track ? Array.from(track.querySelectorAll("[data-slide], .product-gallery__image")) : [];
  }
  function coranoGetNav() {
    return {
      prev: document.querySelector("[data-prev]"),
      next: document.querySelector("[data-next]"),
    };
  }
  function coranoApply(allowedUrlSet) {
    var slides = coranoGetSlides();
    if (!slides.length) return false;
    suppress(800);
    slides.forEach(function (s) {
      var imgs = Array.from(s.querySelectorAll("img"));
      var matched = imgs.some(function (img) {
        return getImgUrls(img).some(function (u) { return allowedUrlSet.has(u); });
      });
      if (imgs.length) setHidden(s, !matched);
    });
    var visible = slides.filter(function (s) { return !s.classList.contains("vmf-hidden"); });
    if (!visible.length) { slides.forEach(function (s) { setHidden(s, false); }); }
    var nav = coranoGetNav();
    if (nav.prev) setHidden(nav.prev, visible.length <= 1);
    if (nav.next) setHidden(nav.next, visible.length <= 1);
    refreshSwipers(document);
    window.dispatchEvent(new Event("resize"));
    return true;
  }
  function coranoShowAll() {
    var slides = coranoGetSlides();
    if (!slides.length) return false;
    suppress(500);
    slides.forEach(function (s) { setHidden(s, false); });
    var nav = coranoGetNav();
    if (nav.prev) setHidden(nav.prev, false);
    if (nav.next) setHidden(nav.next, false);
    refreshSwipers(document);
    window.dispatchEvent(new Event("resize"));
    return true;
  }

  // ─── 13. UNIVERSAL URL FALLBACK ───────────────────────────────────────────
  function universalApply(allowedUrlSet) {
    var imgs = Array.from(document.querySelectorAll("img")).filter(function (img) {
      return getImgUrls(img).some(function (u) { return allMediaUrls.has(u); });
    });
    imgs.forEach(function (img) {
      var matched = getImgUrls(img).some(function (u) { return allowedUrlSet.has(u); });
      var wrapper =
        img.closest("horizon-media")        ||
        img.closest("swiper-slide")         ||
        img.closest(".swiper-slide")        ||
        img.closest(".slick-slide")         ||
        img.closest("li.product__media-item") ||
        img.closest("li")                   ||
        img.closest("figure")               ||
        img.closest("div")                  ||
        img;
      setHidden(wrapper, !matched);
    });
    refreshSwipers(document);
    window.dispatchEvent(new Event("resize"));
  }

  // ─── 14. SHOW ALL ─────────────────────────────────────────────────────────
  function showAll() {
    if (slideshowComponentShowAll()) return;
    if (horizonShowAll()) return;
    if (dawnShowAll())   return;
    if (coranoShowAll()) return;
    document.querySelectorAll(".vmf-hidden").forEach(function (n) { setHidden(n, false); });
    refreshSwipers(document);
    window.dispatchEvent(new Event("resize"));
  }

  // ─── 15. MASTER FILTER LOGIC ─────────────────────────────────────────────
  var _lastAppliedVariant = null;

  function filterForVariant(variantId, force) {
    if (!variantId) return;
    if (!force && _lastAppliedVariant === variantId) return;
    _lastAppliedVariant = variantId;

    var allowedIds = getMapEntryForVariant(variantId);
    if (!Array.isArray(allowedIds) || allowedIds.length === 0) {
      showAll();
      return;
    }

    // Build allowed set of numeric-string IDs
    var allowedIdSet = new Set(allowedIds.map(toNumericIdString).filter(Boolean));

    // Build allowed URL set
    var allowedUrls = [];
    allowedIdSet.forEach(function (id) {
      var url = mediaIdToUrl.get(Number(id));
      if (url) allowedUrls.push(url);
    });
    var allowedUrlSet = new Set(allowedUrls);

    // Priority: SlideshowComponent → Horizon → Dawn → Corano → Universal
    if (document.querySelector("slideshow-component")) {
      if (slideshowComponentApply(allowedIdSet, allowedUrlSet)) return;
    }
    if (document.querySelector("horizon-media")) {
      horizonApply(allowedIdSet, allowedUrlSet);
      return;
    }
    if (dawnApply(allowedIdSet)) return;
    if (allowedUrlSet.size === 0) { showAll(); return; }
    if (coranoApply(allowedUrlSet)) return;
    universalApply(allowedUrlSet);
  }

  function apply(force) {
    if (isSuppressed()) return;
    var v = getSelectedVariantId();
    if (v) filterForVariant(v, !!force);
  }

  // ─── 16. CHANGE WATCHER ───────────────────────────────────────────────────
  function startWatcher() {
    if (window.__vmfWatcherStarted) return;
    window.__vmfWatcherStarted = true;

    function kick() {
      // Reset + apply at three increasing delays to catch async theme updates
      [80, 300, 700, 1300].forEach(function (ms) {
        setTimeout(function () { _lastAppliedVariant = null; apply(); }, ms);
      });
    }

    // Standard form change (selects, radios)
    document.body.addEventListener("change", function (e) {
      var t = e.target;
      if (t && (t.tagName === "SELECT" || t.type === "radio")) kick();
    });

    // Click-based swatches / labels
    document.addEventListener("click", function (e) {
      var t = e.target;
      if (t && t.closest(
        '.swatch, [data-value], label[for], input[type="radio"], ' +
        '.color-swatch, .option-selector, [data-option-value], .variant-input'
      )) kick();
    }, true);

    // Custom events fired by Horizon / Dawn / third-party apps
    ["variant:changed", "variantChange", "VARIANT_CHANGE",
     "product:variant-change", "bc-product:variant-change"].forEach(function (ev) {
      document.addEventListener(ev, function () { kick(); });
    });

    // Shopify Theme Editor live-preview reload
    document.addEventListener("shopify:section:load", function () {
      _lastAppliedVariant = null;
      setTimeout(function () { apply(true); }, 300);
    });

    // Watch variant-selects / variant-radios for attribute changes (Horizon)
    function observeVariantSelects() {
      var vs = document.querySelector("variant-selects, variant-radios");
      if (!vs || vs.__vmfObserved) return;
      vs.__vmfObserved = true;
      new MutationObserver(function () { kick(); })
        .observe(vs, { attributes: true, childList: false, subtree: false });
    }
    observeVariantSelects();

    // URL polling (pushState-based navigation, variant in URL)
    var _lastUrl = window.location.href;
    setInterval(function () {
      if (window.location.href !== _lastUrl) {
        _lastUrl = window.location.href;
        _lastAppliedVariant = null;
        apply();
      }
    }, 300);

    // Polling fallback (AJAX / JS-powered themes that don't fire events)
    setInterval(function () {
      if (isSuppressed()) return;
      var v = getSelectedVariantId();
      if (v && v !== _lastAppliedVariant) {
        _lastAppliedVariant = null;
        apply();
      }
    }, 400);
  }

  // ─── 17. MUTATION OBSERVER (gallery re-renders) ───────────────────────────
  // Fires when the theme re-renders the gallery DOM (section rendering API, AJAX, etc.)
  // We only re-apply if our suppression window has expired (i.e., it wasn't US who changed the DOM)
  function observeGallery() {
    var root =
      document.querySelector("media-gallery")         ||
      document.querySelector(".product__media-wrapper") ||
      document.querySelector(".product-media-container")||
      document.body;

    var _pending = null;
    new MutationObserver(function () {
      if (isSuppressed()) return; // Our own DOM changes — ignore
      clearTimeout(_pending);
      _pending = setTimeout(function () {
        if (isSuppressed()) return;
        _lastAppliedVariant = null;
        apply();
      }, 200);
    }).observe(root, { childList: true, subtree: true });
  }

  // ─── 18. BOOT ─────────────────────────────────────────────────────────────
  function boot() {
    _lastAppliedVariant = null;
    apply();
    // Retry to catch lazy-loaded images / late-initializing galleries
    [400, 900, 1800, 3000].forEach(function (ms) {
      setTimeout(function () { _lastAppliedVariant = null; apply(); }, ms);
    });
    startWatcher();
    observeGallery();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

})();
