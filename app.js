(function(){
  "use strict";

  // ==================================================================
  // CONSTANTS
  // ==================================================================
  const HALF_X = 30, HALF_Z = 50;
  const GOAL_HALF_W = 6, GOAL_H = 4;
  const POSSESSION_R = 1.9;
  const BLUE = 0x2f6bf0, RED = 0xe23b34;
  const MATCH_SECONDS = 180;
  const IDLE_AUTO_SECONDS = 5;      // stand still this long -> auto-play takes over
  const TACKLE_RANGE = 2.3;
  const TACKLE_COOLDOWN = 0.9;
  const TACKLE_SUCCESS = 0.62;
  const STUN_SECONDS = 0.6;

  // ==================================================================
  // RENDERER / SCENE / CAMERA
  // ==================================================================
  const wrap = document.getElementById('canvas-wrap');
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a1220);
  scene.fog = new THREE.Fog(0x0a1220, 120, 230);

  const camera = new THREE.PerspectiveCamera(48, window.innerWidth/window.innerHeight, 0.1, 500);
  camera.position.set(0, 78, 46);
  camera.lookAt(0,0,0);

  const renderer = new THREE.WebGLRenderer({antialias:true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  wrap.appendChild(renderer.domElement);

  window.addEventListener('resize', ()=>{
    camera.aspect = window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // ==================================================================
  // LIGHTING
  // ==================================================================
  scene.add(new THREE.AmbientLight(0xbfd4ff, 0.55));
  const sun = new THREE.DirectionalLight(0xffffff, 0.95);
  sun.position.set(-40, 90, -20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048,2048);
  sun.shadow.camera.left = -90; sun.shadow.camera.right = 90;
  sun.shadow.camera.top = 90; sun.shadow.camera.bottom = -90;
  sun.shadow.camera.far = 260;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xffffff, 0.25);
  fill.position.set(50,40,60);
  scene.add(fill);

  // ==================================================================
  // FIELD
  // ==================================================================
  const fieldGroup = new THREE.Group();
  scene.add(fieldGroup);

  const apron = new THREE.Mesh(
    new THREE.PlaneGeometry(HALF_X*2+40, HALF_Z*2+40),
    new THREE.MeshStandardMaterial({color:0x1c5a2c, roughness:1})
  );
  apron.rotation.x = -Math.PI/2; apron.receiveShadow = true; apron.position.y = -0.02;
  fieldGroup.add(apron);

  const stripeCount = 12;
  const stripeD = (HALF_Z*2)/stripeCount;
  for(let i=0;i<stripeCount;i++){
    const c = (i%2===0) ? 0x2c8f3f : 0x279137;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(HALF_X*2, stripeD), new THREE.MeshStandardMaterial({color:c, roughness:1}));
    m.rotation.x = -Math.PI/2;
    m.position.set(0, 0, -HALF_Z + stripeD*i + stripeD/2);
    m.receiveShadow = true;
    fieldGroup.add(m);
  }

  function wallSeg(w,h,d,x,z,color){
    const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), new THREE.MeshStandardMaterial({color, roughness:.9}));
    m.position.set(x,h/2,z); m.castShadow=true; m.receiveShadow=true;
    fieldGroup.add(m);
  }
  wallSeg(HALF_X*2+44, 6, 2, 0, HALF_Z+22, 0x14202f);
  wallSeg(HALF_X*2+44, 6, 2, 0, -HALF_Z-22, 0x14202f);
  wallSeg(2, 6, HALF_Z*2+44, HALF_X+22, 0, 0x14202f);
  wallSeg(2, 6, HALF_Z*2+44, -HALF_X-22, 0, 0x14202f);

  const lineMat = new THREE.MeshBasicMaterial({color:0xffffff});
  function lineBox(w,d,x,z){
    const m = new THREE.Mesh(new THREE.BoxGeometry(w,0.03,d), lineMat);
    m.position.set(x,0.03,z);
    fieldGroup.add(m);
  }
  function ring(rIn,rOut,x,z){
    const m = new THREE.Mesh(new THREE.RingGeometry(rIn,rOut,64), lineMat);
    m.rotation.x = -Math.PI/2; m.position.set(x,0.03,z);
    fieldGroup.add(m);
  }
  function spot(x,z){
    const m = new THREE.Mesh(new THREE.CircleGeometry(0.28,20), lineMat);
    m.rotation.x = -Math.PI/2; m.position.set(x,0.032,z);
    fieldGroup.add(m);
  }

  lineBox(0.3, HALF_Z*2, -HALF_X, 0);
  lineBox(0.3, HALF_Z*2, HALF_X, 0);
  lineBox(HALF_X*2, 0.3, 0, -HALF_Z);
  lineBox(HALF_X*2, 0.3, 0, HALF_Z);
  lineBox(HALF_X*2, 0.3, 0, 0);
  ring(8.85, 9.15, 0, 0);
  spot(0,0);
  [1,-1].forEach(s=>{
    const z0 = s*HALF_Z;
    const dir = -s;
    lineBox(0.3, 16, -20, z0+dir*8);
    lineBox(0.3, 16, 20, z0+dir*8);
    lineBox(40, 0.3, 0, z0+dir*16);
    lineBox(0.3, 6, -9, z0+dir*3);
    lineBox(0.3, 6, 9, z0+dir*3);
    lineBox(18, 0.3, 0, z0+dir*6);
    spot(0, z0+dir*11);
  });

  function buildGoal(zSide){
    const g = new THREE.Group();
    const postMat = new THREE.MeshStandardMaterial({color:0xf2f2f2, metalness:.2, roughness:.35});
    const postGeo = new THREE.CylinderGeometry(0.16,0.16,GOAL_H,12);
    const p1 = new THREE.Mesh(postGeo, postMat); p1.position.set(-GOAL_HALF_W, GOAL_H/2, 0); p1.castShadow=true;
    const p2 = new THREE.Mesh(postGeo, postMat); p2.position.set(GOAL_HALF_W, GOAL_H/2, 0); p2.castShadow=true;
    const barGeo = new THREE.CylinderGeometry(0.16,0.16,GOAL_HALF_W*2,12);
    const bar = new THREE.Mesh(barGeo, postMat);
    bar.rotation.z = Math.PI/2; bar.position.set(0,GOAL_H,0); bar.castShadow = true;
    g.add(p1,p2,bar);
    const netMat = new THREE.MeshBasicMaterial({color:0xffffff, wireframe:true, transparent:true, opacity:.35});
    const back = new THREE.Mesh(new THREE.PlaneGeometry(GOAL_HALF_W*2, GOAL_H, 8,6), netMat);
    back.position.set(0, GOAL_H/2, -1.6*zSide);
    g.add(back);
    const sideL = new THREE.Mesh(new THREE.PlaneGeometry(1.6, GOAL_H, 3,6), netMat);
    sideL.rotation.y = Math.PI/2; sideL.position.set(-GOAL_HALF_W, GOAL_H/2, -0.8*zSide);
    const sideR = sideL.clone(); sideR.position.x = GOAL_HALF_W;
    g.add(sideL, sideR);
    const top = new THREE.Mesh(new THREE.PlaneGeometry(GOAL_HALF_W*2,1.6,8,3), netMat);
    top.rotation.x = Math.PI/2; top.position.set(0,GOAL_H,-0.8*zSide);
    g.add(top);

    g.position.set(0, 0, zSide*HALF_Z);
    fieldGroup.add(g);
  }
  buildGoal(1);
  buildGoal(-1);

  // ==================================================================
  // PLAYERS
  // ==================================================================
  function makePlayerMesh(color){
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55,0.62,1.3,12),
      new THREE.MeshStandardMaterial({color, roughness:.6})
    );
    body.position.y = 0.95; body.castShadow = true;
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.42,14,14),
      new THREE.MeshStandardMaterial({color:0xe7b998, roughness:.7})
    );
    head.position.y = 1.85; head.castShadow = true;
    g.add(body, head);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.75,0.95,24), new THREE.MeshBasicMaterial({color:0xffe259, side:THREE.DoubleSide}));
    ring.rotation.x = -Math.PI/2; ring.position.y = 0.04;
    ring.visible = false;
    g.add(ring);
    g.userData.ring = ring;
    g.userData.body = body;
    return g;
  }

  const blueFormation = [
    {x:0,   z:40},
    {x:-16, z:26}, {x:0, z:29}, {x:16, z:26},
    {x:-16, z:4},  {x:0, z:7},  {x:16, z:4},
    {x:0,   z:-16}
  ];
  const redFormation = blueFormation.map(p=>({x:p.x, z:-p.z}));

  function makeTeam(color, formation, team){
    return formation.map((f,i)=>{
      const mesh = makePlayerMesh(color);
      mesh.position.set(f.x, 0, f.z);
      scene.add(mesh);
      return {
        mesh, team, base:{x:f.x,z:f.z}, index:i,
        vel:new THREE.Vector3(),
        facing:new THREE.Vector3(0, 0, team==='blue'?-1:1),
        speed: 8.6 + Math.random()*0.6,
        kickCooldown: 0,
        stunUntil: 0
      };
    });
  }
  const bluePlayers = makeTeam(BLUE, blueFormation, 'blue');
  const redPlayers  = makeTeam(RED,  redFormation,  'red');
  const allPlayers = bluePlayers.concat(redPlayers);

  let controlledIndex = 6; // start on a blue midfielder
  bluePlayers[controlledIndex].mesh.userData.ring.visible = true;

  // ==================================================================
  // BALL
  // ==================================================================
  const ball = {
    mesh: new THREE.Mesh(new THREE.SphereGeometry(0.32,20,20), new THREE.MeshStandardMaterial({color:0xffffff, roughness:.4})),
    velocity: new THREE.Vector3(0,0,0)
  };
  ball.mesh.castShadow = true;
  ball.mesh.position.set(0,0.32,0);
  scene.add(ball.mesh);

  const owner = {player:null, cooldownUntil:0};

  // ==================================================================
  // INPUT
  // ==================================================================
  const keys = {};
  let lastInputTime = performance.now()/1000;

  window.addEventListener('keydown', e=>{
    keys[e.code] = true;
    if(e.code === 'Space'){ e.preventDefault(); doShoot(); }
    if(e.code === 'KeyE'){ e.preventDefault(); doTackle(); }
  });
  window.addEventListener('keyup', e=>{ keys[e.code] = false; });

  const joyState = {active:false, dx:0, dy:0};
  const joyBase = document.getElementById('joy-base');
  const joyNub = document.getElementById('joy-nub');
  let joyPointerId = null;
  const JOY_R = 42;

  function joyStart(e){
    joyPointerId = e.pointerId; joyState.active = true;
    joyBase.setPointerCapture(joyPointerId);
    joyMove(e);
  }
  function joyMove(e){
    if(!joyState.active || e.pointerId !== joyPointerId) return;
    const rect = joyBase.getBoundingClientRect();
    let dx = e.clientX - (rect.left+rect.width/2);
    let dy = e.clientY - (rect.top+rect.height/2);
    const len = Math.hypot(dx,dy);
    if(len > JOY_R){ dx = dx/len*JOY_R; dy = dy/len*JOY_R; }
    joyNub.style.transform = `translate(${dx-26}px, ${dy-26}px)`;
    joyState.dx = dx/JOY_R; joyState.dy = dy/JOY_R;
  }
  function joyEnd(e){
    if(e.pointerId !== joyPointerId) return;
    joyState.active = false; joyState.dx = 0; joyState.dy = 0;
    joyNub.style.transform = 'translate(-50%,-50%)';
    joyPointerId = null;
  }
  joyBase.addEventListener('pointerdown', joyStart);
  joyBase.addEventListener('pointermove', joyMove);
  joyBase.addEventListener('pointerup', joyEnd);
  joyBase.addEventListener('pointercancel', joyEnd);

  document.getElementById('shoot-btn').addEventListener('pointerdown', e=>{
    e.preventDefault(); doShoot();
  });
  document.getElementById('tackle-btn').addEventListener('pointerdown', e=>{
    e.preventDefault(); doTackle();
  });

  function getInputVector(){
    let x=0, z=0;
    if(keys['KeyW']||keys['ArrowUp']) z -= 1;
    if(keys['KeyS']||keys['ArrowDown']) z += 1;
    if(keys['KeyA']||keys['ArrowLeft']) x -= 1;
    if(keys['KeyD']||keys['ArrowRight']) x += 1;
    if(joyState.active){ x += joyState.dx; z += joyState.dy; }
    const v = new THREE.Vector3(x,0,z);
    if(v.length() > 1) v.normalize();
    return v;
  }

  // ==================================================================
  // GAME STATE
  // ==================================================================
  let scoreBlue = 0, scoreRed = 0;
  let timeLeft = MATCH_SECONDS;
  let matchOver = false;
  let goalPauseUntil = 0;
  let cpTackleCooldown = 0;

  const scoreBlueEl = document.getElementById('score-blue');
  const scoreRedEl = document.getElementById('score-red');
  const clockEl = document.getElementById('clock');
  const goalFlash = document.getElementById('goal-flash');
  const fulltimeEl = document.getElementById('fulltime');

  function fmtClock(s){
    s = Math.max(0,Math.ceil(s));
    const m = Math.floor(s/60), r = s%60;
    return m+':'+(r<10?'0':'')+r;
  }

  function resetKickoff(){
    ball.velocity.set(0,0,0);
    ball.mesh.position.set(0,0.32,0);
    owner.player = null; owner.cooldownUntil = performance.now()/1000 + 0.3;
    bluePlayers.forEach(p=>{ p.mesh.position.set(p.base.x,0,p.base.z); p.vel.set(0,0,0); p.stunUntil = 0; });
    redPlayers.forEach(p=>{ p.mesh.position.set(p.base.x,0,p.base.z); p.vel.set(0,0,0); p.stunUntil = 0; });
    lastInputTime = performance.now()/1000;
  }

  function scoreGoal(team){
    if(team==='blue') scoreBlue++; else scoreRed++;
    scoreBlueEl.textContent = scoreBlue;
    scoreRedEl.textContent = scoreRed;
    goalFlash.classList.add('show');
    goalPauseUntil = performance.now()/1000 + 1.6;
    setTimeout(()=>{ goalFlash.classList.remove('show'); }, 1500);
    setTimeout(resetKickoff, 1400);
  }

  document.getElementById('restart-btn').addEventListener('click', ()=>{
    scoreBlue=0; scoreRed=0; timeLeft = MATCH_SECONDS; matchOver=false;
    scoreBlueEl.textContent='0'; scoreRedEl.textContent='0';
    fulltimeEl.style.display='none';
    resetKickoff();
  });

  setTimeout(()=>{ document.getElementById('hint').style.opacity = '0'; }, 5500);

  // ==================================================================
  // SHOOT
  // ==================================================================
  function shootBall(player){
    const dir = player.facing.clone();
    const goalZ = player.team==='blue' ? -HALF_Z : HALF_Z;
    const goalPos = new THREE.Vector3(0,0,goalZ);
    const distToGoal = player.mesh.position.distanceTo(goalPos);
    if(distToGoal < 42){
      dir.copy(goalPos.clone().sub(player.mesh.position));
      dir.y = 0; dir.normalize();
      dir.x += (Math.random()-0.5)*0.22;
      dir.normalize();
    }
    const power = distToGoal < 42 ? 40 : 32;
    const arc = distToGoal < 24 ? 3.2 : 7.5;
    ball.velocity.set(dir.x*power, arc, dir.z*power);
    owner.player = null;
    owner.cooldownUntil = performance.now()/1000 + 0.45;
    player.kickCooldown = performance.now()/1000 + 1.2;
  }

  function doShoot(){
    if(matchOver) return;
    lastInputTime = performance.now()/1000;
    const cp = bluePlayers[controlledIndex];
    if(owner.player === cp) shootBall(cp);
  }

  // ==================================================================
  // TACKLE
  // ==================================================================
  function doTackle(){
    if(matchOver) return;
    const now = performance.now()/1000;
    lastInputTime = now;
    if(now < cpTackleCooldown) return;
    cpTackleCooldown = now + TACKLE_COOLDOWN;

    const cp = bluePlayers[controlledIndex];
    if(owner.player === cp) return; // already have the ball, nothing to win

    let target = null, targetD = Infinity;
    redPlayers.forEach(p=>{
      const d = flatDist(p.mesh.position, cp.mesh.position);
      if(d < targetD){ targetD = d; target = p; }
    });
    if(!target || targetD > TACKLE_RANGE) return;

    const success = Math.random() < TACKLE_SUCCESS;
    if(success){
      owner.player = cp;
      owner.cooldownUntil = now + 0.15;
      ball.mesh.position.x = cp.mesh.position.x + cp.facing.x*1.0;
      ball.mesh.position.z = cp.mesh.position.z + cp.facing.z*1.0;
      ball.velocity.set(0,0,0);
      target.stunUntil = now + STUN_SECONDS;
    } else {
      if(owner.player === target){
        owner.player = null;
        owner.cooldownUntil = now + 0.25;
        ball.velocity.set((Math.random()-0.5)*6, 3, (Math.random()-0.5)*6);
      }
      cp.stunUntil = now + 0.35;
    }
  }

  // ==================================================================
  // AI MOVEMENT (shared by AI players AND an idle human player)
  // ==================================================================
  function autoMovePlayer(p, dt, now){
    const teamMates = p.team==='blue' ? bluePlayers : redPlayers;
    const closestOnTeam = teamMates.reduce((a,b)=> flatDist(a.mesh.position,ball.mesh.position) < flatDist(b.mesh.position,ball.mesh.position) ? a : b);
    const isChaser = (closestOnTeam === p);
    const ballIsMine = owner.player && owner.player.team === p.team;

    let target;
    if(isChaser && !ballIsMine){
      target = {x: ball.mesh.position.x, z: ball.mesh.position.z};
    } else {
      const pull = ballIsMine ? 0.25 : 0.4;
      target = {
        x: p.base.x + (ball.mesh.position.x - p.base.x) * pull * 0.5,
        z: p.base.z + (ball.mesh.position.z - p.base.z) * pull * 0.35
      };
    }
    const dx = target.x - p.mesh.position.x, dz = target.z - p.mesh.position.z;
    const d = Math.hypot(dx,dz);
    if(d > 0.3){
      const nx = dx/d, nz = dz/d;
      const spd = p.speed * (now < p.stunUntil ? 0.35 : 1);
      p.mesh.position.x += nx * spd * dt;
      p.mesh.position.z += nz * spd * dt;
      p.facing.set(nx,0,nz);
      p.mesh.rotation.y = Math.atan2(nx,nz);
    }
    clampToField(p.mesh.position);
  }

  // ==================================================================
  // MAIN LOOP
  // ==================================================================
  const clock = new THREE.Clock();
  const camTarget = new THREE.Vector3(0,0,0);

  function update(dt){
    const now = performance.now()/1000;
    const paused = now < goalPauseUntil || matchOver;

    if(!matchOver){
      timeLeft -= dt;
      if(timeLeft <= 0){
        timeLeft = 0; matchOver = true;
        document.getElementById('fulltime-score').textContent = `BLUE ${scoreBlue} — ${scoreRed} RED`;
        fulltimeEl.style.display = 'flex';
      }
      clockEl.textContent = fmtClock(timeLeft);
    }

    if(paused){ renderer.render(scene, camera); return; }

    const input = getInputVector();
    const cp = bluePlayers[controlledIndex];

    // ---- controlled player: manual input, or auto-play after 5s idle ----
    if(input.length() > 0.05){
      lastInputTime = now;
      const spd = cp.speed * (now < cp.stunUntil ? 0.35 : 1);
      cp.mesh.position.x += input.x * spd * dt;
      cp.mesh.position.z += input.z * spd * dt;
      cp.facing.copy(input).normalize();
      cp.mesh.rotation.y = Math.atan2(input.x, input.z);
      clampToField(cp.mesh.position);
    } else if(now - lastInputTime >= IDLE_AUTO_SECONDS){
      autoMovePlayer(cp, dt, now);
    }

    // ---- AI players ----
    allPlayers.forEach(p=>{
      if(p === cp) return;
      autoMovePlayer(p, dt, now);
    });

    // ---- simple separation so players don't stack ----
    for(let i=0;i<allPlayers.length;i++){
      for(let j=i+1;j<allPlayers.length;j++){
        const a = allPlayers[i], b = allPlayers[j];
        const dx = b.mesh.position.x - a.mesh.position.x;
        const dz = b.mesh.position.z - a.mesh.position.z;
        const d = Math.hypot(dx,dz);
        const minD = 1.05;
        if(d > 0 && d < minD){
          const push = (minD-d)/2;
          const nx = dx/d, nz = dz/d;
          if(a !== cp){ a.mesh.position.x -= nx*push; a.mesh.position.z -= nz*push; }
          if(b !== cp){ b.mesh.position.x += nx*push; b.mesh.position.z += nz*push; }
        }
      }
    }

    // ---- auto switch controlled player ----
    if(!(owner.player === cp)){
      const nearestBlue = bluePlayers.reduce((a,b)=> flatDist(a.mesh.position,ball.mesh.position) < flatDist(b.mesh.position,ball.mesh.position) ? a : b);
      if(nearestBlue !== cp && flatDist(cp.mesh.position, ball.mesh.position) > POSSESSION_R*1.1){
        cp.mesh.userData.ring.visible = false;
        controlledIndex = bluePlayers.indexOf(nearestBlue);
        bluePlayers[controlledIndex].mesh.userData.ring.visible = true;
        lastInputTime = now; // fresh grace period for the newly controlled player
      }
    }

    // ---- ball / possession ----
    if(now >= owner.cooldownUntil){
      let closest = null, closestD = Infinity;
      allPlayers.forEach(p=>{
        const d = flatDist(p.mesh.position, ball.mesh.position);
        if(d < closestD){ closestD = d; closest = p; }
      });
      if(closestD < POSSESSION_R && ball.mesh.position.y < 1.2){
        owner.player = closest;
      }
    }

    if(owner.player){
      const p = owner.player;
      ball.mesh.position.x = p.mesh.position.x + p.facing.x*1.05;
      ball.mesh.position.z = p.mesh.position.z + p.facing.z*1.05;
      ball.mesh.position.y = 0.32;
      ball.velocity.set(0,0,0);

      if(p.team === 'red' || (p.team==='blue' && p!==cp)){
        const goalZ = p.team==='blue' ? -HALF_Z : HALF_Z;
        const distToGoal = Math.hypot(p.mesh.position.x, p.mesh.position.z-goalZ);
        if(distToGoal < 34 && now > p.kickCooldown){
          shootBall(p);
        }
      }
    } else {
      ball.velocity.y -= 18 * dt;
      ball.mesh.position.x += ball.velocity.x*dt;
      ball.mesh.position.y += ball.velocity.y*dt;
      ball.mesh.position.z += ball.velocity.z*dt;
      if(ball.mesh.position.y <= 0.32){
        ball.mesh.position.y = 0.32;
        if(Math.abs(ball.velocity.y) > 1){
          ball.velocity.y = -ball.velocity.y*0.42;
        } else ball.velocity.y = 0;
        ball.velocity.x *= 0.9; ball.velocity.z *= 0.9;
      }
      ball.velocity.x *= 0.992; ball.velocity.z *= 0.992;

      if(ball.mesh.position.x < -HALF_X){ ball.mesh.position.x = -HALF_X; ball.velocity.x *= -0.5; }
      if(ball.mesh.position.x > HALF_X){ ball.mesh.position.x = HALF_X; ball.velocity.x *= -0.5; }

      if(ball.mesh.position.z < -HALF_Z-0.4 && Math.abs(ball.mesh.position.x) < GOAL_HALF_W-0.3 && ball.mesh.position.y < GOAL_H){
        scoreGoal('blue');
      } else if(ball.mesh.position.z > HALF_Z+0.4 && Math.abs(ball.mesh.position.x) < GOAL_HALF_W-0.3 && ball.mesh.position.y < GOAL_H){
        scoreGoal('red');
      } else if(Math.abs(ball.mesh.position.z) > HALF_Z+6){
        ball.mesh.position.z = Math.sign(ball.mesh.position.z)*(HALF_Z-4);
        ball.velocity.set(0,0,0);
      }
    }

    ball.mesh.rotation.x += ball.velocity.z*dt*0.5;
    ball.mesh.rotation.z -= ball.velocity.x*dt*0.5;

    // ---- camera follow ----
    camTarget.x += (ball.mesh.position.x*0.55 - camTarget.x)*Math.min(1,dt*2.2);
    camTarget.z += (ball.mesh.position.z*0.55 - camTarget.z)*Math.min(1,dt*2.2);
    camera.position.set(camTarget.x*0.6, 76, camTarget.z*0.55 + 32);
    camera.lookAt(camTarget.x*0.6, 0, camTarget.z*0.55);

    renderer.render(scene, camera);
  }

  function flatDist(a,b){ return Math.hypot(a.x-b.x, a.z-b.z); }
  function clampToField(pos){
    pos.x = Math.max(-HALF_X+0.5, Math.min(HALF_X-0.5, pos.x));
    pos.z = Math.max(-HALF_Z+0.5, Math.min(HALF_Z-0.5, pos.z));
  }

  function loop(){
    const dt = Math.min(clock.getDelta(), 0.05);
    update(dt);
    requestAnimationFrame(loop);
  }
  loop();

})();
