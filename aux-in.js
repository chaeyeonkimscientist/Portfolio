/* AUX IN patch cable: appears after Selected Work. Plug-in opens more/index.html. */
(function () {
  'use strict';

  const scene = document.getElementById('aux-in');
  if (!scene) return;

  const plugWrapper = document.getElementById('plug-wrapper');
  const plugBody = document.getElementById('plug-body');
  const wirePathBg = document.getElementById('wire-path-bg');
  const wirePathFg = document.getElementById('wire-path-fg');
  const wirePathHl = document.getElementById('wire-path-hl');
  const jackTarget = document.getElementById('jack-target');
  const jackHole = document.getElementById('jack-hole');
  const jackLabel = document.getElementById('jack-label');
  const instructionText = document.getElementById('instruction-text');
  if (!plugWrapper || !jackTarget) return;

  const MORE_URL = 'more/index.html';
    const SNAP_DISTANCE = 220;
  const LERP_FACTOR = 0.15;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let active = false;
  let mouseX = innerWidth / 3;
  let mouseY = innerHeight / 2;
  let currentWireOffset = 160;
  let currentX = mouseX;
  let currentY = mouseY;
  let currentAngle = 0;
  let isSnapped = false;
  let isPlugged = false;
  let jackCenterX = 0;
  let jackCenterY = 0;
  let opening = false;

  function measureJack() {
    const hole = document.getElementById('jack-hole') || jackTarget;
    const r = hole.getBoundingClientRect();
    jackCenterX = r.left + r.width / 2;
    jackCenterY = r.top + r.height / 2;
  }

  function setActive(on) {
    active = !!on;
    if (active) measureJack();
    if (!active && isPlugged && !opening) {
      isPlugged = false;
      isSnapped = false;
      plugBody.classList.remove('inserted');
      jackLabel.classList.remove('active');
      jackHole.classList.remove('pulse');
      jackLabel.innerText = 'More Projects';
      if (instructionText) instructionText.style.opacity = '0.8';
    }
  }
  window.__setAuxIn = setActive;

  if (reduced) {
    scene.style.cursor = 'pointer';
    scene.addEventListener('click', () => {
      location.href = MORE_URL;
    });
    return;
  }

  addEventListener('mousemove', (e) => {
    if (!active || isPlugged) return;
    mouseX = e.clientX;
    mouseY = e.clientY;
  });
  addEventListener('resize', () => {
    if (active) measureJack();
  });
  scene.addEventListener('click', tryPlug);
  addEventListener('click', tryPlug);
  document.querySelector('#aux-in .jack-bezel')?.addEventListener('click', (e) => {
    e.stopPropagation();
    isSnapped = true;
    tryPlug();
  });

  function tryPlug() {
    if (!active || opening || isPlugged) return;
    measureJack();
    const dx = jackCenterX - mouseX;
    const dy = jackCenterY - mouseY;
    const near = Math.sqrt(dx * dx + dy * dy) < SNAP_DISTANCE * 1.4;
    if (!(isSnapped || near)) return;
    isPlugged = true;
    plugBody.classList.add('inserted');
    jackLabel.classList.add('active');
    if (instructionText) instructionText.style.opacity = '0';
    setTimeout(() => {
      jackHole.classList.add('pulse');
      setTimeout(() => {
        jackHole.classList.remove('pulse');
        setTimeout(() => {
          opening = true;
          jackLabel.innerText = 'SIGNAL ROUTED — OPENING...';
          location.href = MORE_URL;
        }, 600);
      }, 150);
    }, 100);
  }

  function animate() {
    requestAnimationFrame(animate);
    if (!active && !isPlugged) return;
    measureJack();
    const origin = scene.getBoundingClientRect();
    const originLeft = origin.left;
    const originTop = origin.top;

    const dx = jackCenterX - mouseX;
    const dy = jackCenterY - mouseY;
    const distanceToJack = Math.sqrt(dx * dx + dy * dy);

    let targetX, targetY, targetAngle;
    if (isPlugged) {
      targetX = jackCenterX;
      targetY = jackCenterY;
      targetAngle = 0;
      isSnapped = true;
    } else if (distanceToJack < SNAP_DISTANCE) {
      isSnapped = true;
      targetX = jackCenterX - 45;
      targetY = jackCenterY;
      targetAngle = 0;
      jackLabel.style.color = '#d9d9d9';
      scene.style.cursor = 'pointer';
      if (instructionText) instructionText.textContent = 'Click to plug in';
    } else {
      isSnapped = false;
      targetX = mouseX;
      targetY = mouseY;
      const vx = targetX - currentX;
      const vy = targetY - currentY;
      if (Math.abs(vx) > 1 || Math.abs(vy) > 1) {
        targetAngle = Math.atan2(vy, vx);
      } else {
        targetAngle = currentAngle;
      }
      jackLabel.style.color = '';
      scene.style.cursor = 'default';
      if (instructionText) instructionText.textContent = 'Drag cable near the jack to snap, then click to plug in';
    }

    currentX += (targetX - currentX) * LERP_FACTOR;
    currentY += (targetY - currentY) * LERP_FACTOR;
    let angleDiff = targetAngle - currentAngle;
    angleDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));
    currentAngle += angleDiff * (LERP_FACTOR * 1.5);

    plugWrapper.style.transform =
      'translate(' + (currentX - originLeft - 160) + 'px, ' + (currentY - originTop - 15) + 'px) rotate(' + currentAngle + 'rad)';

    const targetWireOffset = isPlugged ? 20 : 160;
    currentWireOffset += (targetWireOffset - currentWireOffset) * LERP_FACTOR;

    const startX = -100;
    const startY = scene.clientHeight + 20;
    const endX = currentX - originLeft - Math.cos(currentAngle) * currentWireOffset;
    const endY = currentY - originTop - Math.sin(currentAngle) * currentWireOffset;
    const cp1X = startX + (endX - startX) * 0.5;
    const cp1Y = scene.clientHeight + 200;
    const cp2X = endX;
    const cp2Y = endY + 300;
    const pathData = 'M ' + startX + ' ' + startY +
      ' C ' + cp1X + ' ' + cp1Y + ', ' + cp2X + ' ' + cp2Y + ', ' + endX + ' ' + endY;
    if (wirePathBg) wirePathBg.setAttribute('d', pathData);
    if (wirePathFg) wirePathFg.setAttribute('d', pathData);
    if (wirePathHl) wirePathHl.setAttribute('d', pathData);
  }

  animate();
})();
