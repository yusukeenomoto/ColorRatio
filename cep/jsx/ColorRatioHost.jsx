#target illustrator

function ColorRatio_applySelected(payload) {
  try {
    var data = ColorRatio_parsePayload(payload);
    if (!data) {
      return "Invalid ColorRatio data.";
    }

    if (app.documents.length === 0) {
      return "ドキュメントが開かれていません。";
    }

    if (!app.activeDocument.selection || app.activeDocument.selection.length === 0) {
      return "オブジェクトを選択してください。";
    }

    var stats = {
      objects: 0,
      colors: 0,
      skipped: 0,
      processedGradients: {},
      warnings: []
    };
    var selection = app.activeDocument.selection;
    for (var i = 0; i < selection.length; i++) {
      ColorRatio_applyToPageItem(selection[i], data, stats);
    }
    app.redraw();

    if (stats.skipped > 0) {
      alert("対象外のオブジェクトには適応されません。");
    }

    var result = "適用完了: " + stats.colors + " 色 / " + stats.objects + " オブジェクト";
    if (stats.skipped > 0) {
      result += " / スキップ " + stats.skipped;
    }
    if (stats.warnings.length > 0) {
      result += "（" + stats.warnings.join("、") + "）";
    }
    return result;
  } catch (e) {
    return "エラー: " + e;
  }
}

function ColorRatio_parsePayload(payload) {
  try {
    if (typeof JSON !== "undefined" && JSON.parse) {
      return JSON.parse(payload);
    }
  } catch (e) {
    try {
      return eval("(" + payload + ")");
    } catch (ignored) {
      return null;
    }
  }
  try {
    return eval("(" + payload + ")");
  } catch (ignoredAgain) {
    return null;
  }
}

function ColorRatio_applyToPageItem(item, data, stats) {
  if (!item) return;
  stats.objects++;

  if (stats.objects > 2000) {
    stats.skipped++;
    ColorRatio_addWarning(stats, "2000オブジェクトを超えたため中断");
    return;
  }

  switch (item.typename) {
    case "GroupItem":
      ColorRatio_applyToCollection(item.pageItems, data, stats);
      break;
    case "CompoundPathItem":
      ColorRatio_applyToCollection(item.pathItems, data, stats);
      break;
    case "PathItem":
      ColorRatio_applyToPathItem(item, data, stats);
      break;
    case "TextFrame":
      ColorRatio_applyToTextFrame(item, data, stats);
      break;
    default:
      stats.skipped++;
  }
}

function ColorRatio_applyToCollection(collection, data, stats) {
  for (var i = 0; i < collection.length; i++) {
    ColorRatio_applyToPageItem(collection[i], data, stats);
  }
}

function ColorRatio_applyToPathItem(pathItem, data, stats) {
  var targets = ColorRatio_getTargets(data);
  if (pathItem.filled && targets.fill) {
    ColorRatio_applyColorProperty(pathItem, "fillColor", data, stats);
  }
  if (pathItem.stroked && targets.stroke) {
    ColorRatio_applyColorProperty(pathItem, "strokeColor", data, stats);
  }
}

function ColorRatio_applyToTextFrame(textFrame, data, stats) {
  if (!ColorRatio_getTargets(data).text) {
    return;
  }

  try {
    var attrs = textFrame.textRange.characterAttributes;
    ColorRatio_applyColorProperty(attrs, "fillColor", data, stats);
    ColorRatio_applyColorProperty(attrs, "strokeColor", data, stats);
  } catch (e) {
    stats.skipped++;
  }
}

function ColorRatio_applyColorProperty(owner, propertyName, data, stats) {
  var color = owner[propertyName];
  if (!color) return;

  if (ColorRatio_isPotentialFreeformGradient(owner, propertyName, color)) {
    stats.skipped++;
    ColorRatio_addWarning(stats, "フリーグラデーション候補を省略");
    return;
  }

  if (color.typename === "GradientColor") {
    if (ColorRatio_getTargets(data).gradient) {
      ColorRatio_mapColor(color, data, stats);
    }
    return;
  }

  if (ColorRatio_isUnsupportedColor(color)) {
    stats.skipped++;
    return;
  }

  if (!ColorRatio_colorMatchesMode(color, data)) {
    return;
  }

  owner[propertyName] = ColorRatio_mapColor(color, data, stats);
}

function ColorRatio_isPotentialFreeformGradient(owner, propertyName, color) {
  if (propertyName !== "fillColor" || color.typename !== "GrayColor") {
    return false;
  }

  try {
    if (owner.typename !== "PathItem") {
      return false;
    }
    return Number(color.gray) === 0;
  } catch (e) {
    return false;
  }
}

function ColorRatio_mapColor(color, data, stats) {
  if (!color) {
    stats.skipped++;
    return color;
  }

  switch (color.typename) {
    case "RGBColor":
      if (ColorRatio_shouldApplyChannel(data, "rgb", "r")) {
        color.red = ColorRatio_mapByte(color.red, data, 255);
      }
      if (ColorRatio_shouldApplyChannel(data, "rgb", "g")) {
        color.green = ColorRatio_mapByte(color.green, data, 255);
      }
      if (ColorRatio_shouldApplyChannel(data, "rgb", "b")) {
        color.blue = ColorRatio_mapByte(color.blue, data, 255);
      }
      if (ColorRatio_shouldApplyColorMode(data, "rgb")) {
        stats.colors++;
      }
      return color;
    case "CMYKColor":
      if (ColorRatio_shouldApplyChannel(data, "cmyk", "c")) {
        color.cyan = ColorRatio_mapPercent(color.cyan, data);
      }
      if (ColorRatio_shouldApplyChannel(data, "cmyk", "m")) {
        color.magenta = ColorRatio_mapPercent(color.magenta, data);
      }
      if (ColorRatio_shouldApplyChannel(data, "cmyk", "y")) {
        color.yellow = ColorRatio_mapPercent(color.yellow, data);
      }
      if (ColorRatio_shouldApplyChannel(data, "cmyk", "k")) {
        color.black = ColorRatio_mapPercent(color.black, data);
      }
      if (ColorRatio_shouldApplyColorMode(data, "cmyk")) {
        stats.colors++;
      }
      return color;
    case "GrayColor":
      if (ColorRatio_shouldApplyColorMode(data, "gray")) {
        color.gray = ColorRatio_mapPercent(color.gray, data);
        stats.colors++;
      }
      return color;
    case "GradientColor":
      if (!ColorRatio_getTargets(data).gradient) {
        return color;
      }
      if (ColorRatio_mapGradient(color.gradient, data, stats)) {
        stats.colors++;
      }
      return color;
    case "SpotColor":
      if (ColorRatio_getTargets(data).spot && ColorRatio_shouldApplyColorMode(data, "spot")) {
        color.tint = ColorRatio_mapPercent(color.tint, data);
        stats.colors++;
      }
      return color;
    default:
      stats.skipped++;
      return color;
  }
}

function ColorRatio_mapGradient(gradient, data, stats) {
  if (!ColorRatio_isSupportedGradient(gradient)) {
    stats.skipped++;
    return false;
  }

  var stopCount = gradient.gradientStops.length;
  if (stopCount > 64) {
    stats.skipped++;
    ColorRatio_addWarning(stats, "64停止色を超えるグラデーションを省略");
    return false;
  }

  var gradientKey = ColorRatio_getGradientKey(gradient);
  if (gradientKey && stats.processedGradients[gradientKey]) {
    return false;
  }
  if (gradientKey) {
    stats.processedGradients[gradientKey] = true;
  }

  var changed = false;
  for (var i = 0; i < stopCount; i++) {
    try {
      var stopColor = gradient.gradientStops[i].color;
      if (ColorRatio_isUnsupportedColor(stopColor)) {
        stats.skipped++;
        continue;
      }
      if (!ColorRatio_colorMatchesMode(stopColor, data)) {
        continue;
      }
      gradient.gradientStops[i].color = ColorRatio_mapColor(stopColor, data, stats);
      changed = true;
    } catch (e) {
      stats.skipped++;
    }
  }
  return changed;
}

function ColorRatio_getGradientKey(gradient) {
  try {
    if (gradient.name) {
      return "name:" + gradient.name;
    }
  } catch (e) {}
  return null;
}

function ColorRatio_colorMatchesMode(color, data) {
  if (!color) return false;
  switch (color.typename) {
    case "RGBColor":
      return ColorRatio_shouldApplyColorMode(data, "rgb");
    case "CMYKColor":
      return ColorRatio_shouldApplyColorMode(data, "cmyk");
    case "GrayColor":
      return ColorRatio_shouldApplyColorMode(data, "gray");
    case "SpotColor":
      return ColorRatio_getTargets(data).spot && ColorRatio_shouldApplyColorMode(data, "spot");
    default:
      return false;
  }
}

function ColorRatio_isUnsupportedColor(color) {
  if (!color) return false;
  switch (color.typename) {
    case "RGBColor":
    case "CMYKColor":
    case "GrayColor":
    case "SpotColor":
    case "GradientColor":
    case "NoColor":
      return false;
    default:
      return true;
  }
}

function ColorRatio_addWarning(stats, warning) {
  for (var i = 0; i < stats.warnings.length; i++) {
    if (stats.warnings[i] === warning) return;
  }
  stats.warnings.push(warning);
}

function ColorRatio_isSupportedGradient(gradient) {
  if (!gradient || !gradient.gradientStops || gradient.gradientStops.length === 0) {
    return false;
  }

  try {
    if (typeof GradientType !== "undefined") {
      return gradient.type === GradientType.LINEAR || gradient.type === GradientType.RADIAL;
    }
  } catch (e) {
    return false;
  }

  try {
    var typeName = String(gradient.type).toLowerCase();
    return typeName.indexOf("linear") >= 0 || typeName.indexOf("radial") >= 0;
  } catch (ignored) {
    return false;
  }
}

function ColorRatio_mapPercent(value, data) {
  return ColorRatio_clamp(value * ColorRatio_getCoefficient(data), 0, 100);
}

function ColorRatio_mapByte(value, data, maxValue) {
  return ColorRatio_clamp(value * ColorRatio_getCoefficient(data), 0, maxValue);
}

function ColorRatio_getCoefficient(data) {
  var coefficient = Number(data.coefficient);
  if (isNaN(coefficient)) {
    coefficient = 1;
  }
  return ColorRatio_clamp(coefficient, 0, 5);
}

function ColorRatio_getTargets(data) {
  if (!data.targets) {
    return { fill: true, stroke: true, text: true, gradient: true, spot: true };
  }
  return {
    fill: data.targets.fill !== false,
    stroke: data.targets.stroke !== false,
    text: data.targets.text !== false,
    gradient: data.targets.gradient !== false,
    spot: data.targets.spot !== false
  };
}

function ColorRatio_clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function ColorRatio_getColorMode(data) {
  return data.colorMode || "all";
}

function ColorRatio_shouldApplyColorMode(data, family) {
  var mode = ColorRatio_getColorMode(data);
  if (mode === "all") return true;
  if (family === "rgb") return mode === "rgb" || mode === "r" || mode === "g" || mode === "b";
  if (family === "cmyk") return mode === "cmyk" || mode === "c" || mode === "m" || mode === "y" || mode === "k";
  return mode === family;
}

function ColorRatio_shouldApplyChannel(data, family, channel) {
  var mode = ColorRatio_getColorMode(data);
  return mode === "all" || mode === family || mode === channel;
}
