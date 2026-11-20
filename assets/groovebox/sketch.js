let audioStarted = false;
let actx = null;

let cw, ch, scaleF;
let layout = {};

let mouseZone = null;
let keyZones = new Set();
let hoverZone = null;
let angleL = 0, angleR = 0;
let speedL = 0, speedR = 0;
let impactScale = 1.0;

let isAutoplaying = false;
let stepCount = 0;
let lastBeatTime = 0;
let beatInterval = 155;

let saxVoice = null;
let knobVoice = null;
let visualPulse = 0;
let noiseBuffer = null;

const KEY_MAP = {
  '1': 'stripe1', '2': 'stripe2', '3': 'stripe3', '4': 'stripe4', '5': 'label',
  'q': 'spoolL', 'w': 'spoolR', 'e': 'window',
  'arrowleft': 'rimLeft', 'arrowdown': 'rimBottom', 'arrowup': 'rimTop', 'arrowright': 'rimRight',
  ' ': 'indent',
  't': 'screwTL', 'y': 'screwTR', 'u': 'screwBL', 'i': 'screwBR',
  'o': 'holeL', 'p': 'holeR',
  'enter': 'autoBtn'
};

window.addEventListener("keydown", function(e) {
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter"].indexOf(e.code) > -1) {
    e.preventDefault();
  }
}, false);

function setup() {
  let cnv = createCanvas(windowWidth, windowHeight);
  cnv.style('display', 'block');
  cnv.style('touch-action', 'none');
  cnv.style('user-select', 'none');
  cnv.style('-webkit-user-select', 'none');

  calculateDimensions();
  rectMode(CENTER);
  angleMode(RADIANS);
  textFont('"Stack Sans Headline", sans-serif');
}

function initAudio() {
  if (audioStarted && actx) {
    if (actx.state === 'suspended') actx.resume();
    return;
  }
  if (typeof userStartAudio === 'function') {
    userStartAudio();
  }
  actx = (typeof getAudioContext === 'function') ? getAudioContext() : new (window.AudioContext || window.webkitAudioContext)();
  if (actx.state === 'suspended') {
    actx.resume();
  }

  let bufferSize = actx.sampleRate * 1.0;
  noiseBuffer = actx.createBuffer(1, bufferSize, actx.sampleRate);
  let output = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    output[i] = Math.random() * 2 - 1;
  }

  let sOsc = actx.createOscillator();
  let sFilt = actx.createBiquadFilter();
  let sGain = actx.createGain();
  sOsc.type = 'sawtooth';
  sOsc.frequency.value = 300;
  sFilt.type = 'lowpass';
  sFilt.frequency.value = 1100;
  sGain.gain.value = 0;
  sOsc.connect(sFilt);
  sFilt.connect(sGain);
  sGain.connect(actx.destination);
  sOsc.start();
  saxVoice = { osc: sOsc, gain: sGain };

  let kOsc = actx.createOscillator();
  let kGain = actx.createGain();
  kOsc.type = 'triangle';
  kOsc.frequency.value = 440;
  kGain.gain.value = 0;
  kOsc.connect(kGain);
  kGain.connect(actx.destination);
  kOsc.start();
  knobVoice = { osc: kOsc, gain: kGain };

  audioStarted = true;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  calculateDimensions();
}

function calculateDimensions() {
  let maxW = width * 0.86;
  let maxH = height * 0.68;
  cw = min(maxW, maxH / 0.625, 760);
  cw = max(cw, 240);
  ch = cw * 0.625;
  scaleF = cw / 800;

  let rimW = ch * 0.12;
  layout.rimTop = { x: 0, y: -ch / 2 + rimW / 2, w: cw, h: rimW };
  layout.rimBottom = { x: 0, y: ch / 2 - rimW / 2, w: cw, h: rimW };
  layout.rimLeft = { x: -cw / 2 + rimW / 2, y: 0, w: rimW, h: ch - 2 * rimW };
  layout.rimRight = { x: cw / 2 - rimW / 2, y: 0, w: rimW, h: ch - 2 * rimW };

  layout.autoBtn = { x: cw / 2 + 14 * scaleF, y: -ch * 0.1, w: 28 * scaleF, h: 80 * scaleF, r: 8 * scaleF };

  let labelW = cw * 0.75, labelH = ch * 0.52, labelY = -ch * 0.08, lblH = labelH * 0.35;
  layout.label = { x: 0, y: labelY - labelH / 2 + lblH / 2 + 4 * scaleF, w: labelW - 16 * scaleF, h: lblH };

  let strH = (labelH * 0.6) / 4 - 3 * scaleF;
  let startY = layout.label.y + lblH / 2 + strH / 2 + 6 * scaleF;
  layout.stripe1 = { x: 0, y: startY, w: labelW - 16 * scaleF, h: strH };
  layout.stripe2 = { x: 0, y: startY + strH + 3 * scaleF, w: labelW - 16 * scaleF, h: strH };
  layout.stripe3 = { x: 0, y: startY + (strH + 3 * scaleF) * 2, w: labelW - 16 * scaleF, h: strH };
  layout.stripe4 = { x: 0, y: startY + (strH + 3 * scaleF) * 3, w: labelW - 16 * scaleF, h: strH };

  layout.window = { x: 0, y: ch * 0.1, w: cw * 0.48, h: ch * 0.25 };
  layout.spoolL = { x: -cw * 0.13, y: layout.window.y, d: ch * 0.22 };
  layout.spoolR = { x: cw * 0.13, y: layout.window.y, d: ch * 0.22 };

  let indW_T = cw * 0.45, indW_B = cw * 0.55, indH = ch * 0.18, indY = ch / 2 - rimW / 2;
  layout.indent = {
    y: indY, w: indW_B, h: indH,
    verts: [
      { x: -indW_T / 2, y: indY - indH / 2 }, { x: indW_T / 2, y: indY - indH / 2 },
      { x: indW_B / 2, y: indY + indH / 2 }, { x: -indW_B / 2, y: indY + indH / 2 }
    ]
  };

  layout.holeL = { x: -cw * 0.25, y: indY, d: 24 * scaleF };
  layout.holeR = { x: cw * 0.25, y: indY, d: 24 * scaleF };
  layout.screwTL = { x: layout.rimLeft.x, y: layout.rimTop.y, d: 20 * scaleF };
  layout.screwTR = { x: layout.rimRight.x, y: layout.rimTop.y, d: 20 * scaleF };
  layout.screwBL = { x: layout.rimLeft.x, y: layout.rimBottom.y, d: 20 * scaleF };
  layout.screwBR = { x: layout.rimRight.x, y: layout.rimBottom.y, d: 20 * scaleF };
}

function getPointerCoords() {
  if (touches && touches.length > 0) {
    return { x: touches[0].x, y: touches[0].y };
  }
  return { x: mouseX, y: mouseY };
}

function isPressed(zone) {
  return mouseZone === zone || keyZones.has(zone);
}

function draw() {
  background('#161616');
  rectMode(CENTER);

  if (audioStarted && isAutoplaying) {
    if (millis() - lastBeatTime > beatInterval) {
      playSequencerStep(stepCount);
      stepCount = (stepCount + 1) % 16;
      lastBeatTime = millis();
    }
  }

  drawMinimalInstructions();

  let ptr = getPointerCoords();
  let centerY = height * 0.48;

  push();
  translate(width / 2, centerY);

  let mx = ptr.x - width / 2;
  let my = ptr.y - centerY;
  hoverZone = (touches && touches.length > 0) ? null : getHitZone(mx, my);
  cursor(hoverZone ? 'pointer' : 'default');

  scale(impactScale);
  impactScale = lerp(impactScale, 1.0, 0.15);
  visualPulse = lerp(visualPulse, 0, 0.14);

  if (isPressed('spoolL') && saxVoice) {
    speedL = 0.2;
    let freq = map(ptr.y, 0, height, 750, 150, true);
    saxVoice.osc.frequency.setTargetAtTime(freq, actx.currentTime, 0.03);
    visualPulse = max(visualPulse, 0.35);
  } else {
    speedL *= 0.92;
  }

  if (isPressed('spoolR') && knobVoice) {
    speedR = 0.2;
    let freq = map(ptr.x, 0, width, 200, 1100, true);
    let vol = map(ptr.y, 0, height, 0.35, 0.05, true);
    knobVoice.osc.frequency.setTargetAtTime(freq, actx.currentTime, 0.03);
    knobVoice.gain.gain.setTargetAtTime(vol, actx.currentTime, 0.03);
    visualPulse = max(visualPulse, vol);
  } else {
    speedR *= 0.92;
  }

  if (isAutoplaying) {
    speedL = 0.08;
    speedR = 0.08;
  }

  angleL += speedL;
  angleR += speedR;
  drawCassette();
  pop();
}

function playSequencerStep(step) {
  impactScale = 1.025;

  if (step === 0 || step === 6 || step === 10) playKick();
  if (step === 4 || step === 12) playSnare();
  if (step % 2 === 0) playHiHat();
  if (step === 15) playTom(110);

  if (step === 0)  { playTom(75); playNote(261.63, 0.22); }
  if (step === 3)  { playNote(311.13, 0.16); }
  if (step === 6)  { playNote(349.23, 0.22); }
  if (step === 8)  { playTom(65); playNote(392.00, 0.22); }
  if (step === 11) { playNote(349.23, 0.16); }
  if (step === 14) { playNote(311.13, 0.20); }
}

function drawMinimalInstructions() {
  push();
  resetMatrix();
  noStroke();
  let centerY = height * 0.48;

  if (!audioStarted) {
    fill(255, 210);
    textAlign(CENTER, CENTER);
    textSize(constrain(cw * 0.026, 12, 17));
    text("Tap or click cassette to enable sound", width / 2, max(24, centerY - ch * 0.58));
  }

  fill(255, 130);
  textAlign(CENTER, BOTTOM);
  let fontSize = constrain(width * 0.015, 10, 13);
  textSize(fontSize);

  if (width < 640) {
    text("Tap pads to play  •  Hold spools to bend pitch", width / 2, height - 28);
    text("Red side button: Autoplay song", width / 2, height - 12);
  } else {
    text("1-4: Melody  |  5: Chord  |  Arrows: Drums  |  Q/W: Spools  |  Enter / Red Button: Autoplay", width / 2, height - 18);
  }
  pop();
}

function drawPad(z, colStr, obj, r = 0) {
  let pressed = isPressed(z);
  let isHovered = (hoverZone === z && !pressed);
  let offset = pressed ? 0 : 5 * scaleF;
  let baseCol = color(colStr);
  if (isHovered) baseCol = lerpColor(baseCol, color(255), 0.15);

  noStroke();
  fill(lerpColor(baseCol, color(0), 0.5));
  rect(obj.x, obj.y, obj.w, obj.h, r);
  fill(baseCol);
  rect(obj.x - offset, obj.y - offset, obj.w, obj.h, r);
}

function drawRoundPad(z, colStr, obj, isScrew = false) {
  let pressed = isPressed(z);
  let isHovered = (hoverZone === z && !pressed);
  let offset = pressed ? 0 : 4 * scaleF;
  let baseCol = color(colStr);
  if (isHovered) baseCol = lerpColor(baseCol, color(255), 0.2);

  noStroke();
  fill(lerpColor(baseCol, color(0), 0.5));
  circle(obj.x, obj.y, obj.d);
  fill(baseCol);
  circle(obj.x - offset, obj.y - offset, obj.d);

  if (isScrew) {
    stroke('#111');
    strokeWeight(max(1.2, 2 * scaleF));
    let h = obj.d / 4;
    line(obj.x - offset - h, obj.y - offset - h, obj.x - offset + h, obj.y - offset + h);
    line(obj.x - offset - h, obj.y - offset + h, obj.x - offset + h, obj.y - offset - h);
  }
}

function drawSpool(z, obj, rotAngle) {
  let pressed = isPressed(z);
  let offset = pressed ? 0 : 5 * scaleF;

  push();
  translate(obj.x, obj.y);
  noStroke();
  fill(0, 150);
  circle(4 * scaleF, 4 * scaleF, obj.d);

  translate(-offset, -offset);
  rotate(rotAngle);
  let baseCol = (hoverZone === z && !pressed) ? color(255) : color('#ececec');
  fill(baseCol);
  circle(0, 0, obj.d * 0.95);
  fill('#c8c8c8');
  circle(0, 0, obj.d * 0.55);
  fill(40);
  for (let i = 0; i < 6; i++) {
    push();
    rotate((TWO_PI / 6) * i);
    rect(0, -obj.d * 0.32, obj.d * 0.12, obj.d * 0.2);
    pop();
  }
  fill('#1a1a1a');
  circle(0, 0, obj.d * 0.25);
  pop();
}

function drawTapeWindow(z, obj) {
  let pressed = isPressed(z);
  let offset = pressed ? 0 : 3 * scaleF;
  noStroke();
  fill('#050505');
  rect(obj.x, obj.y, obj.w, obj.h, 8 * scaleF);

  push();
  translate(obj.x - offset, obj.y - offset);
  fill('#151515');
  rect(0, 0, obj.w, obj.h, 8 * scaleF);

  let trackW = obj.w * 0.34;
  let trackH = obj.h * 0.26;
  let meterW = map(constrain(visualPulse, 0, 0.5), 0, 0.5, 4 * scaleF, trackW - 4 * scaleF, true);

  fill('#222');
  rect(0, 0, trackW, trackH, 4 * scaleF);

  fill('#ff5555');
  rectMode(CORNER);
  rect(-trackW / 2 + 2 * scaleF, -trackH / 2 + 2 * scaleF, meterW, trackH - 4 * scaleF, 3 * scaleF);
  pop();
}

function drawCassette() {
  let btnCol = isAutoplaying ? '#ff3333' : '#aa2222';
  drawPad('autoBtn', btnCol, layout.autoBtn, layout.autoBtn.r);

  fill('#202020');
  rect(0, 0, cw, ch, 15 * scaleF);

  drawPad('rimTop', '#2d2d2d', layout.rimTop, 8 * scaleF);
  drawPad('rimBottom', '#2d2d2d', layout.rimBottom, 8 * scaleF);
  drawPad('rimLeft', '#2d2d2d', layout.rimLeft, 0);
  drawPad('rimRight', '#2d2d2d', layout.rimRight, 0);

  fill('#0a0a0a');
  rect(0, -ch * 0.12, cw * 0.75, ch * 0.52, 8 * scaleF);
  drawPad('label', '#e6e0d4', layout.label, 4 * scaleF);
  drawPad('stripe1', '#e78c45', layout.stripe1, 3 * scaleF);
  drawPad('stripe2', '#75b9be', layout.stripe2, 3 * scaleF);
  drawPad('stripe3', '#e3b156', layout.stripe3, 3 * scaleF);
  drawPad('stripe4', '#d6443c', layout.stripe4, 3 * scaleF);

  drawTapeWindow('window', layout.window);
  drawSpool('spoolL', layout.spoolL, angleL);
  drawSpool('spoolR', layout.spoolR, angleR);

  let isSubPressed = isPressed('indent');
  let subOff = isSubPressed ? 0 : 4 * scaleF;
  let subCol = (hoverZone === 'indent' && !isSubPressed) ? color('#333') : color('#252525');
  noStroke();
  fill(lerpColor(subCol, color(0), 0.5));
  beginShape();
  for (let v of layout.indent.verts) vertex(v.x, v.y);
  endShape(CLOSE);
  fill(subCol);
  beginShape();
  for (let v of layout.indent.verts) vertex(v.x - subOff, v.y - subOff);
  endShape(CLOSE);

  drawRoundPad('holeL', '#181818', layout.holeL);
  drawRoundPad('holeR', '#181818', layout.holeR);
  drawRoundPad('screwTL', '#5c5c5c', layout.screwTL, true);
  drawRoundPad('screwTR', '#5c5c5c', layout.screwTR, true);
  drawRoundPad('screwBL', '#5c5c5c', layout.screwBL, true);
  drawRoundPad('screwBR', '#5c5c5c', layout.screwBR, true);
}

function inRect(mx, my, rx, ry, rw, rh) {
  return mx > rx - rw / 2 && mx < rx + rw / 2 && my > ry - rh / 2 && my < ry + rh / 2;
}

function getHitZone(mx, my) {
  let pad = max(4, 6 * scaleF);
  let circles = ['spoolL', 'spoolR', 'holeL', 'holeR', 'screwTL', 'screwTR', 'screwBL', 'screwBR'];
  for (let c of circles) {
    if (dist(mx, my, layout[c].x, layout[c].y) < (layout[c].d / 2) + pad) return c;
  }
  if (inRect(mx, my, 0, layout.indent.y, layout.indent.w + pad, layout.indent.h + pad)) return 'indent';

  let rects = ['window', 'stripe1', 'stripe2', 'stripe3', 'stripe4', 'label', 'rimTop', 'rimBottom', 'rimLeft', 'rimRight', 'autoBtn'];
  for (let r of rects) {
    let extra = (r === 'autoBtn') ? pad * 1.5 : 0;
    if (inRect(mx, my, layout[r].x, layout[r].y, layout[r].w + extra, layout[r].h + extra)) return r;
  }
  return null;
}

function handlePointerDown(px, py) {
  initAudio();
  let centerY = height * 0.48;
  mouseZone = getHitZone(px - width / 2, py - centerY);

  if (mouseZone === 'spoolL' && saxVoice) {
    saxVoice.gain.gain.setTargetAtTime(0.25, actx.currentTime, 0.03);
  } else if (mouseZone === 'spoolR' && knobVoice) {
    knobVoice.gain.gain.setTargetAtTime(0.25, actx.currentTime, 0.03);
  } else if (mouseZone === 'autoBtn') {
    toggleAutoplay();
  } else if (mouseZone) {
    impactScale = 1.03;
    triggerSound(mouseZone);
  }
}

function handlePointerUp() {
  if (mouseZone === 'spoolL' && saxVoice) {
    saxVoice.gain.gain.setTargetAtTime(0, actx.currentTime, 0.08);
  }
  if (mouseZone === 'spoolR' && knobVoice) {
    knobVoice.gain.gain.setTargetAtTime(0, actx.currentTime, 0.08);
  }
  mouseZone = null;
}

function mousePressed() {
  handlePointerDown(mouseX, mouseY);
}

function mouseReleased() {
  handlePointerUp();
}

function touchStarted() {
  let ptr = getPointerCoords();
  handlePointerDown(ptr.x, ptr.y);
  return false;
}

function touchEnded() {
  handlePointerUp();
  return false;
}

function keyPressed() {
  initAudio();
  let k = key.toLowerCase();
  if (k === ' ') k = ' ';
  if (keyCode === ENTER) k = 'enter';

  let zone = KEY_MAP[k];
  if (zone && !keyZones.has(zone)) {
    keyZones.add(zone);
    if (zone === 'spoolL' && saxVoice) {
      saxVoice.gain.gain.setTargetAtTime(0.25, actx.currentTime, 0.03);
    } else if (zone === 'spoolR' && knobVoice) {
      knobVoice.gain.gain.setTargetAtTime(0.25, actx.currentTime, 0.03);
    } else if (zone === 'autoBtn') {
      toggleAutoplay();
    } else {
      impactScale = 1.03;
      triggerSound(zone);
    }
  }
}

function keyReleased() {
  let k = key.toLowerCase();
  if (k === ' ') k = ' ';
  if (keyCode === ENTER) k = 'enter';

  let zone = KEY_MAP[k];
  if (zone) {
    keyZones.delete(zone);
    if (zone === 'spoolL' && saxVoice) {
      saxVoice.gain.gain.setTargetAtTime(0, actx.currentTime, 0.08);
    }
    if (zone === 'spoolR' && knobVoice) {
      knobVoice.gain.gain.setTargetAtTime(0, actx.currentTime, 0.08);
    }
  }
}

function toggleAutoplay() {
  impactScale = 1.05;
  isAutoplaying = !isAutoplaying;
  if (isAutoplaying) {
    stepCount = 0;
    lastBeatTime = millis() - beatInterval;
  }
}

function playNote(freq, sustainSec = 0.2) {
  if (!actx) return;
  visualPulse = max(visualPulse, 0.34);
  let now = actx.currentTime;
  let osc = actx.createOscillator();
  let gain = actx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, now);

  gain.gain.setValueAtTime(0.001, now);
  gain.gain.linearRampToValueAtTime(0.28, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.001, now + sustainSec + 0.08);

  osc.connect(gain);
  gain.connect(actx.destination);
  osc.start(now);
  osc.stop(now + sustainSec + 0.1);
}

function playChord(freqs, sustainSec = 2.8) {
  if (!actx) return;
  visualPulse = max(visualPulse, 0.46);
  let now = actx.currentTime;
  freqs.forEach(freq => {
    let osc = actx.createOscillator();
    let gain = actx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.14, now + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.001, now + sustainSec);

    osc.connect(gain);
    gain.connect(actx.destination);
    osc.start(now);
    osc.stop(now + sustainSec + 0.05);
  });
}

function triggerSound(zone) {
  switch (zone) {
    case 'stripe1': playNote(261.63, 0.22); break;
    case 'stripe2': playNote(311.13, 0.22); break;
    case 'stripe3': playNote(349.23, 0.22); break;
    case 'stripe4': playNote(392.00, 0.22); break;
    case 'label':   playChord([261.63, 392.00, 523.25], 3.0); break;

    case 'rimBottom': playKick(); break;
    case 'rimLeft':   playSnare(); break;
    case 'rimTop':    playHiHat(); break;
    case 'rimRight':  playTom(150); break;
    case 'indent':    playTom(80); break;

    case 'window':  playScratch(); break;
    case 'screwTL': playBeep(1200); break;
    case 'screwTR': playBeep(1800); break;
    case 'screwBL': playBeep(800); break;
    case 'screwBR': playBeep(2400); break;
    case 'holeL':   playZap(600, 100); break;
    case 'holeR':   playZap(1200, 200); break;
  }
}

function playKick() {
  if (!actx) return;
  visualPulse = max(visualPulse, 0.5);
  let now = actx.currentTime;
  let osc = actx.createOscillator();
  let gain = actx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(140, now);
  osc.frequency.exponentialRampToValueAtTime(32, now + 0.14);

  gain.gain.setValueAtTime(0.7, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

  osc.connect(gain);
  gain.connect(actx.destination);
  osc.start(now);
  osc.stop(now + 0.24);
}

function playSnare() {
  if (!actx || !noiseBuffer) return;
  visualPulse = max(visualPulse, 0.42);
  let now = actx.currentTime;

  let osc = actx.createOscillator();
  let oGain = actx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(210, now);
  osc.frequency.exponentialRampToValueAtTime(95, now + 0.1);
  oGain.gain.setValueAtTime(0.35, now);
  oGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
  osc.connect(oGain);
  oGain.connect(actx.destination);
  osc.start(now);
  osc.stop(now + 0.14);

  let nSrc = actx.createBufferSource();
  nSrc.buffer = noiseBuffer;
  let filt = actx.createBiquadFilter();
  filt.type = 'bandpass';
  filt.frequency.value = 1800;
  filt.Q.value = 0.8;
  let nGain = actx.createGain();
  nGain.gain.setValueAtTime(0.28, now);
  nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

  nSrc.connect(filt);
  filt.connect(nGain);
  nGain.connect(actx.destination);
  nSrc.start(now);
  nSrc.stop(now + 0.2);
}

function playHiHat() {
  if (!actx || !noiseBuffer) return;
  visualPulse = max(visualPulse, 0.22);
  let now = actx.currentTime;

  let nSrc = actx.createBufferSource();
  nSrc.buffer = noiseBuffer;
  let filt = actx.createBiquadFilter();
  filt.type = 'highpass';
  filt.frequency.value = 6500;
  let gain = actx.createGain();
  gain.gain.setValueAtTime(0.18, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);

  nSrc.connect(filt);
  filt.connect(gain);
  gain.connect(actx.destination);
  nSrc.start(now);
  nSrc.stop(now + 0.07);
}

function playTom(startFreq) {
  if (!actx) return;
  visualPulse = max(visualPulse, 0.4);
  let now = actx.currentTime;
  let osc = actx.createOscillator();
  let gain = actx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(startFreq, now);
  osc.frequency.exponentialRampToValueAtTime(startFreq * 0.45, now + 0.18);

  gain.gain.setValueAtTime(0.55, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

  osc.connect(gain);
  gain.connect(actx.destination);
  osc.start(now);
  osc.stop(now + 0.26);
}

function playBeep(f) {
  if (!actx) return;
  visualPulse = max(visualPulse, 0.25);
  let now = actx.currentTime;
  let osc = actx.createOscillator();
  let gain = actx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(f, now);

  gain.gain.setValueAtTime(0.2, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

  osc.connect(gain);
  gain.connect(actx.destination);
  osc.start(now);
  osc.stop(now + 0.13);
}

function playZap(startF, endF) {
  if (!actx) return;
  visualPulse = max(visualPulse, 0.35);
  let now = actx.currentTime;
  let osc = actx.createOscillator();
  let filt = actx.createBiquadFilter();
  let gain = actx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(startF, now);
  osc.frequency.exponentialRampToValueAtTime(endF, now + 0.2);
  filt.type = 'lowpass';
  filt.frequency.value = 1800;

  gain.gain.setValueAtTime(0.22, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

  osc.connect(filt);
  filt.connect(gain);
  gain.connect(actx.destination);
  osc.start(now);
  osc.stop(now + 0.24);
}

function playScratch() {
  if (!actx || !noiseBuffer) return;
  visualPulse = max(visualPulse, 0.3);
  let now = actx.currentTime;
  let nSrc = actx.createBufferSource();
  nSrc.buffer = noiseBuffer;
  let filt = actx.createBiquadFilter();
  filt.type = 'bandpass';
  filt.frequency.setValueAtTime(700, now);
  filt.frequency.exponentialRampToValueAtTime(1600, now + 0.08);
  filt.frequency.exponentialRampToValueAtTime(500, now + 0.16);
  filt.Q.value = 2.5;

  let gain = actx.createGain();
  gain.gain.setValueAtTime(0.25, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

  nSrc.connect(filt);
  filt.connect(gain);
  gain.connect(actx.destination);
  nSrc.start(now);
  nSrc.stop(now + 0.2);
}