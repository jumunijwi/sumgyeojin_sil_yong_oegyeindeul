const Engine = Matter.Engine;
const Bodies = Matter.Bodies;
const Composite = Matter.Composite;
const Constraint = Matter.Constraint;

let engine;
let ghosts = []; // 유령들을 담을 배열
let smokes = []; // 터진 유령의 연기 파티클들을 담을 배열

// 시간 및 낮/밤 상태 관리
let isNight = false;
let cycleDuration = 40000;

// 유령 순차적 소환을 위한 변수
let targetGhostCount = 20;
let spawnedGhostCount = 0;
let availableXSlots = [];

// 색상 변수
let colorDay, colorNight, windowDay, windowNight;

function setup() {
  createCanvas(windowWidth, windowHeight);
  engine = Engine.create();

  // 바닥을 없애고 양옆 벽만 남김
  let margin = 20;
  Composite.add(engine.world, [
    Bodies.rectangle(margin, height / 2, margin, height, { isStatic: true }),
    Bodies.rectangle(width - margin, height / 2, margin, height, {
      isStatic: true,
    }),
  ]);

  // 색상 미리 정의
  colorDay = color("#85FFDD"); // 민트색 밝은 배경
  colorNight = color("#3A3B40"); // 어두운 밤 배경
  windowDay = color("#8EE4FF"); // 창문 낮 하늘
  windowNight = color("#0A0830"); // 창문 밤 하늘
}

function draw() {
  Engine.update(engine);

  // ==========================================
  // 1. 낮/밤 시간 계산 (낮은 짧고, 밤은 길게)
  // ==========================================
  let cycle = (millis() % cycleDuration) / cycleDuration;
  let transition = 0;

  if (cycle < 0.05) {
    transition = 0;
  } else if (cycle < 0.15) {
    let t = map(cycle, 0.05, 0.15, 0, 1);
    transition = (sin(t * PI - HALF_PI) + 1) / 2;
  } else if (cycle < 0.95) {
    transition = 1;
  } else {
    let t = map(cycle, 0.95, 1.0, 0, 1);
    transition = (sin(t * PI + HALF_PI) + 1) / 2;
  }

  // 상태 변화 감지 (유령 생성 시작 / 낮밤 전환)
  if (transition > 0.8 && !isNight) {
    isNight = true;
    spawnedGhostCount = 0;
  } else if (transition < 0.2 && isNight) {
    isNight = false;
  }

  // 밤이고, 아직 목표 마리수만큼 다 소환하지 않았다면?
  if (isNight && spawnedGhostCount < targetGhostCount) {
    if (frameCount % 120 === 0) {
      spawnSingleGhost();
      spawnedGhostCount++;
    }
  }

  // ==========================================
  // 2. 배경 및 창문 그리기 (그라데이션)
  // ==========================================
  let currentBg = lerpColor(colorDay, colorNight, transition);
  background(currentBg);

  // 창문 프레임
  let windowX = width / 4 - 45;
  let windowY = height / 3;
  let windowW = 200;
  let windowH = 250;

  rectMode(CENTER);
  stroke(lerpColor(color("#888888"), color("#555555"), transition));
  strokeWeight(10);
  let currentWindowSky = lerpColor(windowDay, windowNight, transition);
  fill(currentWindowSky);
  rect(windowX, windowY, windowW, windowH);

  // 해와 달
  noStroke();
  let alphaDay = map(transition, 0.5, 0, 0, 255);
  fill(255, 235, 100, alphaDay);
  drawStar(windowX - 20, windowY - 30, 25, 50, 8);

  let alphaNight = map(transition, 0.5, 1, 0, 255);
  fill(255, 235, 100, alphaNight);
  circle(windowX - 20, windowY - 30, 90);
  fill(
    red(currentWindowSky),
    green(currentWindowSky),
    blue(currentWindowSky),
    alphaNight,
  );
  circle(windowX - 5, windowY - 45, 60);

  // ==========================================
  // 3. 유령 그리기, 손전등 퇴치 및 페이드아웃 처리
  // ==========================================
  let ghostAlpha = 255;
  if (transition < 0.2) {
    ghostAlpha = map(transition, 0, 0.2, 0, 255);
  }
  ghostAlpha = constrain(ghostAlpha, 0, 255);

  let flashlightRadius = 130; // 손전등 불빛 원형 반경

  for (let i = ghosts.length - 1; i >= 0; i--) {
    let ghost = ghosts[i];

    // 손전등 빛에 닿았는지 판정 (밤이고 마우스를 누르고 있을 때만)
    let inLight = false;
    let shakeX = 0;
    let shakeY = 0;

    if (mouseIsPressed && isNight && ghostAlpha > 200) {
      let d = dist(
        mouseX,
        mouseY,
        ghost.head.position.x,
        ghost.head.position.y,
      );
      if (d < flashlightRadius) {
        inLight = true;
        ghost.exorcismProgress++; // 빛을 받는 동안 퇴치 게이지 누적
        shakeX = random(-5, 5); // 덜덜 떨리는 효과 (진동)
        shakeY = random(-5, 5);
      } else {
        if (ghost.exorcismProgress > 0) ghost.exorcismProgress--;
      }
    } else {
      if (ghost.exorcismProgress > 0) ghost.exorcismProgress--;
    }

    // 빛을 충분히 받아 게이지가 차면 펑 하고 터짐!
    if (ghost.exorcismProgress > 45) {
      createSmoke(ghost.head.position.x, ghost.head.position.y);
      Composite.remove(engine.world, ghost.head);
      if (ghost.string) Composite.remove(engine.world, ghost.string);
      ghosts.splice(i, 1);
      continue;
    }

    // 줄이 끊어지지 않았다면 빨간 줄 그리기
    if (ghost.string && ghostAlpha > 5) {
      stroke(211, 47, 47, ghostAlpha);
      strokeWeight(3);
      line(
        ghost.string.pointA.x,
        ghost.string.pointA.y,
        ghost.head.position.x,
        ghost.head.position.y,
      );
    }

    push();
    translate(ghost.head.position.x + shakeX, ghost.head.position.y + shakeY);
    rotate(ghost.head.angle);

    // 1. 치마 회색 그림자
    noStroke();
    fill(176, 176, 176, ghostAlpha);
    beginShape();
    vertex(-55, 80);
    vertex(-20, 115);
    vertex(-20, 95);
    endShape(CLOSE);

    beginShape();
    vertex(20, 60);
    vertex(8, 85);
    vertex(40, 90);
    endShape(CLOSE);

    // 2. 메인 흰색 치마
    fill(inLight ? color(255, 200, 200) : color(255), ghostAlpha);
    beginShape();
    vertex(-12, 22);
    vertex(-55, 80);
    vertex(-20, 95);
    vertex(-20, 102);
    vertex(-5, 115);
    vertex(20, 60);
    vertex(40, 90);
    vertex(60, 60);
    vertex(12, 22);
    endShape(CLOSE);

    // 3. 하얀 머리
    noStroke();
    fill(inLight ? color(255, 200, 200) : color(255), ghostAlpha);
    circle(0, 0, 50);

    // 4. 빨간 목줄
    stroke(211, 47, 47, ghostAlpha);
    strokeCap(ROUND);
    strokeWeight(8);
    line(-15, 20, 15, 20);

    // 5. 원래의 슬픈 얼굴 형태 유지
    fill(0, ghostAlpha);
    noStroke();
    circle(-10, -5, 8);
    circle(10, -5, 8);
    arc(0, 8, 14, 16, PI, TWO_PI);
    pop();

    // 화면 아래로 떨어졌거나 낮이 되어 투명해졌을 때 삭제
    if (
      ghost.head.position.y > height + 100 ||
      (transition === 0 && ghostAlpha <= 5)
    ) {
      Composite.remove(engine.world, ghost.head);
      if (ghost.string) Composite.remove(engine.world, ghost.string);
      ghosts.splice(i, 1);

      if (ghosts.length === 0) {
        availableXSlots = [];
      }
    }
  }

  // ==========================================
  // 4. 연기(Smoke) 파티클 업데이트 및 그리기
  // ==========================================
  for (let s = smokes.length - 1; s >= 0; s--) {
    let sm = smokes[s];
    sm.x += sm.vx;
    sm.y += sm.vy;
    sm.alpha -= 5;
    sm.size += 0.8;

    noStroke();
    fill(220, 220, 220, sm.alpha);
    circle(sm.x, sm.y, sm.size);

    if (sm.alpha <= 0) {
      smokes.splice(s, 1);
    }
  }

  // ==========================================
  // 5. 마우스를 누를 때 [손전등 불빛] + [줄 자르기 드래그] 동시 작동
  // ==========================================
  if (mouseIsPressed && isNight) {
    // (1) 손전등 원형 불빛 그리기
    push();
    noStroke();
    for (let r = flashlightRadius; r > 0; r -= 15) {
      let alpha = map(r, 0, flashlightRadius, 140, 0);
      fill(255, 255, 200, alpha);
      circle(mouseX, mouseY, r * 2);
    }
    pop();

    // (2) 마우스 드래그로 빨간 줄 자르기 검사 복구
    for (let i = 0; i < ghosts.length; i++) {
      let ghost = ghosts[i];
      if (ghost.string) {
        let x1 = ghost.string.pointA.x;
        let y1 = ghost.string.pointA.y;
        let x2 = ghost.head.position.x;
        let y2 = ghost.head.position.y;

        let hit = lineIntersect(
          pmouseX,
          pmouseY,
          mouseX,
          mouseY,
          x1,
          y1,
          x2,
          y2,
        );
        if (hit) {
          Composite.remove(engine.world, ghost.string);
          ghost.string = null; // 줄 끊어짐
        }
      }
    }
  }
}

// ==========================================
// 유령이 터졌을 때 연기를 생성하는 함수
// ==========================================
function createSmoke(x, y) {
  for (let i = 0; i < 20; i++) {
    smokes.push({
      x: x,
      y: y,
      vx: random(-3, 3),
      vy: random(-4, -1),
      size: random(10, 25),
      alpha: 200,
    });
  }
}

// ==========================================
// 단일 유령 생성 함수
// ==========================================
function spawnSingleGhost() {
  if (availableXSlots.length === 0) {
    let slotWidth = (width - 200) / targetGhostCount;
    for (let i = 0; i < targetGhostCount; i++) {
      let slotMin = 100 + i * slotWidth;
      let slotMax = slotMin + slotWidth;
      availableXSlots.push({ min: slotMin, max: slotMax });
    }
    availableXSlots = shuffle(availableXSlots);
  }

  let slot = availableXSlots.pop();
  let randomX = random(slot.min + 20, slot.max - 20);
  let targetY = random(250, height - 200);

  let head = Bodies.circle(randomX, 50, 25, {
    restitution: 0.5,
    frictionAir: 0.02,
  });

  let string = Constraint.create({
    pointA: { x: randomX, y: 0 },
    bodyB: head,
    length: targetY,
    stiffness: 0.05,
    damping: 0.1,
  });

  Composite.add(engine.world, [head, string]);
  ghosts.push({ head: head, string: string, exorcismProgress: 0 });
}

// ==========================================
// 선과 선이 교차하는지 판별하는 수학 함수 (가위 기능)
// ==========================================
function lineIntersect(x1, y1, x2, y2, x3, y3, x4, y4) {
  let denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
  if (denom == 0) return false;
  let ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom;
  let ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom;
  return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
}

// ==========================================
// 별(해)을 그리는 보조 함수
// ==========================================
function drawStar(x, y, radius1, radius2, npoints) {
  let angle = TWO_PI / npoints;
  let halfAngle = angle / 2.0;
  beginShape();
  for (let a = 0; a < TWO_PI; a += angle) {
    let sx = x + cos(a) * radius2;
    let sy = y + sin(a) * radius2;
    vertex(sx, sy);
    sx = x + cos(a + halfAngle) * radius1;
    sy = y + sin(a + halfAngle) * radius1;
    vertex(sx, sy);
  }
  endShape(CLOSE);
}
