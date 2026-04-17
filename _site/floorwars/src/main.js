'use strict';

const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');

let game, grid, gridRenderer, robotRenderer, uiRenderer;

function toCanvasCoords(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (clientX - rect.left) * (canvas.width  / rect.width),
    y: (clientY - rect.top)  * (canvas.height / rect.height),
  };
}

function hit(x, y, b) {
  return b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
}

function handlePointer(clientX, clientY) {
  const { x, y } = toCanvasCoords(clientX, clientY);

  if (game.phase === 'select') {
    for (const b of uiRenderer.modeBtnBounds) {
      if (hit(x, y, b)) { game.startMode(b.modeId); return; }
    }
  } else if (game.phase === 'running' && game.mode === 1) {
    for (const b of uiRenderer.jobCardBounds) {
      if (hit(x, y, b)) { game.humanDispatch(b.jobId); return; }
    }
  } else if (game.phase === 'transition') {
    if (hit(x, y, uiRenderer.contBtnBounds)) { game.backToMenu(); }
  } else if (game.phase === 'comparison') {
    game.backToMenu();
  }
}

canvas.addEventListener('click',    e => handlePointer(e.clientX, e.clientY));
canvas.addEventListener('touchend', e => {
  e.preventDefault();
  handlePointer(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
}, { passive: false });

window.addEventListener('resize', () => {
  resizeCanvas();
});

function resizeCanvas() {
  const vw = window.innerWidth, vh = window.innerHeight;
  if (!grid) return;
  CONFIG.CELL_PX = Math.floor(Math.min(
    (vw - CONFIG.JOB_PANEL_PX) / grid.cols,
    vh / grid.rows
  ));
  canvas.width  = grid.cols * CONFIG.CELL_PX + CONFIG.JOB_PANEL_PX;
  canvas.height = grid.rows * CONFIG.CELL_PX;
  canvas.style.width  = '';
  canvas.style.height = '';
}

let lastTs = 0;

function gameLoop(ts) {
  const dt = Math.min((ts - lastTs) / 1000, 0.1);
  lastTs = ts;

  game.update(dt, ts);

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const mapW = grid.cols * CONFIG.CELL_PX;
  const mapH = grid.rows * CONFIG.CELL_PX;

  if (game.phase === 'select') {
    uiRenderer.drawModeSelector(ctx, game.results, canvas.width, canvas.height);
  } else if (game.phase === 'comparison') {
    uiRenderer.drawFinalComparison(ctx, game.results, canvas.width, canvas.height);
  } else {
    // Running or transition: draw game world
    gridRenderer.draw(ctx, grid, game.mode === 3);
    for (const robot of game.robots) {
      robotRenderer.draw(ctx, robot, game.mode === 3);
    }
    uiRenderer.drawHallwayCounter(ctx, game.hallwayTracker, grid);
    uiRenderer.drawDeliveryTimers(ctx, game.jobSystem ? game.jobSystem.jobs : [], ts, grid);
    uiRenderer.drawLineStatus(ctx, game.jobSystem ? game.jobSystem.lineRunning : true, grid);
    uiRenderer.drawCarCounter(ctx, game.carsProduced, grid);
    uiRenderer.drawModeTimer(ctx, game.mode, game.timer, mapW);
    if (game.jobSystem && !game.jobSystem.lineRunning) uiRenderer.drawLineStopOverlay(ctx, grid);
    uiRenderer.drawJobPanel(ctx, game.jobSystem ? game.jobSystem.jobs : [], ts, game.mode, mapH, mapW);

    if (game.phase === 'transition') {
      const result = game.results[game.results.length - 1];
      uiRenderer.drawTransitionScreen(ctx, result, canvas.width, canvas.height);
    }
  }

  requestAnimationFrame(gameLoop);
}

async function boot() {
  const csvText = await fetch('map.csv').then(r => r.text());
  grid = new Grid(csvText);

  resizeCanvas();

  const pathfinder     = new Pathfinder(grid);
  const hallwayTracker = new HallwayTracker(grid);

  gridRenderer  = new GridRenderer();
  robotRenderer = new RobotRenderer();
  uiRenderer    = new UIRenderer();

  game = new FloorWarsGame({ grid, pathfinder, hallwayTracker });

  requestAnimationFrame(ts => { lastTs = ts; gameLoop(ts); });
}

boot();
