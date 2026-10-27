(function () {
  "use strict";

  var TYPE_DEFAULTS = {
    PLA: { min: 190, max: 240, print: 220, bed: 60 },
    "PLA+": { min: 200, max: 230, print: 220, bed: 60 },
    "PLA-CF": { min: 190, max: 240, print: 220, bed: 60 },
    PETG: { min: 220, max: 270, print: 240, bed: 80 },
    "PETG-CF": { min: 230, max: 270, print: 250, bed: 70 },
    "PETG-GF": { min: 240, max: 280, print: 260, bed: 70 },
    ABS: { min: 240, max: 280, print: 260, bed: 90 },
    ASA: { min: 240, max: 280, print: 260, bed: 90 },
    "ASA-CF": { min: 250, max: 280, print: 265, bed: 90 },
    TPU: { min: 200, max: 250, print: 220, bed: 35 },
    PA: { min: 250, max: 280, print: 260, bed: 70 },
    "PA-CF": { min: 270, max: 300, print: 280, bed: 90 },
    "PA6-CF": { min: 280, max: 320, print: 305, bed: 90 },
    "PAHT-CF": { min: 290, max: 320, print: 310, bed: 90 },
    "PA612-CF": { min: 280, max: 320, print: 305, bed: 90 },
    "PA12-CF": { min: 270, max: 310, print: 290, bed: 90 },
    "PA6-GF": { min: 250, max: 290, print: 270, bed: 80 },
    PC: { min: 250, max: 300, print: 260, bed: 100 },
    PVA: { min: 200, max: 230, print: 220, bed: 50 },
    BVOH: { min: 190, max: 220, print: 210, bed: 45 },
    HIPS: { min: 220, max: 250, print: 235, bed: 90 },
    PP: { min: 220, max: 250, print: 235, bed: 80 },
    "PP-CF": { min: 230, max: 260, print: 245, bed: 80 },
    PET: { min: 240, max: 280, print: 260, bed: 70 },
    "PET-CF": { min: 280, max: 320, print: 300, bed: 80 },
    PCTG: { min: 240, max: 280, print: 260, bed: 70 },
    PPS: { min: 320, max: 350, print: 335, bed: 100 },
    "PPS-CF": { min: 310, max: 340, print: 325, bed: 100 },
  };

  var ORIGIN_COPY = {
    database: "These temperatures come from Creality’s published material profile for this code: nozzle window, printing temperature, and hot-plate temperature. They are not written on the sticker.",
    reader: "The nozzle window is from Creality’s RFID material table. The printing temperature is the usual default for this code. None of these numbers are written on the sticker.",
    community: "This code is from a community CFS catalog, so a stock printer may not know it yet. The printing temperature is that catalog’s default. The low, high, and bed numbers are typical for the material.",
  };

  var mode = "mine";
  var mineSnapshot = null;
  var suggested = { min: true, max: true, print: true, bed: true };
  var latest = null;

  var $ = function (id) { return document.getElementById(id); };

  function todayISO() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function materialMap() {
    var map = {};
    window.CFS_MATERIALS.forEach(function (item) { map[item.code] = item; });
    return map;
  }

  var byCode = materialMap();

  function fillTypeSelect() {
    var types = Object.keys(TYPE_DEFAULTS);
    window.CFS_MATERIALS.forEach(function (item) {
      if (types.indexOf(item.type) === -1) types.push(item.type);
    });
    $("type").innerHTML = types.map(function (type) {
      return '<option value="' + type + '">' + type + "</option>";
    }).join("");
    $("type").value = "PETG";
  }

  function fillCatalog() {
    var groups = [
      ["database", "Creality material database"],
      ["reader", "Creality RFID table"],
      ["community", "Community CFS catalog"],
    ];
    $("catalog").innerHTML = groups.map(function (group) {
      var options = window.CFS_MATERIALS.filter(function (item) { return item.origin === group[0]; })
        .map(function (item) {
          return '<option value="' + item.code + '">' + item.code + " · " + item.brand + " " + item.name + "</option>";
        }).join("");
      return '<optgroup label="' + group[1] + '">' + options + "</optgroup>";
    }).join("");
  }

  function paintSwatches() {
    Array.prototype.forEach.call(document.querySelectorAll("#swatches button"), function (button) {
      button.style.background = button.getAttribute("data-color");
    });
  }

  function setColor(hex) {
    var clean = String(hex || "").replace("#", "").trim();
    if (!/^[0-9a-fA-F]{6}$/.test(clean)) return;
    clean = clean.toUpperCase();
    $("hex").value = clean;
    $("color").value = "#" + clean;
  }

  function readTemps() {
    return {
      min: Number($("temp-min").value),
      max: Number($("temp-max").value),
      print: Number($("temp-print").value),
      bed: Number($("temp-bed").value),
    };
  }

  function writeTemps(temps) {
    $("temp-min").value = temps.min;
    $("temp-max").value = temps.max;
    $("temp-print").value = temps.print;
    $("temp-bed").value = temps.bed;
  }

  function applyTypeDefaults() {
    var defaults = TYPE_DEFAULTS[$("type").value];
    if (!defaults) return;
    var next = readTemps();
    if (suggested.min) next.min = defaults.min;
    if (suggested.max) next.max = defaults.max;
    if (suggested.print) next.print = defaults.print;
    if (suggested.bed) next.bed = defaults.bed;
    writeTemps(next);
  }

  function lengthCode() {
    if ($("weight").value === "custom") {
      var meters = Math.round(Number($("meters").value));
      if (!meters || meters < 1 || meters > 9999) return "";
      return String(meters).padStart(4, "0");
    }
    return window.CfsTag.lengthForGrams($("weight").value);
  }

  function knownLength(code) {
    return code === "0080" || code === "0165" || code === "0330";
  }

  function textOn(hex) {
    var n = parseInt(hex, 16);
    var y = ((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114;
    return y > 150 ? "#1c1915" : "#fffaf3";
  }

  function quote(value) {
    return '"' + String(value || "").replace(/["\\]/g, "") + '"';
  }

  function notesJson() {
    return JSON.stringify({
      id: $("code").value.trim().toUpperCase(),
      vendor: $("brand").value.trim(),
      type: $("type").value,
      name: $("product").value.trim(),
    });
  }

  function mapCommand() {
    return "_BOX_RFID_MAP_SET CODE=" + $("code").value.trim().toUpperCase() +
      " MATERIAL=" + $("type").value +
      " BRAND=" + quote($("brand").value.trim()) +
      " NAME=" + quote($("product").value.trim()) +
      " TARGET_TEMP=" + $("temp-print").value;
  }

  function tempErrors() {
    var temps = readTemps();
    var errors = [];
    ["min", "max", "print", "bed"].forEach(function (key) {
      if (!Number.isFinite(temps[key])) errors.push("Enter all four temperatures.");
    });
    if (errors.length) return errors;
    if (temps.min > temps.print || temps.print > temps.max) {
      errors.push("Printing temperature has to sit between the low and high nozzle temperatures.");
    }
    return errors;
  }

  function chip(label, value, extra) {
    var style = extra || "";
    return '<div class="chip" style="' + style + '"><b>' + value + "</b><small>" + label + "</small></div>";
  }

  function setLocked(locked) {
    ["brand", "product", "type", "code", "suggest-code", "temp-min", "temp-max", "temp-print", "temp-bed"].forEach(function (id) {
      $(id).disabled = locked;
    });
  }

  function applyCatalog(code) {
    var item = byCode[code];
    if (!item) return;
    $("brand").value = item.brand;
    $("product").value = item.name;
    $("type").value = item.type;
    $("code").value = item.code;
    writeTemps(item);
    if (!$("supplier").dataset.touched) {
      $("supplier").value = item.brand === "Creality" ? "0276" : "0000";
    }
  }

  function snapshotMine() {
    mineSnapshot = {
      brand: $("brand").value,
      product: $("product").value,
      type: $("type").value,
      code: $("code").value,
      temps: readTemps(),
      suggested: Object.assign({}, suggested),
    };
  }

  function restoreMine() {
    if (!mineSnapshot) return;
    $("brand").value = mineSnapshot.brand;
    $("product").value = mineSnapshot.product;
    $("type").value = mineSnapshot.type;
    $("code").value = mineSnapshot.code;
    writeTemps(mineSnapshot.temps);
    suggested = mineSnapshot.suggested;
  }

  function setMode(next) {
    if (next === mode) return;
    if (next === "catalog") snapshotMine();
    mode = next;
    $("tab-mine").setAttribute("aria-selected", mode === "mine" ? "true" : "false");
    $("tab-catalog").setAttribute("aria-selected", mode === "catalog" ? "true" : "false");
    $("catalog-fields").hidden = mode !== "catalog";
    setLocked(mode === "catalog");
    if (mode === "catalog") applyCatalog($("catalog").value);
    else restoreMine();
    render();
  }

  function weightLabel(code) {
    var grams = window.CfsTag.gramsForLength(code);
    if (grams === 1000) return "1 kg";
    if (grams) return grams + " g";
    return String(Number(code)) + " m";
  }

  function render() {
    var length = lengthCode();
    var tag = window.CfsTag.build({
      batch: $("batch").value,
      date: $("date").value,
      supplier: $("supplier").value,
      material: $("code").value,
      color: $("hex").value,
      length: length,
      serial: $("serial").value,
    });
    var errors = tag.errors.concat(tempErrors());
    var known = byCode[$("code").value.trim().toUpperCase()];
    var temps = readTemps();
    latest = { tag: tag, errors: errors, known: known, length: length };

    var color = /^[0-9A-F]{6}$/.test(tag.fields.color) ? tag.fields.color : "2F6FED";
    $("filament").style.background = "#" + color;
    $("slot-brand").textContent = $("brand").value.trim() || "Brand";
    $("slot-name").textContent = $("product").value.trim() || "Filament";
    $("facts").innerHTML = [
      $("type").value,
      weightLabel(length || "0000"),
      temps.print + "°C print",
      temps.min + "–" + temps.max + "°C",
      "bed " + temps.bed + "°C",
    ].map(function (fact) { return "<span>" + fact + "</span>"; }).join("");

    var status = "";
    if (errors.length) {
      status = '<div class="callout bad">' + errors.map(escapeHtml).join("<br>") + "</div>";
    } else if (mode === "catalog" && known && known.origin === "community") {
      status = '<div class="callout warn">' + escapeHtml(known.brand + " " + known.name) + " uses code " + known.code + " in a community catalog. A stock CFS ignores that code until you add it. Color still comes from the sticker.</div>";
    } else if (mode === "catalog" && known) {
      status = '<div class="callout good">' + escapeHtml(known.brand + " " + known.name) + " is code " + known.code + ". A CFS that already has this code fills the slot from its own list and takes the color from the sticker.</div>";
    } else if (known) {
      var mismatch = known.min !== temps.min || known.max !== temps.max || known.print !== temps.print || known.bed !== temps.bed;
      status = '<div class="callout ' + (mismatch ? "warn" : "good") + '">Code ' + known.code + " is already " + escapeHtml(known.brand + " " + known.name) +
        (mismatch ? ". The printer will use its saved temperatures for that code, not the numbers typed here." : ". The typed temperatures match that saved profile.") +
        "</div>";
    } else {
      status = '<div class="callout warn">Code ' + escapeHtml($("code").value.trim().toUpperCase()) + " is not in the Creality list. The sticker is valid, and the CFS will ignore it until the printer has this code.</div>";
    }
    var lengthNote = "";
    if ($("weight").value === "custom" && length && !knownLength(length)) {
      lengthNote = "The CFS only maps 80 m, 165 m, and 330 m to 250 g, 500 g, and 1 kg. Any other length is reported as 1 kg.";
    } else if ($("weight").value !== "custom") {
      lengthNote = "Those three lengths are the ones a CFS turns into a spool weight.";
    }
    $("length-note").textContent = lengthNote;
    $("status").innerHTML = status;

    if (mode === "catalog" && known) $("temp-source").textContent = ORIGIN_COPY[known.origin];
    else if (known) $("temp-source").textContent = ORIGIN_COPY[known.origin];
    else $("temp-source").textContent = "These temperatures are for your printer profile. The sticker cannot store them. Changing type fills a suggested window until you edit a temperature yourself.";

    var fields = tag.fields;
    $("record").innerHTML = [
      chip("Batch", fields.batch || "—"),
      chip("Date", fields.date || "—"),
      chip("Vendor", fields.supplier || "—"),
      chip("Code", fields.material || "—"),
      chip("Color", "#" + (fields.color || "——————"), "background:#" + color + ";color:" + textOn(color)),
      chip("Meters", fields.length || "—"),
      chip("Serial", fields.serial || "—"),
    ].join("");

    $("payload").textContent = tag.ok ? tag.payload : "Fix the fields above to build the 48-character record.";
    $("blocks").textContent = tag.ok
      ? tag.blocks.map(function (block) {
          return "Block " + block.block + "  " + block.hex;
        }).join("\n")
      : "—";
    $("notes").textContent = notesJson();
    $("map-command").textContent = mapCommand();
    $("setup-lead").textContent = known && known.origin !== "community"
      ? "No extra printer setup if this code is already on your CFS. To force your own name and temperatures, give the spool a new code and add the notes below to that filament in Creality Print or OrcaSlicer."
      : "Put this in the Notes field of the filament profile, then sync that profile to the printer. The id has to match the material code on the sticker.";

    ["copy-record", "copy-blocks", "download"].forEach(function (id) {
      $(id).disabled = !tag.ok;
    });
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
    });
  }

  function copyText(text, button) {
    var original = button.textContent;
    function done() {
      button.textContent = "Copied";
      setTimeout(function () { button.textContent = original; }, 1200);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(function () { fallback(text); done(); });
    } else {
      fallback(text);
      done();
    }
  }

  function fallback(text) {
    var area = document.createElement("textarea");
    area.value = text;
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }

  function blockSheet() {
    var tag = latest.tag;
    return [
      "Creality CFS sticker",
      $("brand").value.trim() + " " + $("product").value.trim(),
      "Code " + $("code").value.trim().toUpperCase(),
      "Color #" + tag.fields.color,
      "Length " + tag.fields.length + " m",
      "",
      tag.payload,
      "",
      tag.blocks.map(function (block) { return "Block " + block.block + ": " + block.hex; }).join("\n"),
      "",
      "Sector 1 Key A: FFFFFFFFFFFF",
      "Write blocks 4, 5, and 6. Do not change the sector trailer.",
    ].join("\n");
  }

  function renderDecode() {
    var raw = $("decode-input").value.trim();
    if (!raw) {
      $("decode-result").innerHTML = "";
      return;
    }
    var decoded = window.CfsTag.decode(raw);
    if (!decoded.ok && decoded.payload == null) {
      $("decode-result").innerHTML = '<div class="callout bad">' + escapeHtml(decoded.errors.join(" ")) + "</div>";
      return;
    }
    var fields = decoded.fields;
    var known = fields ? byCode[fields.material] : null;
    var grams = fields ? window.CfsTag.gramsForLength(fields.length) : null;
    var lines = [
      "Record " + decoded.payload,
      "Date " + window.CfsTag.describeDate(fields.date),
      "Code " + fields.material + (known ? " · " + known.brand + " " + known.name : " · not in the list"),
      "Color #" + fields.color,
      "Length " + fields.length + " m" + (grams ? " · " + (grams === 1000 ? "1 kg" : grams + " g") : ""),
      "Vendor " + fields.supplier + " · batch " + fields.batch + " · serial " + fields.serial,
    ];
    var kind = decoded.errors.length ? "warn" : "good";
    var extra = decoded.errors.length ? "<br>" + decoded.errors.map(escapeHtml).join("<br>") : "";
    $("decode-result").innerHTML = '<div class="callout ' + kind + '">' + lines.map(escapeHtml).join("<br>") + extra + "</div>";
  }

  function suggestCode() {
    var used = {};
    window.CFS_MATERIALS.forEach(function (item) { used[item.code] = true; });
    var code = "90001";
    for (var n = 90001; n <= 99999; n += 1) {
      var candidate = String(n);
      if (!used[candidate]) {
        code = candidate;
        break;
      }
    }
    $("code").value = code;
    render();
  }

  $("date").value = todayISO();
  fillTypeSelect();
  fillCatalog();
  paintSwatches();
  $("meters-label").hidden = true;

  $("tab-mine").addEventListener("click", function () { setMode("mine"); });
  $("tab-catalog").addEventListener("click", function () { setMode("catalog"); });
  $("catalog").addEventListener("change", function () { applyCatalog($("catalog").value); render(); });
  $("form").addEventListener("submit", function (event) { event.preventDefault(); });
  $("form").addEventListener("input", render);
  $("type").addEventListener("change", function () {
    if (mode === "mine") applyTypeDefaults();
    render();
  });
  $("weight").addEventListener("change", function () {
    $("meters-label").hidden = $("weight").value !== "custom";
    render();
  });
  $("color").addEventListener("input", function () { setColor($("color").value); render(); });
  $("hex").addEventListener("input", function () { setColor($("hex").value); render(); });
  $("temp-min").addEventListener("input", function () { suggested.min = false; });
  $("temp-max").addEventListener("input", function () { suggested.max = false; });
  $("temp-print").addEventListener("input", function () { suggested.print = false; });
  $("temp-bed").addEventListener("input", function () { suggested.bed = false; });
  $("supplier").addEventListener("input", function () { $("supplier").dataset.touched = "1"; });
  $("suggest-code").addEventListener("click", suggestCode);
  $("new-serial").addEventListener("click", function () {
    $("serial").value = String(Math.floor(Math.random() * 1000000)).padStart(6, "0");
    render();
  });
  document.querySelectorAll("#swatches button").forEach(function (button) {
    button.addEventListener("click", function () {
      setColor(button.getAttribute("data-color"));
      render();
    });
  });
  $("copy-record").addEventListener("click", function () {
    if (latest.tag.ok) copyText(latest.tag.payload, $("copy-record"));
  });
  $("copy-blocks").addEventListener("click", function () {
    if (latest.tag.ok) copyText(blockSheet(), $("copy-blocks"));
  });
  $("copy-notes").addEventListener("click", function () { copyText(notesJson(), $("copy-notes")); });
  $("copy-map").addEventListener("click", function () { copyText(mapCommand(), $("copy-map")); });
  $("download").addEventListener("click", function () {
    if (!latest.tag.ok) return;
    var blob = new Blob([blockSheet() + "\n\nPrinter notes\n" + notesJson() + "\n"], { type: "text/plain" });
    var link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "cfs-" + $("code").value.trim().toUpperCase() + ".txt";
    link.click();
    URL.revokeObjectURL(link.href);
  });
  $("decode-input").addEventListener("input", renderDecode);

  render();
})();
