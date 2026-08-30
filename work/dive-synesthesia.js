/* dive-synesthesia.js
   Interactive "mapping key" for the Synthetic Synesthesia page.
   Reproduces, in miniature, the deterministic sound -> color rules from the app:
     pitch class  -> hue        (C≈red ... B≈violet)
     octave       -> lightness  (higher = lighter)
     loudness     -> saturation (louder = more saturated)
     timbre       -> shape       (soft = round, sharp = pointed)
   Pure vanilla JS, no dependencies. Reduced-motion is handled in CSS. */
(function () {
  var root = document.getElementById('chroma');
  if (!root) return;

  var NOTES = ['C', 'C\u266F', 'D', 'D\u266F', 'E', 'F', 'F\u266F', 'G', 'G\u266F', 'A', 'A\u266F', 'B'];
  var state = { pc: 0, oct: 4, loud: 70, tim: 20 };

  var row      = document.getElementById('semi-row');
  var sOct     = document.getElementById('s-oct');
  var sLoud    = document.getElementById('s-loud');
  var sTim     = document.getElementById('s-tim');
  var vOct     = document.getElementById('v-oct');
  var vLoud    = document.getElementById('v-loud');
  var vTim     = document.getElementById('v-tim');
  var outShape = document.getElementById('out-shape');
  var outRead  = document.getElementById('out-read');
  var outNote  = document.getElementById('out-note');

  if (!row || !sOct || !sLoud || !sTim || !outShape || !outRead) return;

  // pitch class -> hue, rainbow red(0) to violet(~286)
  function hueFor(pc) { return Math.round(pc * (286 / 11)); }
  // octave 1..7 -> lightness ~30%..80%
  function lightFor(oct) { return Math.round(30 + ((oct - 1) / 6) * 50); }

  // timbre 0..100 -> geometry + short/long labels
  function shapeFor(t) {
    if (t < 45) {
      return { br: (50 - (t / 45) * 35) + '%', clip: 'none', short: 'soft', long: 'round \u00B7 soft timbre' };
    }
    if (t < 72) {
      return { br: (15 - ((t - 45) / 27) * 13) + '%', clip: 'none', short: 'mid', long: 'angular \u00B7 mid timbre' };
    }
    if (t < 88) {
      return { br: '0', clip: 'polygon(50% 0,100% 100%,0 100%)', short: 'sharp', long: 'sharp \u00B7 triangle' };
    }
    return {
      br: '0',
      clip: 'polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)',
      short: 'sharp', long: 'sharp \u00B7 star'
    };
  }

  var cells = [];

  function build() {
    for (var i = 0; i < 12; i++) {
      (function (i) {
        var cell = document.createElement('div');
        cell.className = 'semi-cell';

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'semi';
        btn.setAttribute('aria-pressed', i === state.pc ? 'true' : 'false');
        btn.setAttribute('aria-label', NOTES[i] + ' \u2014 hue ' + hueFor(i) + ' degrees');
        btn.style.background = 'hsl(' + hueFor(i) + ',70%,55%)';
        btn.addEventListener('click', function () { select(i); });

        var lab = document.createElement('span');
        lab.className = 'semi-label';
        lab.textContent = NOTES[i];

        if (i === state.pc) cell.classList.add('on');
        cell.appendChild(btn);
        cell.appendChild(lab);
        row.appendChild(cell);
        cells.push({ cell: cell, btn: btn });
      })(i);
    }
  }

  function select(i) {
    state.pc = i;
    for (var k = 0; k < cells.length; k++) {
      var on = k === i;
      cells[k].btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      cells[k].cell.classList.toggle('on', on);
    }
    render();
  }

  function render() {
    var hue = hueFor(state.pc);
    var light = lightFor(state.oct);
    var sat = state.loud;
    var sh = shapeFor(state.tim);

    outShape.style.background = 'hsl(' + hue + ',' + sat + '%,' + light + '%)';
    outShape.style.borderRadius = sh.br;
    outShape.style.clipPath = sh.clip;
    outShape.style.webkitClipPath = sh.clip;

    outRead.innerHTML = 'note <b>' + NOTES[state.pc] + state.oct + '</b><br>hsl(' +
      hue + '\u00B0, ' + sat + '%, ' + light + '%)';
    outNote.textContent = sh.long;

    if (vOct) vOct.textContent = state.oct;
    if (vLoud) vLoud.textContent = sat + '%';
    if (vTim) vTim.textContent = sh.short;
  }

  sOct.addEventListener('input', function () { state.oct = +this.value; render(); });
  sLoud.addEventListener('input', function () { state.loud = +this.value; render(); });
  sTim.addEventListener('input', function () { state.tim = +this.value; render(); });

  build();
  render();
})();
