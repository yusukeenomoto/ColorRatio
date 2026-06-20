(function () {
  "use strict";

  var coefficient = document.getElementById("coefficient");
  var coefficientRange = document.getElementById("coefficientRange");
  var applyFill = document.getElementById("applyFill");
  var applyStroke = document.getElementById("applyStroke");
  var applyText = document.getElementById("applyText");
  var applyGradient = document.getElementById("applyGradient");
  var applySpot = document.getElementById("applySpot");
  var colorFamily = document.getElementById("colorFamily");
  var colorChannel = document.getElementById("colorChannel");
  var applyButton = document.getElementById("apply");
  var resetButton = document.getElementById("reset");
  var status = document.getElementById("status");
  var presetButtons = document.querySelectorAll("[data-factor]");

  function getPayload() {
    return {
      mode: "coefficient",
      coefficient: getCoefficient(),
      targets: {
        fill: applyFill.checked,
        stroke: applyStroke.checked,
        text: applyText.checked,
        gradient: applyGradient.checked,
        spot: applySpot.checked
      },
      colorMode: getColorMode()
    };
  }

  function getColorMode() {
    var family = colorFamily.value;
    if (family === "all" || family === "gray" || family === "spot") {
      return family;
    }
    return colorChannel.value === "all" ? family : colorChannel.value;
  }

  function updateChannelOptions() {
    var family = colorFamily.value;
    var channels = {
      rgb: [["all", "全体"], ["r", "R"], ["g", "G"], ["b", "B"]],
      cmyk: [["all", "全体"], ["c", "C"], ["m", "M"], ["y", "Y"], ["k", "K"]]
    };
    var options = channels[family] || [["all", "全体"]];

    while (colorChannel.options.length) {
      colorChannel.remove(0);
    }
    for (var i = 0; i < options.length; i++) {
      var option = document.createElement("option");
      option.value = options[i][0];
      option.textContent = options[i][1];
      colorChannel.appendChild(option);
    }
    colorChannel.disabled = family !== "rgb" && family !== "cmyk";
  }

  function getCoefficient() {
    var value = Number(coefficient.value);
    if (isNaN(value)) {
      value = 1;
    }
    return clamp(value, 0, 5);
  }

  function setCoefficient(value) {
    var normalized = clamp(Number(value), 0, 5);
    coefficient.value = normalized.toFixed(2);
    coefficientRange.value = String(Math.round(normalized * 100));
  }

  function applyCoefficient() {
    var payload = JSON.stringify(getPayload());

    if (window.__adobe_cep__ && window.__adobe_cep__.evalScript) {
      setStatus("Illustrator に適用中...");
      evalHostScript(function () {
        window.__adobe_cep__.evalScript(
          'ColorRatio_applySelected(' + JSON.stringify(payload) + ')',
          function (result) {
            setStatus(result || "完了しました。");
          }
        );
      });
      return;
    }

    console.log("Coefficient payload", payload);
    setStatus("CEP 外で実行中のため Illustrator には適用していません。");
  }

  function evalHostScript(callback) {
    var extensionPath = "";
    if (window.__adobe_cep__.getSystemPath) {
      extensionPath = window.__adobe_cep__.getSystemPath("extension");
    }

    if (!extensionPath) {
      callback();
      return;
    }

    var jsxPath = extensionPath + "/jsx/ColorRatioHost.jsx";
    var script = '$.evalFile(File(' + JSON.stringify(jsxPath) + ')); "loaded";';
    window.__adobe_cep__.evalScript(script, function () {
      callback();
    });
  }

  function setStatus(message) {
    status.textContent = message;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  coefficient.addEventListener("change", function () {
    setCoefficient(coefficient.value);
  });

  coefficientRange.addEventListener("input", function () {
    setCoefficient(Number(coefficientRange.value) / 100);
  });

  presetButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      setCoefficient(button.getAttribute("data-factor"));
    });
  });

  applyButton.addEventListener("click", applyCoefficient);
  colorFamily.addEventListener("change", updateChannelOptions);

  resetButton.addEventListener("click", function () {
    setCoefficient(1);
    applyFill.checked = true;
    applyStroke.checked = true;
    applyText.checked = true;
    applyGradient.checked = true;
    applySpot.checked = true;
    colorFamily.value = "all";
    updateChannelOptions();
    setStatus("リセットしました。");
  });

  setCoefficient(1);
  updateChannelOptions();
})();
