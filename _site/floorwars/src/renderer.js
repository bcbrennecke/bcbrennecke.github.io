'use strict';

// ── Cell type colors ──────────────────────────────────────────────────────
const CELL_COLORS = {
  0:  '#555555',
  1:  '#e0ddd8',
  2:  '#e8e4d9',
  3:  '#e8f0e8',
  4:  '#d4cfc4',
  5:  '#b8b0a0',  // eastbound hallway lane (warehouse → production)
  6:  '#a0a8b8',  // westbound hallway lane (production → warehouse)
};

function cellColor(type) {
  if (CELL_COLORS[type]) return CELL_COLORS[type];
  if (type >= 10 && type <= 19) return '#ffe8d6';
  if (type >= 20 && type <= 29) return '#ffe8d6';
  if (type >= 30 && type <= 39) return '#d6e4ff';
  if (type >= 40 && type <= 49) return '#d6e4ff';
  if (type >= 50 && type <= 59) return '#e8e4d9';
  if (type >= 60 && type <= 69) return '#e8e4d9';
  return '#e0ddd8';
}

// ── GridRenderer ──────────────────────────────────────────────────────────
class GridRenderer {
  draw(ctx, grid, mode3Active) {
    const cp = CONFIG.CELL_PX;

    // Pre-compute which lane type (5=east or 6=west) each row belongs to.
    // All non-zero cells in those rows will share that lane's color.
    const hallwayRowLane = new Map();
    for (let r = 0; r < grid.rows; r++)
      for (let c = 0; c < grid.cols; c++) {
        const t = grid.get(r, c);
        if (t === 5 || t === 6) { hallwayRowLane.set(r, t); break; }
      }

    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        const type = grid.get(r, c);
        const px = c * cp, py = r * cp;

        // Only override color for actual hallway cells (type 5/6); warehouse/production keep their own color
        const color = cellColor(type);
        ctx.fillStyle = color;
        ctx.fillRect(px, py, cp, cp);

        if (type >= 10 && type <= 19) {
          ctx.strokeStyle = '#ff6b00';
          ctx.lineWidth = 2;
          ctx.strokeRect(px + 1, py + 1, cp - 2, cp - 2);
          ctx.fillStyle = '#cc5500';
          ctx.font = `bold ${Math.max(7, cp * 0.28)}px monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('P', px + cp / 2, py + cp / 2);
        } else if (type >= 20 && type <= 29) {
          ctx.strokeStyle = '#ff6b00';
          ctx.lineWidth = 2;
          ctx.strokeRect(px + 1, py + 1, cp - 2, cp - 2);
          ctx.fillStyle = '#cc5500';
          ctx.font = `bold ${Math.max(7, cp * 0.28)}px monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('D', px + cp / 2, py + cp / 2);
        } else if (type >= 30 && type <= 39) {
          ctx.strokeStyle = '#2266cc';
          ctx.lineWidth = 2;
          ctx.strokeRect(px + 1, py + 1, cp - 2, cp - 2);
          ctx.fillStyle = '#1a4a99';
          ctx.font = `bold ${Math.max(7, cp * 0.28)}px monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('P', px + cp / 2, py + cp / 2);
        } else if (type >= 40 && type <= 49) {
          ctx.strokeStyle = '#2266cc';
          ctx.lineWidth = 2;
          ctx.strokeRect(px + 1, py + 1, cp - 2, cp - 2);
          ctx.fillStyle = '#1a4a99';
          ctx.font = `bold ${Math.max(7, cp * 0.28)}px monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('D', px + cp / 2, py + cp / 2);
        }

        ctx.textBaseline = 'alphabetic';
      }
    }

    // Draw directional arrows only on type 5/6 hallway cells
    ctx.save();
    ctx.globalAlpha = 0.30;
    ctx.fillStyle = '#333';
    ctx.font = `${Math.max(8, Math.floor(cp * 0.55))}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const [r, laneType] of hallwayRowLane) {
      const arrow = laneType === 5 ? '→' : '←';
      for (let c = 0; c < grid.cols; c++) {
        const t = grid.get(r, c);
        if (t === 5 || t === 6) ctx.fillText(arrow, c * cp + cp / 2, r * cp + cp / 2);
      }
    }
    ctx.restore();

    if (CONFIG.SHOW_GRID_LINES) {
      ctx.strokeStyle = 'rgba(0,0,0,0.08)';
      ctx.lineWidth = 0.5;
      for (let c = 0; c <= grid.cols; c++) {
        ctx.beginPath();
        ctx.moveTo(c * cp, 0);
        ctx.lineTo(c * cp, grid.rows * cp);
        ctx.stroke();
      }
      for (let r = 0; r <= grid.rows; r++) {
        ctx.beginPath();
        ctx.moveTo(0, r * cp);
        ctx.lineTo(grid.cols * cp, r * cp);
        ctx.stroke();
      }
    }

    if (mode3Active) {
      ctx.fillStyle = 'rgba(0,68,255,0.04)';
      ctx.fillRect(0, 0, grid.cols * cp, grid.rows * cp);
      ctx.strokeStyle = 'rgba(0,68,255,0.08)';
      ctx.lineWidth = 1;
      const sz = cp * 2;
      for (let x = 0; x < grid.cols * cp; x += sz) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, grid.rows * cp); ctx.stroke();
      }
      for (let y = 0; y < grid.rows * cp; y += sz) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(grid.cols * cp, y); ctx.stroke();
      }
    }

    ctx.font = `bold ${Math.max(9, cp * 0.35)}px monospace`;
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.textAlign = 'center';
    ctx.fillText('WAREHOUSE', 6 * cp, 4);
    ctx.fillText('PRODUCTION', 29 * cp, 4);
    ctx.textBaseline = 'alphabetic';

    // Staging zone markers (east: row 9 col 11, west: row 10 col 24)
    const stagingZones = [{ row: 9, col: 11 }, { row: 10, col: 24 }];
    for (const { row, col } of stagingZones) {
      const px = col * cp, py = row * cp;
      ctx.save();
      ctx.strokeStyle = '#f0a000';
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 2]);
      ctx.strokeRect(px + 1, py + 1, cp - 2, cp - 2);
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(240,160,0,0.15)';
      ctx.fillRect(px + 1, py + 1, cp - 2, cp - 2);
      ctx.fillStyle = '#b07000';
      ctx.font = `bold ${Math.max(6, Math.floor(cp * 0.28))}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('S', px + cp / 2, py + cp / 2);
      ctx.textBaseline = 'alphabetic';
      ctx.restore();
    }
  }
}

// ── RobotRenderer ─────────────────────────────────────────────────────────
class RobotRenderer {
  draw(ctx, robot, mode3Active) {
    const cp = CONFIG.CELL_PX;
    const px = robot.pixelX;
    const py = robot.pixelY;

    // Pulsing ring when held at staging (any mode that uses staging)
    if (robot.state === 'at_staging') {
      const p = Math.sin(robot.pulse) * 0.5 + 0.5;
      const rad = cp * 0.65 + p * cp * 0.2;
      ctx.strokeStyle = `rgba(255,200,0,${0.4 + p * 0.5})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px + cp / 2, py + cp / 2, rad, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = robot.color;
    ctx.fillRect(px, py, cp, cp);

    // Bright outline when the robot is actively carrying a job
    if (robot.job && robot.state !== 'idle') {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = Math.max(2, cp * 0.1);
      ctx.strokeRect(px + 1, py + 1, cp - 2, cp - 2);
    }

    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.max(7, cp * 0.35)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(robot.label, px + cp / 2, py + cp / 2 - (robot.job ? cp * 0.12 : 0));

    if (robot.job) {
      ctx.font = `bold ${Math.max(5, cp * 0.26)}px monospace`;
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillText('#' + robot.job.displayId, px + cp / 2, py + cp * 0.72);
    }

    ctx.textBaseline = 'alphabetic';

    const dx = robot.dirX, dy = robot.dirY;
    if (dx !== 0 || dy !== 0) {
      const aw = cp * 0.2;
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath();
      const cx2 = px + cp / 2, cy2 = py + cp / 2;
      if (dx > 0) {
        ctx.moveTo(px + cp, cy2);
        ctx.lineTo(px + cp - aw, cy2 - aw * 0.6);
        ctx.lineTo(px + cp - aw, cy2 + aw * 0.6);
      } else if (dx < 0) {
        ctx.moveTo(px, cy2);
        ctx.lineTo(px + aw, cy2 - aw * 0.6);
        ctx.lineTo(px + aw, cy2 + aw * 0.6);
      } else if (dy > 0) {
        ctx.moveTo(cx2, py + cp);
        ctx.lineTo(cx2 - aw * 0.6, py + cp - aw);
        ctx.lineTo(cx2 + aw * 0.6, py + cp - aw);
      } else {
        ctx.moveTo(cx2, py);
        ctx.lineTo(cx2 - aw * 0.6, py + aw);
        ctx.lineTo(cx2 + aw * 0.6, py + aw);
      }
      ctx.closePath();
      ctx.fill();
    }

    if (mode3Active && robot.state === 'at_staging') {
      ctx.fillStyle = '#cc6600';
      ctx.font = `bold ${Math.max(6, cp * 0.28)}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText('HOLD', px + cp / 2, py - 2);
    }
  }
}

// ── UIRenderer ────────────────────────────────────────────────────────────
class UIRenderer {
  constructor() {
    this._jobCardBounds = [];
    this._modeBtnBounds = [];
    this._contBtnBounds = null;
  }

  get jobCardBounds() { return this._jobCardBounds; }
  get modeBtnBounds()  { return this._modeBtnBounds; }
  get contBtnBounds()  { return this._contBtnBounds; }

  drawJobPanel(ctx, jobs, now, mode, canvasH, panelX) {
    this._jobCardBounds = [];
    const pw = CONFIG.JOB_PANEL_PX;
    const px = panelX;

    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(px, 0, pw, canvasH);
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, canvasH); ctx.stroke();

    ctx.fillStyle = '#333';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('JOBS', px + pw / 2, 20);

    ctx.fillStyle = '#999';
    ctx.font = '10px monospace';
    ctx.fillText(mode === 1 ? 'Tap to dispatch' : 'Auto', px + pw / 2, 34);

    const cardH = 32, cardGap = 3, startY = 44;
    const active = jobs.filter(j => j.status !== 'completed').slice(-14).reverse();

    active.forEach((job, i) => {
      const cy = startY + i * (cardH + cardGap);
      if (cy + cardH > canvasH) return;
      const cx = px + 6, cw = pw - 12;
      const age = now - job.spawnMs;
      const pct = Math.max(0, 1 - age / job.graceMs);
      const expiring = pct < 0.2;
      const flash = expiring && Math.floor(now / 250) % 2 === 0;
      const bg = job.status === 'dispatched' ? '#fffde7' : (flash ? '#ffbbbb' : '#fff');

      ctx.fillStyle = bg;
      this._roundRect(ctx, cx, cy, cw, cardH, 4);
      ctx.fill();
      ctx.strokeStyle = expiring ? '#cc0000' : '#ddd';
      ctx.lineWidth = 1;
      ctx.stroke();

      const accentColor = job.robot ? job.robot.color : (job.type === 'ft' ? '#e85d04' : '#1971c2');

      ctx.fillStyle = accentColor;
      this._roundRect(ctx, cx, cy, 5, cardH, 2);
      ctx.fill();

      ctx.fillStyle = '#333';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('Job #' + job.displayId, cx + 9, cy + 11);

      ctx.fillStyle = job.robot ? accentColor : '#aaa';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(job.robot ? job.robot.label : '—', cx + cw - 4, cy + 11);

      const rem = Math.max(0, (job.graceMs - age) / 1000);
      ctx.fillStyle = rem < 2 ? '#cc0000' : '#999';
      ctx.font = `${rem < 2 ? 9 : 8}px monospace`;
      ctx.textAlign = 'left';
      ctx.fillText(rem.toFixed(1) + 's', cx + 9, cy + 22);

      const bx = cx + 8, bw = cw - 16, by = cy + 25, bh = 4;
      ctx.fillStyle = '#e0e0e0'; ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = pct < 0.2 ? '#cc0000' : pct < 0.5 ? '#ff9900' : accentColor;
      ctx.fillRect(bx, by, bw * pct, bh);

      if (mode === 1 && job.status === 'pending') {
        this._jobCardBounds.push({ jobId: job.id, x: cx, y: cy, w: cw, h: cardH });
      }
    });
  }

  drawHallwayCounter(ctx, hallwayTracker, grid) {
    const cp = CONFIG.CELL_PX;
    const cnt = hallwayTracker.count;
    const congested = cnt >= 2;

    const hallCells = grid.cellsOfTypes([5, 6]);
    if (!hallCells.length) return;
    const minCol = Math.min(...hallCells.map(c => c.col));
    const maxCol = Math.max(...hallCells.map(c => c.col));
    const minRow = Math.min(...hallCells.map(c => c.row));
    const bx = minCol * cp, bw = (maxCol - minCol + 1) * cp;
    const by = minRow * cp - 20, bh = 18;

    ctx.fillStyle = congested ? '#cc2222' : '#448844';
    this._roundRect(ctx, bx, Math.max(0, by), bw, bh, 3);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(congested ? `⚠ ${cnt} IN HALLWAY` : `✓ ${cnt} IN HALLWAY`, bx + bw / 2, Math.max(0, by) + bh / 2);
    ctx.textBaseline = 'alphabetic';
  }

  drawModeTimer(ctx, mode, timer, mapW) {
    const names = ['', 'Human Dispatcher', 'Fleet Managers', 'Orchestrated Floor'];
    const mins = Math.floor(timer / 60);
    const secs = Math.floor(timer % 60).toString().padStart(2, '0');
    const txt = `MODE ${mode} — ${names[mode]}  |  ${mins}:${secs}`;
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillRect(0, 0, mapW, 18);
    ctx.fillStyle = '#333';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(txt, mapW / 2, 13);
  }

  drawLineStatus(ctx, lineRunning, grid) {
    const cp = CONFIG.CELL_PX;
    const prodCells = grid.cellsOfTypes([3, 20, 21, 40, 41]);
    if (!prodCells.length) return;
    const minCol = Math.min(...prodCells.map(c => c.col));
    const px = minCol * cp + 8, py = 22;

    ctx.fillStyle = lineRunning ? '#44cc44' : '#cc2222';
    ctx.beginPath(); ctx.arc(px + 6, py + 6, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#333';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(lineRunning ? 'LINE RUNNING' : 'LINE STOPPED', px + 16, py + 10);
  }

  drawLineStopOverlay(ctx, grid) {
    const cp = CONFIG.CELL_PX;
    const prodCells = grid.cellsOfTypes([3, 20, 21, 40, 41]);
    if (!prodCells.length) return;
    const minCol = Math.min(...prodCells.map(c => c.col));
    const maxCol = Math.max(...prodCells.map(c => c.col));
    ctx.fillStyle = 'rgba(255,0,0,0.10)';
    ctx.fillRect(minCol * cp, 0, (maxCol - minCol + 1) * cp, grid.rows * cp);
  }

  drawCarCounter(ctx, carsProduced, grid) {
    const cp = CONFIG.CELL_PX;
    const prodCells = grid.cellsOfTypes([3, 20, 21, 40, 41]);
    if (!prodCells.length) return;
    const minCol = Math.min(...prodCells.map(c => c.col));
    const maxCol = Math.max(...prodCells.map(c => c.col));
    const cx = (minCol + (maxCol - minCol) / 2) * cp;
    const cy = grid.rows * cp / 2;
    ctx.fillStyle = '#2a5a2a';
    ctx.font = `bold ${Math.round(cp * 2.2)}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(Math.floor(carsProduced), cx, cy + cp);
    ctx.fillStyle = '#5a8a5a';
    ctx.font = `${Math.round(cp * 0.5)}px monospace`;
    ctx.fillText('CARS MADE', cx, cy + cp * 1.6);
  }

  drawDeliveryTimers(ctx, jobs, now, grid) {
    const cp = CONFIG.CELL_PX;
    const active = jobs.filter(j => j.status !== 'completed');
    if (!active.length) return;

    // Group active jobs by their dropoff cell
    const byDropoff = new Map();
    for (const job of active) {
      const key = `${job.dropoffCell.row},${job.dropoffCell.col}`;
      if (!byDropoff.has(key)) byDropoff.set(key, { cell: job.dropoffCell, jobs: [] });
      byDropoff.get(key).jobs.push(job);
    }

    const bh = Math.max(13, Math.floor(cp * 0.6));
    const bw = Math.max(38, Math.floor(cp * 1.9));
    const gap = 2;

    for (const { cell, jobs: cellJobs } of byDropoff.values()) {
      // Sort most-urgent first
      cellJobs.sort((a, b) => (a.spawnMs + a.graceMs) - (b.spawnMs + b.graceMs));

      // Stack badges to the left of the dropoff cell
      const baseX = cell.col * cp - bw - 2;
      cellJobs.forEach((job, i) => {
        const by2 = cell.row * cp + i * (bh + gap);
        const age  = now - job.spawnMs;
        const pct  = Math.max(0, 1 - age / job.graceMs);
        const rem  = Math.max(0, (job.graceMs - age) / 1000);
        const crit = pct < 0.25;
        const flash = crit && Math.floor(now / 250) % 2 === 0;
        const color = job.robot ? job.robot.color
          : (job.type === 'ft' ? '#e85d04' : '#1971c2');

        // Card background
        ctx.fillStyle = flash ? '#ffd0d0' : '#ffffffee';
        this._roundRect(ctx, baseX, by2, bw, bh, 3);
        ctx.fill();
        ctx.strokeStyle = crit ? '#cc0000' : color;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Left color strip
        ctx.fillStyle = color;
        this._roundRect(ctx, baseX, by2, 3, bh, 2);
        ctx.fill();

        // Timer text
        ctx.fillStyle = crit ? '#cc0000' : '#333';
        ctx.font = `bold ${Math.max(7, Math.floor(bh * 0.58))}px monospace`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(rem.toFixed(1) + 's', baseX + 6, by2 + bh / 2);

        // Robot label (right side) if dispatched
        if (job.robot) {
          ctx.fillStyle = color;
          ctx.font = `${Math.max(6, Math.floor(bh * 0.48))}px monospace`;
          ctx.textAlign = 'right';
          ctx.fillText(job.robot.label, baseX + bw - 3, by2 + bh / 2);
        }

        ctx.textBaseline = 'alphabetic';
      });
    }
  }

  drawModeSelector(ctx, results, canvasW, canvasH) {
    this._modeBtnBounds = [];
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvasW, canvasH);

    ctx.fillStyle = '#1a1a2e';
    ctx.font = 'bold 48px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('FLOOR WARS', canvasW / 2, 85);
    ctx.fillStyle = '#666';
    ctx.font = '17px monospace';
    ctx.fillText('A hallway problem', canvasW / 2, 115);

    const modes = [
      { id: 1, title: 'Mode 1', sub: 'Human Dispatcher',   desc: 'Tap to dispatch robots',       color: '#1a6e1a' },
      { id: 2, title: 'Mode 2', sub: 'Fleet Managers',     desc: 'Autonomous fleet controllers', color: '#1a3e8a' },
      { id: 3, title: 'Mode 3', sub: 'Orchestrated Floor', desc: 'Global coordination',          color: '#7a1a7a' },
    ];
    const bw = 220, bh = 155, gap = 30;
    const totalW = modes.length * bw + (modes.length - 1) * gap;
    const startX = (canvasW - totalW) / 2;

    modes.forEach((m, i) => {
      const bx = startX + i * (bw + gap), by = 145;
      const prev = results.find(r => r.mode === m.id);
      ctx.fillStyle = m.color;
      this._roundRect(ctx, bx, by, bw, bh, 10); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 18px monospace'; ctx.textAlign = 'center';
      ctx.fillText(m.title, bx + bw / 2, by + 28);
      ctx.font = 'bold 12px monospace';
      ctx.fillText(m.sub, bx + bw / 2, by + 46);
      ctx.font = '10px monospace'; ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillText(m.desc, bx + bw / 2, by + 62);
      if (prev) {
        ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.font = 'bold 11px monospace';
        ctx.fillText(`Last: ${prev.carsNotMade.toFixed(1)} cars not made`, bx + bw / 2, by + 86);
        ctx.font = '9px monospace';
        ctx.fillText(`${prev.lineStops} stops · ${prev.jobsCompleted} jobs`, bx + bw / 2, by + 100);
      }
      ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.font = 'bold 13px monospace';
      ctx.fillText('▶ PLAY', bx + bw / 2, by + bh - 15);
      this._modeBtnBounds.push({ modeId: m.id, x: bx, y: by, w: bw, h: bh });
    });

    ctx.fillStyle = '#bbb'; ctx.font = '11px monospace'; ctx.textAlign = 'center';
    ctx.fillText('Floor Wars — tap a mode to begin', canvasW / 2, canvasH - 10);
  }

  drawTransitionScreen(ctx, result, canvasW, canvasH) {
    this._contBtnBounds = null;
    ctx.fillStyle = 'rgba(255,255,255,0.97)';
    ctx.fillRect(0, 0, canvasW, canvasH);

    ctx.fillStyle = '#1a1a2e'; ctx.font = 'bold 30px monospace'; ctx.textAlign = 'center';
    ctx.fillText(`MODE ${result.mode} COMPLETE`, canvasW / 2, 65);
    ctx.strokeStyle = '#ccc'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(150, 80); ctx.lineTo(canvasW - 150, 80); ctx.stroke();

    const rows = [
      ['Cars Not Made',     result.carsNotMade.toFixed(1), true],
      ['Line Stops',        result.lineStops,              false],
      ['Congestion Events', result.congestionEvents,       false],
      ['Avg FT Transit',    result.avgFTTransit > 0 ? result.avgFTTransit.toFixed(1) + 's' : 'N/A', false],
      ['Jobs Completed',    result.jobsCompleted,          false],
    ];
    rows.forEach(([label, val, big], i) => {
      const y = 120 + i * 38;
      ctx.font = big ? 'bold 20px monospace' : '16px monospace';
      ctx.fillStyle = '#333'; ctx.textAlign = 'left';
      ctx.fillText(label + ':', Math.round(canvasW * 0.2), y);
      ctx.textAlign = 'right';
      ctx.fillText(val, Math.round(canvasW * 0.8), y);
    });

    ctx.strokeStyle = '#ccc'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(150, canvasH - 90); ctx.lineTo(canvasW - 150, canvasH - 90); ctx.stroke();

    const bw = 240, bh = 50, bx = canvasW / 2 - bw / 2, by = canvasH - 80;
    ctx.fillStyle = '#1a6e1a'; this._roundRect(ctx, bx, by, bw, bh, 8); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 15px monospace'; ctx.textAlign = 'center';
    ctx.fillText('▶ Back to Menu', canvasW / 2, by + 32);
    this._contBtnBounds = { x: bx, y: by, w: bw, h: bh };
  }

  drawFinalComparison(ctx, results, canvasW, canvasH) {
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvasW, canvasH);
    ctx.fillStyle = '#1a1a2e'; ctx.font = 'bold 26px monospace'; ctx.textAlign = 'center';
    ctx.fillText('FINAL RESULTS', canvasW / 2, 40);

    const cols = [Math.round(canvasW * 0.2), Math.round(canvasW * 0.4), Math.round(canvasW * 0.6), Math.round(canvasW * 0.8)];
    const modeNames = ['Human\nDispatcher', 'Fleet\nManagers', 'Orchestrated\nFloor'];

    ctx.fillStyle = 'rgba(80,200,80,0.12)';
    ctx.fillRect(cols[3] - 95, 48, 190, canvasH - 58);

    ['Mode 1', 'Mode 2', 'Mode 3'].forEach((m, i) => {
      ctx.fillStyle = '#333'; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'center';
      ctx.fillText(m, cols[i + 1], 62);
      ctx.font = '9px monospace'; ctx.fillStyle = '#666';
      modeNames[i].split('\n').forEach((l, j) => ctx.fillText(l, cols[i + 1], 74 + j * 11));
    });
    ctx.strokeStyle = '#333'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(40, 98); ctx.lineTo(canvasW - 40, 98); ctx.stroke();

    const rowDefs = [
      { label: 'Cars Not Made', key: 'carsNotMade',      fmt: v => v.toFixed(1), big: true },
      { label: 'Line Stops',    key: 'lineStops',         fmt: v => v },
      { label: 'Cong. Events',  key: 'congestionEvents',  fmt: v => v },
      { label: 'Avg FT Transit',key: 'avgFTTransit',      fmt: v => v > 0 ? v.toFixed(1) + 's' : 'N/A' },
      { label: 'Jobs Done',     key: 'jobsCompleted',     fmt: v => v },
    ];
    rowDefs.forEach((row, ri) => {
      const ry = 126 + ri * 52;
      if (ri % 2 === 0) { ctx.fillStyle = 'rgba(0,0,0,0.04)'; ctx.fillRect(40, ry - 22, canvasW - 80, 46); }
      ctx.fillStyle = '#222'; ctx.font = row.big ? 'bold 17px monospace' : '13px monospace';
      ctx.textAlign = 'left'; ctx.fillText(row.label, 50, ry);
      if (row.big) {
        const vals = results.map(r => r[row.key]);
        const best = Math.min(...vals.filter(v => v !== undefined));
        results.forEach((r, i) => {
          const v = r[row.key];
          if (v === undefined) return;
          ctx.fillStyle = v === best ? '#1a7a1a' : '#cc2222';
          ctx.font = 'bold 17px monospace'; ctx.textAlign = 'center';
          ctx.fillText(row.fmt(v) + (v === best ? ' ✓' : ' ✗'), cols[i + 1], ry);
        });
      } else {
        results.forEach((r, i) => {
          const v = r[row.key];
          if (v === undefined) return;
          ctx.fillStyle = '#222'; ctx.font = '13px monospace'; ctx.textAlign = 'center';
          ctx.fillText(row.fmt(v), cols[i + 1], ry);
        });
      }
    });

    ctx.strokeStyle = '#333'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(40, canvasH - 30); ctx.lineTo(canvasW - 40, canvasH - 30); ctx.stroke();
    ctx.fillStyle = '#999'; ctx.font = '11px monospace'; ctx.textAlign = 'center';
    ctx.fillText('Tap anywhere to return to menu', canvasW / 2, canvasH - 12);
  }

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}
