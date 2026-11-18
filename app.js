(function () {
  'use strict';
  const P = window.ImpactPhysics;
  const $ = id => document.getElementById(id);
  const state = { distance: 30, angle: 90, mass: 200, diameter: 6.15, restitution: 1, eMode: 'elastic', measured: null, model: null, time: 0, playing: false, lastFrame: 0 };
  const colors = { red: '#d86c5b', yellow: '#d5a82c' };
  const canvas = $('scene');
  const ctx = canvas.getContext('2d');
  let width = 1, height = 1;

  function number(value, places = 2) {
    if (!Number.isFinite(value)) return '—';
    const n = Math.abs(value) < 0.5 * 10 ** -places ? 0 : value;
    return n.toFixed(places);
  }
  const htmlValue = (value, unit) => `${value} <small>${unit}</small>`;
  const directionAngle = v => P.heading(v);
  const normalAngle = (v, model) => P.magnitude(v) < 1e-8 ? null : Math.atan2(Math.abs(P.dot(v, model.n)), Math.abs(P.dot(v, model.tangent))) * 180 / Math.PI;
  const speed = v => P.magnitude(v);

  function setPlaying(value) {
    state.playing = value;
    $('play').innerHTML = value ? '<span aria-hidden="true">Ⅱ</span> 일시정지' : '<span aria-hidden="true">▶</span> 재생';
    $('play').setAttribute('aria-label', value ? '일시정지' : '재생');
  }

  function setChoices() {
    document.querySelectorAll('[data-distance]').forEach(button => {
      const selected = Number(button.dataset.distance) === state.distance;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    document.querySelectorAll('[data-angle]').forEach(button => {
      const selected = Number(button.dataset.angle) === state.angle;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  }

  function apply() {
    const mass = $('mass').valueAsNumber;
    const diameter = $('diameter').valueAsNumber;
    const eMode = $('coefficient-mode').value;
    const restitution = eMode === 'elastic' ? 1 : $('coefficient-input').valueAsNumber;
    $('coefficient-entry').hidden = eMode !== 'manual';
    try {
      const model = P.calculate({ distance: state.distance, angle: state.angle, mass, diameter, restitution });
      state.mass = mass; state.diameter = diameter; state.restitution = restitution; state.eMode = eMode;
      state.model = model; state.time = 0;
      $('settings-error').textContent = '';
      $('coefficient-error').textContent = '';
      $('compare-result').hidden = true;
      $('compare-error').textContent = '';
      setPlaying(false);
      setChoices();
      render();
    } catch (error) {
      const isCoefficientError = !Number.isFinite(restitution) || restitution < 0 || restitution > 1;
      $(isCoefficientError ? 'coefficient-error' : 'settings-error').textContent = `${error.message} 이전 계산 결과가 유지됩니다.`;
      if (state.model) { state.distance = state.model.distance; state.angle = state.model.angle; }
      setChoices();
    }
  }

  function renderMotion(model) {
    const red = model.red, yellow = model.yellow;
    const rows = [
      ['충돌 전 속력', speed(red.before), speed(yellow.before), 'cm/s'],
      ['충돌 후 속력', speed(red.after), speed(yellow.after), 'cm/s'],
      ['충돌 전 법선 속도', P.dot(red.before, model.n), P.dot(yellow.before, model.n), 'cm/s'],
      ['충돌 후 법선 속도', P.dot(red.after, model.n), P.dot(yellow.after, model.n), 'cm/s'],
      ['충돌 전 접선 속도', P.dot(red.before, model.tangent), P.dot(yellow.before, model.tangent), 'cm/s'],
      ['충돌 후 접선 속도', P.dot(red.after, model.tangent), P.dot(yellow.after, model.tangent), 'cm/s'],
      ['입사각 (접선 기준)', normalAngle(red.before, model), normalAngle(yellow.before, model), '°'],
      ['출사각 (접선 기준)', normalAngle(red.after, model), normalAngle(yellow.after, model), '°'],
      ['충돌 전 방향각', directionAngle(red.before), directionAngle(yellow.before), '°'],
      ['충돌 후 방향각', directionAngle(red.after), directionAngle(yellow.after), '°'],
      ['진행 방향 변화', P.turn(red.before, red.after), P.turn(yellow.before, yellow.after), '°'],
    ];
    $('motion-rows').innerHTML = rows.map(([label, r, y, unit]) => `<tr><th scope="row">${label}</th><td>${number(r)} <span class="unit">${unit}</span></td><td>${number(y)} <span class="unit">${unit}</span></td></tr>`).join('');
  }

  function renderMatrix(model) {
    $('matrix-rows').innerHTML = P.DISTANCES.map(distance => {
      const v = P.calculate({ distance, angle: 90, mass: model.mass, diameter: model.diameter, restitution: model.restitution }).speedCm;
      const cells = P.ANGLES.map(angle => {
        const result = P.calculate({ distance, angle, mass: model.mass, diameter: model.diameter, restitution: model.restitution });
        const selected = distance === model.distance && angle === model.angle;
        return `<td class="${selected ? 'selected-cell' : ''}"${selected ? ' aria-label="현재 선택 조건"' : ''}>${number(speed(result.red.after))}</td>`;
      }).join('');
      return `<tr><th scope="row">${distance} cm</th><td>${number(v)} cm/s</td>${cells}</tr>`;
    }).join('');
  }

  function render() {
    const m = state.model;
    if (!m) return;
    $('summary-distance').innerHTML = htmlValue(m.distance, 'cm');
    $('summary-angle').innerHTML = `${m.angle}<small>°</small>`;
    $('summary-speed').innerHTML = htmlValue(number(m.speedCm), 'cm/s');
    $('summary-e').textContent = number(m.coefficient, 3);
    $('height-setting').textContent = `${number(m.heightCm, 3)} cm`;
    $('result-e').textContent = number(m.coefficient, 3);
    $('e-caption-text').textContent = state.eMode === 'elastic' ? '완전탄성 추가 가정' : '직접 입력한 모델 값';
    $('approach').textContent = `${number(m.approach)} cm/s`;
    $('separation').textContent = `${number(m.separation)} cm/s`;
    $('impulse').textContent = `${number(m.impulse, 4)} N·s`;
    $('energy-loss').textContent = `${number(m.energyLoss, 5)} J`;
    $('contact-time').textContent = `${number(m.contactTime, 3)} s`;
    $('detail-condition').textContent = `${m.distance} cm · ${m.angle}°`;
    $('formula-height').textContent = `h = ${number(m.heightCm, 3)} cm  ·  v = ${number(m.speedCm)} cm/s`;
    $('formula-e').textContent = `모델에 적용한 e = ${number(m.coefficient, 3)} (분리 ${number(m.separation)} / 접근 ${number(m.approach)})`;
    renderMotion(m);
    renderMatrix(m);
    updateTime();
  }

  function updateTime() {
    if (!state.model) return;
    $('clock').textContent = `${number(state.time)} s`;
    $('duration').textContent = `${number(state.model.duration)} s`;
    $('timeline').value = Math.round(state.time / state.model.duration * 1000);
    const m = state.model;
    $('canvas-state').textContent = state.time <= 0.001 ? '출발 준비' : state.time < m.rollTime ? '레일에서 이동 중' : state.time < m.contactTime ? '충돌 전' : '충돌 후';
    draw();
  }

  function createTransform(m) {
    const afterTime = m.duration - m.contactTime;
    const points = [];
    for (const key of ['yellow', 'red']) {
      const b = m[key];
      points.push(P.sub(b.exit, P.mul(b.direction, P.LENGTH_CM * P.SLOPE_COSINE)), b.exit, b.start, b.contact, P.add(b.contact, P.mul(b.after, afterTime)));
    }
    let minX = Math.min(...points.map(p => p[0] - m.diameter));
    let maxX = Math.max(...points.map(p => p[0] + m.diameter));
    let minY = Math.min(...points.map(p => p[1] - m.diameter));
    let maxY = Math.max(...points.map(p => p[1] + m.diameter));
    if (maxX - minX < 70) { const middle = (maxX + minX) / 2; minX = middle - 35; maxX = middle + 35; }
    if (maxY - minY < 70) { const middle = (maxY + minY) / 2; minY = middle - 35; maxY = middle + 35; }
    const scale = Math.min(Math.max(20, width - 48) / (maxX - minX), Math.max(20, height - 86) / (maxY - minY));
    const centerX = (minX + maxX) / 2, centerY = (minY + maxY) / 2;
    return { scale, point: p => [width / 2 + (p[0] - centerX) * scale, height / 2 + (p[1] - centerY) * scale] };
  }

  function strokeWorld(points, transform, color, lineWidth, dash = []) {
    ctx.beginPath();
    points.forEach((p, i) => { const xy = transform.point(p); if (i === 0) ctx.moveTo(xy[0], xy[1]); else ctx.lineTo(xy[0], xy[1]); });
    ctx.strokeStyle = color; ctx.lineWidth = lineWidth; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.setLineDash(dash); ctx.stroke(); ctx.setLineDash([]);
  }

  function arrowWorld(a, b, transform, color) {
    const p = transform.point(a), q = transform.point(b);
    if (Math.hypot(q[0] - p[0], q[1] - p[1]) < 1) return;
    const theta = Math.atan2(q[1] - p[1], q[0] - p[0]);
    ctx.beginPath();
    ctx.moveTo(q[0], q[1]);
    ctx.lineTo(q[0] - 8 * Math.cos(theta - .45), q[1] - 8 * Math.sin(theta - .45));
    ctx.moveTo(q[0], q[1]);
    ctx.lineTo(q[0] - 8 * Math.cos(theta + .45), q[1] - 8 * Math.sin(theta + .45));
    ctx.strokeStyle = color; ctx.lineWidth = 1.6; ctx.setLineDash([]); ctx.stroke();
  }

  function drawBall(key, transform, usedLabels) {
    const m = state.model, ball = m[key];
    const point = transform.point(P.position(m, key, state.time));
    const r = Math.max(5, (m.diameter / 2) * transform.scale);
    ctx.save();
    ctx.shadowColor = 'rgba(42,65,45,.16)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
    ctx.beginPath(); ctx.arc(point[0], point[1], r, 0, Math.PI * 2);
    ctx.fillStyle = key === 'red' ? '#db7564' : '#e3bb52'; ctx.fill();
    ctx.shadowColor = 'transparent'; ctx.lineWidth = 1; ctx.strokeStyle = key === 'red' ? '#c45e50' : '#c79c33'; ctx.stroke();
    ctx.beginPath(); ctx.arc(point[0] - r * .28, point[1] - r * .29, Math.max(1.5, r * .19), 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fill(); ctx.restore();
    const currentSpeed = state.time < m.rollTime ? m.speedCm * state.time / m.rollTime : state.time < m.contactTime ? m.speedCm : speed(ball.after);
    const label = `${key === 'red' ? '빨강' : '노랑'} ${number(currentSpeed, 1)} cm/s`;
    ctx.font = '600 10px sans-serif';
    const w = ctx.measureText(label).width + 12;
    const x = Math.max(5, Math.min(width - w - 5, point[0] - w / 2));
    let y = Math.max(30, point[1] - r - 23);
    if (usedLabels.some(other => x < other.x + other.w && x + w > other.x && Math.abs(y - other.y) < 19)) y = Math.max(30, y - 20);
    usedLabels.push({ x, y, w });
    ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.beginPath(); ctx.roundRect(x, y, w, 18, 4); ctx.fill();
    ctx.fillStyle = '#657e6b'; ctx.fillText(label, x + 6, y + 12.5);
  }

  function draw() {
    const m = state.model;
    if (!m || width < 2 || height < 2) return;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#f3f7ef'; ctx.fillRect(0, 0, width, height);
    const transform = createTransform(m), origin = transform.point([0, 0]);
    const grid = Math.max(18, transform.scale * 10);
    ctx.strokeStyle = 'rgba(128,159,132,.105)'; ctx.lineWidth = 1; ctx.beginPath();
    for (let x = ((origin[0] % grid) + grid) % grid; x < width; x += grid) { ctx.moveTo(x, 0); ctx.lineTo(x, height); }
    for (let y = ((origin[1] % grid) + grid) % grid; y < height; y += grid) { ctx.moveTo(0, y); ctx.lineTo(width, y); }
    ctx.stroke();
    const afterTime = m.duration - m.contactTime;
    for (const key of ['yellow', 'red']) {
      const b = m[key], railStart = P.sub(b.exit, P.mul(b.direction, P.LENGTH_CM * P.SLOPE_COSINE));
      const railColor = key === 'red' ? 'rgba(213,131,118,.24)' : 'rgba(211,181,89,.24)';
      const activeColor = key === 'red' ? 'rgba(210,107,91,.34)' : 'rgba(217,173,56,.40)';
      strokeWorld([railStart, b.exit], transform, railColor, Math.max(7, m.diameter * 1.5 * transform.scale));
      strokeWorld([b.start, b.exit], transform, activeColor, Math.max(7, m.diameter * 1.5 * transform.scale));
      strokeWorld([b.exit, b.contact], transform, key === 'red' ? 'rgba(191,113,98,.56)' : 'rgba(171,142,54,.6)', 1.4);
      const end = P.add(b.contact, P.mul(b.after, afterTime));
      strokeWorld([b.contact, end], transform, colors[key], 1.6, [5, 5]);
      arrowWorld(b.contact, end, transform, colors[key]);
    }
    ctx.beginPath(); ctx.arc(origin[0], origin[1], Math.max(4, m.diameter * .8 * transform.scale), 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(101,145,106,.48)'; ctx.lineWidth = 1; ctx.setLineDash([3, 4]); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#88a88b'; ctx.beginPath(); ctx.arc(origin[0], origin[1], 2, 0, Math.PI * 2); ctx.fill();
    const labels = [];
    drawBall('yellow', transform, labels); drawBall('red', transform, labels);
    ctx.font = '10px sans-serif'; ctx.fillStyle = '#a1b3a3'; ctx.fillText('접촉점', Math.min(width - 45, origin[0] + 9), Math.max(28, origin[1] - 8));
  }

  document.querySelectorAll('[data-distance]').forEach(button => button.addEventListener('click', () => { state.distance = Number(button.dataset.distance); apply(); }));
  document.querySelectorAll('[data-angle]').forEach(button => button.addEventListener('click', () => { state.angle = Number(button.dataset.angle); apply(); }));
  $('mass').addEventListener('change', apply);
  $('diameter').addEventListener('change', apply);
  $('coefficient-mode').addEventListener('change', apply);
  $('coefficient-input').addEventListener('input', () => {
    const value = $('coefficient-input').valueAsNumber;
    if (Number.isFinite(value) && value >= 0 && value <= 1) apply();
    else $('coefficient-error').textContent = 'e는 0 이상 1 이하로 입력해 주세요. 이전 계산 결과가 유지됩니다.';
  });
  $('coefficient-input').addEventListener('change', apply);
  $('play').addEventListener('click', () => { if (!state.model) return; if (state.time >= state.model.duration) state.time = 0; setPlaying(!state.playing); updateTime(); });
  $('reset').addEventListener('click', () => { setPlaying(false); state.time = 0; updateTime(); });
  $('contact').addEventListener('click', () => { if (!state.model) return; setPlaying(false); state.time = state.model.contactTime; updateTime(); });
  $('timeline').addEventListener('input', () => { if (!state.model) return; setPlaying(false); state.time = Number($('timeline').value) / 1000 * state.model.duration; updateTime(); });

  function compare() {
    const ids = ['red-before', 'red-after', 'yellow-before', 'yellow-after'];
    const entries = ids.map(id => $(id).value.trim());
    if (entries.some(value => value === '')) {
      $('compare-result').hidden = true;
      $('compare-error').textContent = '빨강 공과 노랑 공의 충돌 전후 법선 속도 네 값을 모두 입력해 주세요.';
      return;
    }
    try {
      const measured = P.measuredCoefficient({ redBefore: Number(entries[0]), redAfter: Number(entries[1]), yellowBefore: Number(entries[2]), yellowAfter: Number(entries[3]) });
      state.measured = measured.coefficient;
      $('compare-error').textContent = '';
      $('compare-ideal').textContent = number(state.model.coefficient, 3);
      $('compare-measured').textContent = number(measured.coefficient, 3);
      $('compare-difference').textContent = number(state.model.coefficient - measured.coefficient, 3);
      const applicable = measured.coefficient >= 0 && measured.coefficient <= 1;
      $('use-measured').disabled = !applicable;
      $('compare-message').textContent = applicable ? '실험 e는 측정한 법선 상대속도에서 계산했습니다.' : '측정 e가 이 모델의 0~1 범위를 벗어났습니다. 부호와 측정값을 확인하세요. 계산값은 그대로 표시합니다.';
      $('compare-result').hidden = false;
    } catch (error) {
      $('compare-result').hidden = true;
      $('compare-error').textContent = error.message;
    }
  }
  $('compare').addEventListener('click', compare);
  $('use-measured').addEventListener('click', () => {
    if (!Number.isFinite(state.measured) || state.measured < 0 || state.measured > 1) return;
    $('coefficient-mode').value = 'manual';
    $('coefficient-input').value = String(state.measured);
    apply();
    compare();
    $('compare-message').textContent = '이 시행의 실험 e를 모델에 적용했습니다. 다른 시행으로 예측을 검증하세요.';
  });
  ['red-before', 'red-after', 'yellow-before', 'yellow-after'].forEach(id => $(id).addEventListener('input', () => {
    state.measured = null; $('compare-result').hidden = true; $('compare-error').textContent = '';
  }));
  $('clear-measurements').addEventListener('click', () => {
    ['red-before', 'red-after', 'yellow-before', 'yellow-after'].forEach(id => { $(id).value = ''; });
    state.measured = null; $('compare-result').hidden = true; $('compare-error').textContent = '';
  });

  $('download').addEventListener('click', () => {
    const rows = [['출발거리(cm)', '배치각(도)', '출발높이(cm)', '충돌 전 속력(cm/s)', '빨강 충돌 후 속력(cm/s)', '노랑 충돌 후 속력(cm/s)', '충돌 전 접근속력(cm/s)', '충돌 후 분리속력(cm/s)', '모델에 적용한 e', 'e 출처', '공통 질량(g)', '공통 지름(cm)']];
    for (const distance of P.DISTANCES) for (const angle of P.ANGLES) {
      const m = P.calculate({ distance, angle, mass: state.mass, diameter: state.diameter, restitution: state.restitution });
      rows.push([m.distance, m.angle, number(m.heightCm, 4), number(m.speedCm, 4), number(speed(m.red.after), 4), number(speed(m.yellow.after), 4), number(m.approach, 4), number(m.separation, 4), number(m.coefficient, 4), state.eMode === 'elastic' ? '완전탄성 가정' : '직접 입력', m.mass, m.diameter]);
    }
    const csv = '\uFEFF' + rows.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = '함성프로젝트_전체조건_시뮬레이션.csv'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  new ResizeObserver(entries => {
    const rect = entries[0].contentRect;
    width = rect.width; height = rect.height;
    if (width < 1 || height < 1) return;
    const density = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * density); canvas.height = Math.round(height * density);
    ctx.setTransform(density, 0, 0, density, 0, 0); draw();
  }).observe(canvas.parentElement);

  function animate(timestamp) {
    const delta = state.lastFrame ? Math.min((timestamp - state.lastFrame) / 1000, .05) : 0;
    state.lastFrame = timestamp;
    if (state.playing && state.model) {
      state.time = Math.min(state.model.duration, state.time + delta * Number($('rate').value));
      if (state.time >= state.model.duration) setPlaying(false);
      updateTime();
    }
    requestAnimationFrame(animate);
  }
  apply();
  requestAnimationFrame(animate);
})();
