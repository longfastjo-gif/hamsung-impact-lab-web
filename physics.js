/* 함성 프로젝트 · 2차원 당구공 충돌 계산 모듈 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ImpactPhysics = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';

  const LENGTH_CM = 110;
  const HEIGHT_CM = 6.2;
  const GRAVITY = 9.81;
  const SLOPE_COSINE = Math.sqrt(1 - (HEIGHT_CM / LENGTH_CM) ** 2);
  const DISTANCES = [30, 60, 90];
  const ANGLES = [45, 90, 135, 180];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const mul = (a, n) => [a[0] * n, a[1] * n];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
  const magnitude = v => Math.hypot(v[0], v[1]);
  const heading = v => {
    if (magnitude(v) < 1e-10) return null;
    const degrees = (Math.atan2(v[1], v[0]) * 180 / Math.PI + 360) % 360;
    return Math.abs(degrees - 360) < 1e-8 ? 0 : degrees;
  };
  const turn = (from, to) => {
    const a = heading(from), b = heading(to);
    if (a === null || b === null) return null;
    return ((b - a + 540) % 360) - 180;
  };

  function calculate({ distance = 30, angle = 90, mass = 200, diameter = 6.15, restitution = 1 } = {}) {
    distance = Number(distance); angle = Number(angle);
    mass = Number(mass); diameter = Number(diameter); restitution = Number(restitution);
    if (!DISTANCES.includes(distance) || !ANGLES.includes(angle)) {
      throw new Error('실험 계획의 출발 위치와 레일 각도를 선택해 주세요.');
    }
    if (!Number.isFinite(mass) || mass <= 0 || mass > 5000) {
      throw new Error('두 공의 공통 질량은 0보다 크고 5,000g 이하여야 합니다.');
    }
    if (!Number.isFinite(diameter) || diameter <= 0 || diameter > 50) {
      throw new Error('두 공의 공통 지름은 0보다 크고 50cm 이하여야 합니다.');
    }
    if (!Number.isFinite(restitution) || restitution < 0 || restitution > 1) {
      throw new Error('모델 반발계수 e는 0 이상 1 이하의 숫자여야 합니다.');
    }

    // 완전히 매끄러운 레일에서 정지해 있던 공은 미끄러진다.
    // 회전 에너지가 증가하지 않으므로 mgh = 1/2 mv².
    const heightCm = HEIGHT_CM * distance / LENGTH_CM;
    const speedMs = Math.sqrt(2 * GRAVITY * heightCm / 100);
    const speedCm = speedMs * 100;
    const half = angle * Math.PI / 360;
    const n = [1, 0];
    const tangent = [0, 1];
    const yellowDirection = [Math.sin(half), Math.cos(half)];
    const redDirection = [-Math.sin(half), Math.cos(half)];
    const yellowBefore = mul(yellowDirection, speedCm);
    const redBefore = mul(redDirection, speedCm);
    const approach = dot(sub(yellowBefore, redBefore), n);

    // 마찰 유무만으로 e는 정해지지 않는다. 명시적으로 지정된 e를 사용한다.
    const massKg = mass / 1000;
    const impulse = (1 + restitution) * (approach / 100) / (2 / massKg);
    const deltaCm = impulse / massKg * 100;
    const yellowAfter = sub(yellowBefore, mul(n, deltaCm));
    const redAfter = add(redBefore, mul(n, deltaCm));
    const separation = dot(sub(redAfter, yellowAfter), n);
    const coefficient = separation / approach;
    const radius = diameter / 2;
    const gap = diameter * 2;
    const yellowContact = [-radius, 0];
    const redContact = [radius, 0];
    const yellowExit = sub(yellowContact, mul(yellowDirection, gap));
    const redExit = sub(redContact, mul(redDirection, gap));
    // 위에서 보는 화면에는 빗면 거리의 수평 성분을 표시한다.
    const planDistance = distance * SLOPE_COSINE;
    const yellowStart = sub(yellowExit, mul(yellowDirection, planDistance));
    const redStart = sub(redExit, mul(redDirection, planDistance));
    const rollTime = 2 * distance / speedCm;
    const contactTime = rollTime + gap / speedCm;
    const duration = contactTime + 0.85;
    const translationalEnergy = massKg * speedMs ** 2;
    const afterEnergy = massKg * (dot(redAfter, redAfter) + dot(yellowAfter, yellowAfter)) / 20000;
    const energyLoss = Math.max(0, translationalEnergy - afterEnergy);

    return {
      distance, angle, mass, diameter, restitution, heightCm, speedMs, speedCm, planDistance,
      n, tangent, coefficient, approach, separation, impulse,
      translationalEnergy, afterEnergy, energyLoss, rollTime, contactTime, duration, gap,
      yellow: { direction: yellowDirection, before: yellowBefore, after: yellowAfter, contact: yellowContact, exit: yellowExit, start: yellowStart },
      red: { direction: redDirection, before: redBefore, after: redAfter, contact: redContact, exit: redExit, start: redStart },
    };
  }

  function position(model, name, time) {
    const ball = model[name];
    const t = Math.max(0, Math.min(Number(time), model.duration));
    if (t < model.rollTime) {
      const fraction = t / model.rollTime;
      return add(ball.start, mul(ball.direction, model.planDistance * fraction * fraction));
    }
    if (t < model.contactTime) {
      return add(ball.exit, mul(ball.direction, model.speedCm * (t - model.rollTime)));
    }
    return add(ball.contact, mul(ball.after, t - model.contactTime));
  }

  function measuredCoefficient({ yellowBefore, redBefore, yellowAfter, redAfter }) {
    const values = [yellowBefore, redBefore, yellowAfter, redAfter].map(Number);
    if (!values.every(Number.isFinite)) throw new Error('네 법선 속도를 모두 숫자로 입력해 주세요.');
    const [yb, rb, ya, ra] = values;
    const approach = yb - rb;
    if (approach <= 1e-9) throw new Error('충돌 전에는 노랑 공의 법선 속도 − 빨강 공의 법선 속도가 양수여야 합니다. 법선 방향과 부호를 확인해 주세요.');
    return { coefficient: (ra - ya) / approach, approach, separation: ra - ya };
  }

  return { LENGTH_CM, HEIGHT_CM, GRAVITY, SLOPE_COSINE, DISTANCES, ANGLES, add, sub, mul, dot, magnitude, heading, turn, calculate, position, measuredCoefficient };
});
