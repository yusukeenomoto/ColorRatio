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
  var confirmOverlay = document.getElementById("confirmOverlay");
  var confirmOk = document.getElementById("confirmOk");
  var confirmCancel = document.getElementById("confirmCancel");
  var presetButtons = document.querySelectorAll("[data-factor]");
  var lastCoefficientWheelAt = 0;
  var statusHighlightTimer = null;
  var pendingConfirmAction = null;

  function getPayload(coefficientValue) {
    return {
      mode: "coefficient",
      coefficient: coefficientValue,
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

  function validateCoefficient() {
    var value = Number(coefficient.value);
    if (coefficient.value === "" || isNaN(value) || value < 0.01 || value > 5) {
      window.alert("対象外の値が入力されました。");
      setStatus("1%以上500%以下の値を入力してください。");
      coefficient.focus();
      coefficient.select();
      return null;
    }
    return value;
  }

  function setCoefficient(value) {
    var normalized = clamp(Number(value), 0.01, 5);
    coefficient.value = normalized.toFixed(2);
    coefficientRange.value = String(Math.round(normalized * 100));
  }

  function stepCoefficientByWheel(event) {
    if (event.target !== coefficient && document.activeElement !== coefficient) {
      return;
    }

    event.preventDefault();

    var now = Date.now();
    if (now - lastCoefficientWheelAt < 80) {
      return;
    }
    lastCoefficientWheelAt = now;

    var current = Number(coefficient.value);
    if (isNaN(current)) {
      current = 1;
    }
    var delta = typeof event.deltaY === "number" ? event.deltaY : -event.wheelDelta;
    setCoefficient(current + (delta < 0 ? 0.01 : -0.01));
  }

  function addCoefficientWheelListener(type) {
    try {
      coefficient.addEventListener(type, stepCoefficientByWheel, { passive: false });
    } catch (error) {
      coefficient.addEventListener(type, stepCoefficientByWheel, false);
    }
  }

  function applyCoefficient() {
    var coefficientValue = validateCoefficient();
    if (coefficientValue === null) {
      return;
    }
    var payload = JSON.stringify(getPayload(coefficientValue));

    if (window.__adobe_cep__ && window.__adobe_cep__.evalScript) {
      setStatus("Illustrator に適用中...");
      evalHostScript(function () {
        window.__adobe_cep__.evalScript(
          'ColorRatio_applySelected(' + JSON.stringify(payload) + ')',
          function (result) {
            var message = result || "完了しました。";
            setStatus(message, { success: isSuccessfulApplyResult(message) });
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

  function setStatus(message, options) {
    status.textContent = message;
    if (options && options.success) {
      flashStatusSuccess();
    }
  }

  function flashStatusSuccess() {
    if (statusHighlightTimer) {
      clearTimeout(statusHighlightTimer);
    }
    status.classList.remove("status-success");
    status.offsetWidth;
    status.classList.add("status-success");
    statusHighlightTimer = setTimeout(function () {
      status.classList.remove("status-success");
      statusHighlightTimer = null;
    }, 900);
  }

  function isSuccessfulApplyResult(message) {
    var match = /^適用完了: ([1-9][0-9]*) 色/.exec(message);
    return !!match && message.indexOf("スキップ") === -1 && message.indexOf("エラー") === -1;
  }

  function showApplyConfirmation(callback) {
    pendingConfirmAction = callback;
    confirmOverlay.hidden = false;
    confirmOk.focus();
  }

  function hideApplyConfirmation() {
    confirmOverlay.hidden = true;
    pendingConfirmAction = null;
    coefficient.focus();
  }

  function confirmApply() {
    var callback = pendingConfirmAction;
    hideApplyConfirmation();
    if (callback) {
      callback();
    }
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  coefficient.addEventListener("change", function () {
    var value = validateCoefficient();
    if (value !== null) {
      setCoefficient(value);
    }
  });

  coefficient.addEventListener("keydown", function (event) {
    if (event.key !== "Enter" && event.key !== "Return") {
      return;
    }

    event.preventDefault();
    var value = validateCoefficient();
    if (value === null) {
      return;
    }
    setCoefficient(value);
    showApplyConfirmation(function () {
      applyCoefficient();
    });
  });

  addCoefficientWheelListener("wheel");
  addCoefficientWheelListener("mousewheel");

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
  confirmOk.addEventListener("click", confirmApply);
  confirmCancel.addEventListener("click", hideApplyConfirmation);
  confirmOverlay.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      event.preventDefault();
      hideApplyConfirmation();
      return;
    }
    if (event.key === "Enter" || event.key === "Return") {
      event.preventDefault();
      confirmApply();
    }
  });

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
