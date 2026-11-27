/* Jidi Bio — static catalog interactions: instant search, pack selection, inquiry routing. */
(function () {
  "use strict";

  var WA_NUMBER = "8615866781826";
  var EMAIL = "info@jidi.com";
  var CATALOG = window.JIDI_CATALOG || { products: [], categories: [] };

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function norm(value) {
    return String(value == null ? "" : value).toLowerCase().replace(/[^a-z0-9]+/g, "");
  }
  function money(value) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value));
  }
  function packLabel(pack) {
    return "10 × " + pack.mg + " mg vials";
  }
  function productUrl(p) { return "/products/" + p.slug + ".html"; }
  function clean(s) { return String(s == null ? "" : s).replace(/\s+/g, " ").trim(); }

  function firstMatch(list, query) {
    var q = norm(query);
    if (!q) return [];
    return list.filter(function (p) {
      return norm(p.searchText).indexOf(q) !== -1;
    });
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (e) { /* fall through */ }
    try {
      var area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.left = "-9999px";
      document.body.appendChild(area);
      area.select();
      var ok = document.execCommand("copy");
      document.body.removeChild(area);
      return ok;
    } catch (e2) { return false; }
  }

  function flashButton(btn, text) {
    if (!btn) return;
    var old = btn.getAttribute("data-original-label") || btn.textContent;
    btn.setAttribute("data-original-label", old);
    btn.textContent = text;
    btn.disabled = true;
    window.setTimeout(function () {
      btn.textContent = old;
      btn.disabled = false;
    }, 1800);
  }

  /* --------------------------------------------------------------- mobile nav */
  var toggle = $(".menu-toggle");
  var nav = $("#site-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.getAttribute("data-open") === "true";
      nav.setAttribute("data-open", open ? "false" : "true");
      toggle.setAttribute("aria-expanded", open ? "false" : "true");
    });
    $$("a", nav).forEach(function (a) {
      a.addEventListener("click", function () {
        nav.setAttribute("data-open", "false");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        nav.setAttribute("data-open", "false");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* --------------------------------------------------------------- home search */
  var homeForm = $("[data-home-search]");
  if (homeForm) {
    var homeInput = $("input[name='q']", homeForm);
    var homeResults = $("[data-home-results]", homeForm);
    var timer = null;

    function hideResults() {
      if (homeResults) homeResults.hidden = true;
    }

    function renderResults() {
      if (!homeResults) return;
      var q = homeInput ? homeInput.value.trim() : "";
      if (!q) { hideResults(); return; }
      var matches = firstMatch(CATALOG.products, q).slice(0, 6);
      homeResults.textContent = "";
      if (!matches.length) {
        var empty = document.createElement("div");
        empty.className = "quick-empty";
        empty.textContent = "No catalog match. Try a CAS number, peptide name, formula, or category.";
        homeResults.appendChild(empty);
      } else {
        matches.forEach(function (p) {
          var a = document.createElement("a");
          a.className = "quick-result";
          a.href = productUrl(p);
          var left = document.createElement("div");
          var name = document.createElement("strong");
          name.textContent = p.name;
          var meta = document.createElement("span");
          meta.textContent = (p.cas && p.cas.indexOf("Not ") !== 0 ? "CAS " + p.cas + " · " : "") + p.formula;
          left.appendChild(name);
          left.appendChild(meta);
          var right = document.createElement("em");
          right.textContent = p.categoryName;
          a.appendChild(left);
          a.appendChild(right);
          homeResults.appendChild(a);
        });
        var all = document.createElement("a");
        all.className = "quick-result-all";
        all.href = "/products/?q=" + encodeURIComponent(q);
        all.textContent = "View all " + firstMatch(CATALOG.products, q).length + " matching catalog entries →";
        homeResults.appendChild(all);
      }
      homeResults.hidden = false;
    }

    if (homeInput) {
      homeInput.addEventListener("input", function () {
        window.clearTimeout(timer);
        timer = window.setTimeout(renderResults, 80);
      });
      homeInput.addEventListener("keydown", function (e) {
        if (e.key === "Escape") hideResults();
      });
    }
    document.addEventListener("click", function (e) {
      if (!homeForm.contains(e.target)) hideResults();
    });
  }

  /* ------------------------------------------------------------ catalog filter */
  var catalogPage = $("[data-catalog-page]");
  if (catalogPage) {
    var input = $("#catalog-search");
    var tbody = $("#catalog-rows");
    var countEl = $("[data-catalog-count]");
    var emptyEl = $("[data-catalog-empty]");
    var sortEl = $("#catalog-sort");
    var chips = $$("[data-filter-category]");
    var clearBtn = $("[data-clear-filters]");
    var rows = tbody ? $$("tr", tbody) : [];
    var activeCategory = "all";
    var total = rows.length;

    function readUrl() {
      var params = new URLSearchParams(window.location.search);
      if (input && params.get("q")) input.value = params.get("q");
      var cat = params.get("category");
      if (cat && chips.some(function (c) { return c.getAttribute("data-filter-category") === cat; })) {
        activeCategory = cat;
      }
    }

    function writeUrl() {
      if (!window.history || !window.history.replaceState) return;
      var params = new URLSearchParams();
      if (input && input.value.trim()) params.set("q", input.value.trim());
      if (activeCategory !== "all") params.set("category", activeCategory);
      var qs = params.toString();
      window.history.replaceState(null, "", window.location.pathname + (qs ? "?" + qs : "") + window.location.hash);
    }

    function terms(q) {
      return q.toLowerCase().split(/\s+/).map(norm).filter(Boolean);
    }

    function rowMatches(row, ts) {
      if (!ts.length) return true;
      var hay = norm(row.getAttribute("data-search") || "");
      return ts.every(function (t) { return hay.indexOf(t) !== -1; });
    }

    function applyFilters() {
      var ts = terms(input ? input.value : "");
      var visible = 0;
      rows.forEach(function (row) {
        var catOk = activeCategory === "all" || row.getAttribute("data-category") === activeCategory;
        var show = catOk && rowMatches(row, ts);
        row.hidden = !show;
        if (show) visible += 1;
      });
      if (countEl) {
        countEl.innerHTML = "Showing <strong>" + visible + "</strong> of <strong>" + total + "</strong> catalog entries";
      }
      if (emptyEl) emptyEl.classList.toggle("visible", visible === 0);
      chips.forEach(function (chip) {
        var on = chip.getAttribute("data-filter-category") === activeCategory;
        chip.setAttribute("aria-pressed", on ? "true" : "false");
        chip.classList.toggle("active", on);
      });
      writeUrl();
    }

    function sortRows() {
      if (!sortEl || !tbody) return;
      var mode = sortEl.value;
      var sorted = rows.slice().sort(function (a, b) {
        var an = a.getAttribute("data-name") || "";
        var bn = b.getAttribute("data-name") || "";
        var ap = Number(a.getAttribute("data-price") || 0);
        var bp = Number(b.getAttribute("data-price") || 0);
        if (mode === "catalog") return (a.getAttribute("data-catalog") || "").localeCompare(b.getAttribute("data-catalog") || "");
        if (mode === "price-asc") return ap - bp || an.localeCompare(bn);
        if (mode === "price-desc") return bp - ap || an.localeCompare(bn);
        if (mode === "cas") return (a.getAttribute("data-cas") || "").localeCompare(b.getAttribute("data-cas") || "") || an.localeCompare(bn);
        return an.localeCompare(bn);
      });
      sorted.forEach(function (row) { tbody.appendChild(row); });
    }

    readUrl();
    if (input) input.addEventListener("input", applyFilters);
    chips.forEach(function (chip) {
      chip.addEventListener("click", function (e) {
        e.preventDefault();
        activeCategory = chip.getAttribute("data-filter-category");
        applyFilters();
      });
    });
    if (clearBtn) {
      clearBtn.addEventListener("click", function (e) {
        e.preventDefault();
        if (input) input.value = "";
        activeCategory = "all";
        applyFilters();
        if (input) input.focus();
      });
    }
    if (sortEl) sortEl.addEventListener("change", sortRows);
    applyFilters();
    if (sortEl) sortRows();
  }

  /* ------------------------------------------------------- product pack + CTA */
  var buy = $("[data-buy]");
  var productDataEl = $("#product-json");
  if (buy && productDataEl) {
    var product;
    try { product = JSON.parse(productDataEl.textContent); } catch (e) { product = null; }
    if (product && product.packs && product.packs.length) {
      var state = { index: 0, qty: 1, request: "Standard catalog pack", notes: "" };
      var packInputs = $$("input[name='pack']", buy);
      var priceEl = $("[data-buy-price]", buy);
      var perVialEl = $("[data-buy-per-vial]", buy);
      var skuEl = $("[data-buy-sku]", buy);
      var priceNoteEl = $("[data-buy-price-note]", buy);
      var qtyInput = $("[data-qty]", buy);
      var reqSelect = $("[data-request-type]", buy);
      var notesInput = $("[data-notes]", buy);
      var waLink = $("[data-wa-link]", buy);
      var mailLink = $("[data-mail-link]", buy);
      var copyBtn = $("[data-copy-inquiry]", buy);
      var preview = $("[data-inquiry-preview]", buy);

      function selectedPack() { return product.packs[state.index] || product.packs[0]; }
      function inquiryText() {
        var pack = selectedPack();
        var lines = [
          "Jidi Bio — research reagent inquiry",
          "Product: " + product.name,
          "CAS: " + product.cas,
          "Catalog no.: " + product.catalog,
          "Pack: 10 × " + pack.mg + " mg vials" + (pack.ratio ? " (" + pack.ratio + " mg components)" : ""),
          "Pack SKU: " + pack.sku,
          "Quantity: " + state.qty + " pack" + (state.qty === 1 ? "" : "s"),
          "Request type: " + state.request,
          "Indicative list price: " + money(pack.price) + " per pack (subject to confirmation)"
        ];
        if (state.notes) lines.push("Notes: " + state.notes);
        lines.push("Product page: " + product.url);
        return lines.join("\n");
      }
      function updateLinks() {
        var text = inquiryText();
        var pack = selectedPack();
        if (priceEl) priceEl.textContent = money(pack.price);
        if (perVialEl) perVialEl.textContent = money(pack.price / 10) + " / vial";
        if (skuEl) skuEl.textContent = pack.sku;
        if (priceNoteEl) priceNoteEl.textContent = "Pack: 10 × " + pack.mg + " mg vials" + (pack.ratio ? " (" + pack.ratio + " mg)" : "");
        if (waLink) waLink.href = "https://wa.me/" + WA_NUMBER + "?text=" + encodeURIComponent(text);
        if (mailLink) {
          var subject = "Research reagent inquiry — " + product.name + " (" + product.cas + ")";
          mailLink.href = "mailto:" + EMAIL + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(text);
        }
        if (preview) preview.textContent = text;
      }
      function selectPack(index) {
        state.index = Math.max(0, Math.min(index, product.packs.length - 1));
        packInputs.forEach(function (input) {
          var on = Number(input.value) === state.index;
          input.checked = on;
          var label = input.closest(".pack-option");
          if (label) label.classList.toggle("selected", on);
        });
        updateLinks();
      }

      packInputs.forEach(function (input) {
        input.addEventListener("change", function () { selectPack(Number(input.value)); });
      });
      qtyInput && qtyInput.addEventListener("input", function () {
        state.qty = Math.max(1, Math.min(9999, parseInt(qtyInput.value, 10) || 1));
        qtyInput.value = state.qty;
        updateLinks();
      });
      reqSelect && reqSelect.addEventListener("change", function () {
        state.request = reqSelect.value;
        updateLinks();
      });
      notesInput && notesInput.addEventListener("input", function () {
        state.notes = clean(notesInput.value);
        updateLinks();
      });
      if (copyBtn) {
        copyBtn.addEventListener("click", async function () {
          var ok = await copyText(inquiryText());
          flashButton(copyBtn, ok ? "Inquiry copied" : "Copy failed");
        });
      }
      var customTrigger = $("[data-choose-custom]", buy);
      if (customTrigger && reqSelect) {
        customTrigger.addEventListener("click", function (e) {
          e.preventDefault();
          reqSelect.value = "Custom synthesis / bulk quote";
          state.request = reqSelect.value;
          updateLinks();
          reqSelect.focus();
        });
      }
      selectPack(0);
    }
  }

  /* ------------------------------------------------------------- inquiry forms */
  function formValue(form, name) {
    var el = form.elements[name];
    if (!el) return "";
    if (typeof RadioNodeList !== "undefined" && el instanceof RadioNodeList) return el.value;
    return String(el.value || "").trim();
  }
  function formChecks(form, name) {
    return $$("input[name='" + name + "']:checked", form).map(function (el) { return el.value; });
  }

  var forms = $$("[data-inquiry-form]");
  forms.forEach(function (form) {
    var mode = form.getAttribute("data-mode") || "custom";
    var wa = $("[data-form-wa]", form);
    var mail = $("[data-form-mail]", form);
    var copy = $("[data-form-copy]", form);
    var preview = $("[data-form-preview]", form);
    var status = $("[data-form-status]", form);

    function message() {
      var lines = [];
      if (mode === "contact") {
        lines.push("Jidi Bio — general inquiry");
      } else {
        lines.push("Jidi Bio — custom synthesis / bulk inquiry");
      }
      var name = formValue(form, "name");
      var email = formValue(form, "email");
      var company = formValue(form, "company");
      var country = formValue(form, "country");
      var phone = formValue(form, "phone");
      var interest = formValue(form, "interest");
      var request = formValue(form, "requestType");
      var quantity = formValue(form, "quantity");
      var sequence = formValue(form, "sequence");
      var purity = formValue(form, "purity");
      var notes = formValue(form, "message");
      var checks = formChecks(form, "modification");
      if (name) lines.push("Name: " + name);
      if (email) lines.push("Email: " + email);
      if (company) lines.push("Company / institution: " + company);
      if (country) lines.push("Country: " + country);
      if (phone) lines.push("Phone / WhatsApp: " + phone);
      if (interest) lines.push("Product / target: " + interest);
      if (request) lines.push("Request type: " + request);
      if (quantity) lines.push("Estimated quantity: " + quantity);
      if (sequence) lines.push("Sequence / length: " + sequence);
      if (purity) lines.push("Purity requirement: " + purity);
      if (checks.length) lines.push("Modifications: " + checks.join(", "));
      if (notes) lines.push("Notes: " + notes);
      lines.push("Page: " + window.location.href.split("#")[0]);
      return lines.join("\n");
    }

    function update() {
      var text = message();
      var subject = mode === "contact" ? "General research reagent inquiry — Jidi Bio" : "Custom peptide synthesis / bulk inquiry — Jidi Bio";
      if (wa) wa.href = "https://wa.me/" + WA_NUMBER + "?text=" + encodeURIComponent(text);
      if (mail) mail.href = "mailto:" + EMAIL + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(text);
      if (preview) preview.textContent = text;
    }

    form.addEventListener("input", update);
    form.addEventListener("change", update);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (wa) window.location.href = wa.href;
      if (status) {
        status.hidden = false;
        status.textContent = "Your inquiry summary has been prepared in WhatsApp. If WhatsApp does not open, use the email or copy buttons.";
      }
    });
    if (copy) {
      copy.addEventListener("click", async function () {
        var ok = await copyText(message());
        flashButton(copy, ok ? "Summary copied" : "Copy failed");
        if (status) {
          status.hidden = false;
          status.textContent = ok ? "Inquiry summary copied to your clipboard." : "Copy failed. Select the summary text manually.";
        }
      });
    }
    if (mode === "custom") {
      var params = new URLSearchParams(window.location.search);
      var requested = params.get("product");
      var interest = form.elements["interest"];
      if (requested && interest && !interest.value) {
        var match = CATALOG.products.filter(function (p) { return p.slug === requested; })[0];
        interest.value = match ? match.name + " (" + match.catalog + (match.cas.indexOf("Not ") === 0 ? "" : "; CAS " + match.cas) + ")" : requested;
      }
    }
    update();
  });

  /* ---------------------------------------------------------------- copy misc */
  $$("[data-copy-text]").forEach(function (btn) {
    btn.addEventListener("click", async function () {
      var text = btn.getAttribute("data-copy-text") || "";
      var ok = await copyText(text);
      flashButton(btn, ok ? "Copied" : "Copy failed");
    });
  });

  var yearEls = $$("[data-year]");
  yearEls.forEach(function (el) { el.textContent = String(new Date().getFullYear()); });
})();
