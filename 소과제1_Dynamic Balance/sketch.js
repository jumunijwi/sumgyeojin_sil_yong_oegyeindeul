const Engine = Matter.Engine;
const Bodies = Matter.Bodies;
const Composite = Matter.Composite;
const Constraint = Matter.Constraint;

let engine;
let candies = [];
let skullTop, jaw;
let jawMuscle;
let isMouthOpen = true;

function setup() {
  createCanvas(windowWidth, windowHeight);
  engine = Engine.create();

  // 바닥 생성
  let ground = Bodies.rectangle(width / 2, height, width, 50, {
    isStatic: true,
  });
  Composite.add(engine.world, ground);

  // 머리와 턱 생성
  skullTop = Bodies.rectangle(width / 2, 200, 160, 120, { isStatic: true });
  jaw = Bodies.rectangle(width / 2, 280, 140, 40);

  // 턱관절과 근육 연결
  // 오른쪽 뒤통수 핀
  let jawHinge = Constraint.create({
    bodyA: skullTop,
    pointA: { x: 60, y: 60 }, // 윗머리의 오른쪽 아래
    bodyB: jaw,
    pointB: { x: 50, y: -20 }, // 턱의 오른쪽 위
    stiffness: 1, // 1은 완전히 단단한 쇠막대기처럼 고정됨
    length: 0,
  });

  // 앞쪽 입술 근육
  jawMuscle = Constraint.create({
    bodyA: skullTop,
    pointA: { x: -60, y: 60 },
    bodyB: jaw,
    pointB: { x: -50, y: -20 },
    stiffness: 0.04,
    damping: 0.8,
    length: 80,
  });

  Composite.add(engine.world, [skullTop, jaw, jawHinge, jawMuscle]);
}

function draw() {
  Engine.update(engine);
  background(30);

  // 입이 열렸을 때 별사탕 쏟아내기
  if (isMouthOpen && frameCount % 5 === 0) {
    let colors = ["#FF9CEE", "#85E3FF", "#BFFCC6", "#FFF5BA", "#FFFFFF"];

    // 생성 위치
    let mouthX = width / 2 + 45;
    let mouthY = 250;

    let newCandy = Bodies.circle(mouthX, mouthY, random(8, 15), {
      restitution: 0.8,
      friction: 0.1,
      candyColor: random(colors),
    });

    // 입에서 뱉어내듯 왼쪽 아래로 발사하는 힘 가하기
    Matter.Body.setVelocity(newCandy, { x: random(-5, -2), y: random(0, 5) });

    Composite.add(engine.world, newCandy);
    candies.push(newCandy);
  }

  // 화면에 그리기
  for (let i = 0; i < candies.length; i++) {
    let candy = candies[i];
    let pos = candy.position;
    let angle = candy.angle;

    push();
    translate(pos.x, pos.y);
    rotate(angle);

    fill(candy.candyColor); // 아까 저장해둔 색상 꺼내 쓰기
    noStroke();

    // 울퉁불퉁
    beginShape();
    let numBumps = 8;
    for (let a = 0; a < TWO_PI; a += 0.1) {
      let r = 10 + sin(a * numBumps) * 5;
      vertex(r * cos(a), r * sin(a));
    }
    endShape(CLOSE);

    pop();
  }

  // 윗머리
  fill(220, 210, 190); // 뼈 색상
  noStroke();
  rectMode(CENTER);
  rect(skullTop.position.x, skullTop.position.y, 160, 120, 40); // 둥근 사각형으로 임시 표현

  // 아래턱
  push();
  translate(jaw.position.x, jaw.position.y);
  rotate(jaw.angle);
  rect(0, 0, 140, 40, 20);
  pop();

  // 화면 밖으로 벗어난 별사탕 지우기
  for (let i = candies.length - 1; i >= 0; i--) {
    if (candies[i].position.y > height + 100) {
      Composite.remove(engine.world, candies[i]); // 엔진에서 삭제
      candies.splice(i, 1); // 배열에서 삭제
    }
  }
}
