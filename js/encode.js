(function (root) {
  "use strict";

  var WEIGHT_TO_LENGTH = {
    250: "0080",
    500: "0165",
    1000: "0330",
  };

  function asciiHex(text) {
    var hex = "";
    for (var i = 0; i < text.length; i += 1) {
      hex += text.charCodeAt(i).toString(16).toUpperCase().padStart(2, "0");
    }
    return hex;
  }

  function clean(value) {
    return String(value == null ? "" : value).trim().toUpperCase();
  }

  function dateCode(isoDate) {
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate || "");
    if (!match) return { error: "Choose a manufacture date." };
    var year = Number(match[1]);
    var month = Number(match[2]);
    var day = Number(match[3]);
    var maxDay = new Date(year, month, 0).getDate();
    if (month < 1 || month > 12 || day < 1 || day > maxDay) {
      return { error: "That date is not valid." };
    }
    var yy = String(year).slice(-2);
    var code = yy + month.toString(16).toUpperCase() + String(day).padStart(2, "0");
    if (yy.charAt(0) !== "2") {
      return {
        error: "Use a year from 2020 through 2029. The CFS treats the sticker as plain text only when the year starts with 2. From 2030 onward it will try to decrypt the tag and fail.",
      };
    }
    return { code: code };
  }

  function build(input) {
    var errors = [];
    var batch = clean(input.batch);
    var supplier = clean(input.supplier);
    var material = clean(input.material);
    var color = clean(input.color).replace(/^#/, "");
    var length = clean(input.length);
    var serial = clean(input.serial);
    var reserve = clean(input.reserve || "00000000000000");
    var dated = dateCode(input.date);

    if (!/^[0-9A-F]{3}$/.test(batch)) errors.push("Batch must be exactly 3 hex characters, 0-9 and A-F.");
    if (dated.error) errors.push(dated.error);
    if (!/^[0-9A-Z]{4}$/.test(supplier)) errors.push("Vendor code must be exactly 4 letters or digits.");
    if (!/^[0-9A-Z]{5}$/.test(material)) errors.push("Material code must be exactly 5 letters or digits.");
    if (!/^[0-9A-F]{6}$/.test(color)) errors.push("Color must be 6 hex digits, such as 2F6FED.");
    if (!/^\d{4}$/.test(length)) errors.push("Length must be 4 digits, in meters.");
    if (!/^[0-9A-Z]{6}$/.test(serial)) errors.push("Serial must be exactly 6 letters or digits.");
    if (!/^[0-9A-Z]{14}$/.test(reserve)) errors.push("Reserve must be exactly 14 letters or digits.");

    var date = dated.code || "00000";
    var payload = batch + date + supplier + material + "#" + color + length + serial + reserve;
    if (!errors.length && payload.length !== 48) {
      errors.push("Internal error: record is " + payload.length + " characters instead of 48.");
    }

    var blocks = [];
    if (!errors.length) {
      blocks = [4, 5, 6].map(function (block, index) {
        var ascii = payload.slice(index * 16, index * 16 + 16);
        return { block: block, ascii: ascii, hex: asciiHex(ascii) };
      });
    }

    return {
      ok: errors.length === 0,
      errors: errors,
      payload: errors.length ? "" : payload,
      blocks: blocks,
      fields: {
        batch: batch,
        date: date,
        supplier: supplier,
        material: material,
        color: color,
        length: length,
        serial: serial,
        reserve: reserve,
      },
    };
  }

  function decode(raw) {
    var text = String(raw || "").replace(/\s+/g, "").toUpperCase();
    var payload = text;
    if (/^[0-9A-F]+$/.test(text) && text.length === 96) {
      payload = "";
      for (var i = 0; i < text.length; i += 2) {
        payload += String.fromCharCode(parseInt(text.slice(i, i + 2), 16));
      }
    }
    if (payload.length !== 48) {
      return {
        ok: false,
        errors: ["Paste the 48-character record, or the 96-character hex from all three blocks. This one is " + payload.length + " characters."],
      };
    }
    var fields = {
      batch: payload.slice(0, 3),
      date: payload.slice(3, 8),
      supplier: payload.slice(8, 12),
      material: payload.slice(12, 17),
      prefix: payload.slice(17, 18),
      color: payload.slice(18, 24),
      length: payload.slice(24, 28),
      serial: payload.slice(28, 34),
      reserve: payload.slice(34, 48),
    };
    var errors = [];
    if (fields.prefix !== "#" && fields.prefix !== "0") {
      errors.push("The color marker is not # or 0, so a CFS may try to decrypt this sticker and fail.");
    }
    if (fields.date.charAt(0) !== "2") {
      errors.push("The year does not start with 2, so a CFS may treat this sticker as encrypted.");
    }
    return { ok: errors.length === 0, errors: errors, payload: payload, fields: fields };
  }

  function lengthForGrams(grams) {
    return WEIGHT_TO_LENGTH[Number(grams)] || "";
  }

  function gramsForLength(length) {
    var match = Object.keys(WEIGHT_TO_LENGTH).find(function (grams) {
      return WEIGHT_TO_LENGTH[grams] === length;
    });
    return match ? Number(match) : null;
  }

  function describeDate(code) {
    if (!code || code.length !== 5) return code || "";
    var year = 2000 + Number(code.slice(0, 2));
    var month = parseInt(code.charAt(2), 16);
    var day = Number(code.slice(3, 5));
    var names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    if (!month || month > 12 || !day || day > 31 || Number.isNaN(year)) return code;
    return names[month - 1] + " " + day + ", " + year;
  }

  root.CfsTag = {
    build: build,
    decode: decode,
    asciiHex: asciiHex,
    lengthForGrams: lengthForGrams,
    gramsForLength: gramsForLength,
    describeDate: describeDate,
  };

  if (typeof module !== "undefined" && require.main === module) {
    var known = "56D241200A2100001#0000FF016500000100000000000000";
    var decoded = decode(known);
    if (!decoded.ok) throw new Error(decoded.errors.join("\n"));
    var built = build({
      batch: "56D",
      date: "2024-01-20",
      supplier: "0A21",
      material: "00001",
      color: "0000FF",
      length: "0165",
      serial: "000001",
      reserve: "00000000000000",
    });
    if (built.payload !== known) {
      throw new Error("payload mismatch\n" + built.payload + "\n" + known);
    }
    var expectedHex = [
      "35364432343132303041323130303030",
      "31233030303046463031363530303030",
      "30313030303030303030303030303030",
    ];
    built.blocks.forEach(function (block, index) {
      if (block.hex !== expectedHex[index]) {
        throw new Error("block " + block.block + " hex mismatch " + block.hex);
      }
    });
    var october = build({
      batch: "001",
      date: "2026-10-27",
      supplier: "0276",
      material: "01001",
      color: "FF8800",
      length: "0330",
      serial: "000001",
    });
    if (!october.ok || october.payload.indexOf("26A27") === -1 || october.payload.length !== 48) {
      throw new Error("october encode failed " + JSON.stringify(october));
    }
    var december = build({
      batch: "001",
      date: "2026-12-01",
      supplier: "0276",
      material: "01001",
      color: "FFFFFF",
      length: "0080",
      serial: "000002",
    });
    if (!december.ok || december.payload.indexOf("26C01") === -1) {
      throw new Error("december encode failed " + JSON.stringify(december));
    }
    var badYear = build({
      batch: "001",
      date: "2030-01-01",
      supplier: "0276",
      material: "01001",
      color: "FFFFFF",
      length: "0330",
      serial: "000001",
    });
    if (badYear.ok) throw new Error("2030 should stay plaintext-incompatible");
    if (lengthForGrams(1000) !== "0330" || gramsForLength("0165") !== 500) {
      throw new Error("weight map failed");
    }
    console.log("cfs encode checks passed");
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
