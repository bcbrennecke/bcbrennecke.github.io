'use strict';

// ── Grid ─────────────────────────────────────────────────────────────────
class Grid {
  constructor(csvText) {
    this.cells = csvText.trim().split('\n').map(row =>
      row.trim().split(',').map(v => parseInt(v.trim(), 10))
    );
    this.rows = this.cells.length;
    this.cols = this.cells[0].length;
  }

  get(row, col) {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return 0;
    return this.cells[row][col];
  }

  isWalkable(row, col) {
    return this.get(row, col) !== 0;
  }

  cellsOfType(type) {
    const result = [];
    for (let r = 0; r < this.rows; r++)
      for (let c = 0; c < this.cols; c++)
        if (this.cells[r][c] === type) result.push({ row: r, col: c });
    return result;
  }

  cellsOfTypes(types) {
    const set = new Set(types);
    const result = [];
    for (let r = 0; r < this.rows; r++)
      for (let c = 0; c < this.cols; c++)
        if (set.has(this.cells[r][c])) result.push({ row: r, col: c });
    return result;
  }
}

// ── Pathfinder ────────────────────────────────────────────────────────────
class Pathfinder {
  constructor(grid) {
    this.grid = grid;
  }

  findPath(fromRow, fromCol, toRow, toCol) {
    if (!this.grid.isWalkable(toRow, toCol)) return null;

    const key = (r, c) => r * 1000 + c;
    const h = (r, c) => Math.abs(r - toRow) + Math.abs(c - toCol);

    const open = new Map();
    const closed = new Set();

    const startNode = { row: fromRow, col: fromCol, g: 0, f: h(fromRow, fromCol), parent: null };
    open.set(key(fromRow, fromCol), startNode);

    while (open.size > 0) {
      let current = null;
      for (const node of open.values()) {
        if (!current || node.f < current.f) current = node;
      }

      if (current.row === toRow && current.col === toCol) {
        const path = [];
        let n = current;
        while (n) { path.unshift({ row: n.row, col: n.col }); n = n.parent; }
        return path;
      }

      open.delete(key(current.row, current.col));
      closed.add(key(current.row, current.col));

      const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      for (const [dr, dc] of dirs) {
        const nr = current.row + dr, nc = current.col + dc;
        if (!this.grid.isWalkable(nr, nc)) continue;
        // Directional hallway: type 5 = eastbound only, type 6 = westbound only
        const neighborType = this.grid.get(nr, nc);
        if (neighborType === 5 && dc === -1) continue; // can't enter eastbound lane going west
        if (neighborType === 6 && dc === 1)  continue; // can't enter westbound lane going east
        const nk = key(nr, nc);
        if (closed.has(nk)) continue;
        const g = current.g + 1;
        const existing = open.get(nk);
        if (!existing || g < existing.g) {
          open.set(nk, { row: nr, col: nc, g, f: g + h(nr, nc), parent: current });
        }
      }
    }
    return null;
  }
}

// ── CellReservation ───────────────────────────────────────────────────────
class CellReservation {
  constructor() {
    this.claims = new Map();
  }

  _key(row, col) { return `${row},${col}`; }

  claim(row, col, robotId) {
    this.claims.set(this._key(row, col), robotId);
  }

  release(row, col, robotId) {
    const k = this._key(row, col);
    if (this.claims.get(k) === robotId) this.claims.delete(k);
  }

  isClaimed(row, col, excludeId = null) {
    const owner = this.claims.get(this._key(row, col));
    if (owner === undefined) return false;
    if (excludeId !== null && owner === excludeId) return false;
    return true;
  }

  reset() { this.claims.clear(); }
}

// ── HallwayTracker ────────────────────────────────────────────────────────
class HallwayTracker {
  constructor(grid) {
    this._hallawayCells = new Set(
      grid.cellsOfTypes([5, 6]).map(({ row, col }) => `${row},${col}`)
    );
    this._occupants = new Map();
    this._congestionStart = null;
    this._congestionEvents = 0;
    this._ftTransitTimes = [];
  }

  isHallwayCell(row, col) {
    return this._hallawayCells.has(`${row},${col}`);
  }

  // Replace event-based enter/exit with a per-frame sync from actual robot positions.
  // Checks both current cell AND destination cell so robots are counted the moment
  // they start moving into the hallway, not just after they fully arrive.
  sync(robots, now) {
    for (const robot of robots) {
      const key = `${robot.type}_${robot.id}`;
      const inHall = this.isHallwayCell(robot.row, robot.col) ||
        (robot.progress > 0 && robot.state === 'moving' &&
         this.isHallwayCell(robot.nextRow, robot.nextCol));

      const was = this._occupants.has(key);

      if (inHall && !was) {
        this._occupants.set(key, { enterMs: now, isFT: robot.type === 'ft' });
        robot.inHallway = true;
        if (this._occupants.size >= 2 && this._congestionStart === null) {
          this._congestionStart = now;
        }
      } else if (!inHall && was) {
        const info = this._occupants.get(key);
        this._occupants.delete(key);
        robot.inHallway = false;
        if (info && info.isFT) {
          this._ftTransitTimes.push((now - info.enterMs) / 1000);
        }
        if (this._congestionStart !== null && this._occupants.size < 2) {
          const dur = now - this._congestionStart;
          if (dur >= CONFIG.CONGESTION_EVENT_THRESHOLD_MS) this._congestionEvents++;
          this._congestionStart = null;
        }
      }
    }
  }

  get count() { return this._occupants.size; }

  countOfType(type) {
    const isFT = type === 'ft';
    let n = 0;
    for (const info of this._occupants.values()) {
      if (info.isFT === isFT) n++;
    }
    return n;
  }

  get speedMultiplier() {
    return this._occupants.size >= 2 ? CONFIG.HALLWAY_CONGESTION_SPEED_MULTIPLIER : 1.0;
  }

  getAndResetMetrics() {
    const result = {
      congestionEvents: this._congestionEvents,
      ftTransitTimes: [...this._ftTransitTimes],
    };
    this._congestionEvents = 0;
    this._ftTransitTimes = [];
    return result;
  }

  reset() {
    this._occupants.clear();
    this._congestionStart = null;
    this._congestionEvents = 0;
    this._ftTransitTimes = [];
  }
}

// ── Robot ─────────────────────────────────────────────────────────────────
const ROBOT_PALETTE = {
  ft:  ['#e85d04', '#c9184a', '#f48c06', '#9d0208'],
  tug: ['#1971c2', '#6741d9', '#2f9e44', '#0c8599', '#862e9c'],
};

class Robot {
  constructor({ id, type, homeRow, homeCol }) {
    this.id = id;
    this.type = type;
    this.label = type === 'ft' ? `FT${id + 1}` : `T${id + 1}`;
    const palette = ROBOT_PALETTE[type];
    this.color = palette[id % palette.length];

    this.homeRow = homeRow;
    this.homeCol = homeCol;
    this.row = homeRow;
    this.col = homeCol;

    this.progress = 0;
    this.nextRow = homeRow;
    this.nextCol = homeCol;

    this.path = [];
    this.pathIndex = 0;

    this.state = 'idle';
    this.stateTimer = 0;

    this.inHallway = false;

    this.onPathComplete = null;
    this.onCellEntered = null;

    this.pulse = 0;

    this.job = null;
  }

  get baseSpeed() {
    return this.type === 'ft' ? CONFIG.FORK_TRUCK_BASE_SPEED : CONFIG.TUGGER_BASE_SPEED;
  }

  get pixelX() {
    const dx = this.nextCol - this.col;
    return (this.col + dx * this.progress) * CONFIG.CELL_PX;
  }

  get pixelY() {
    const dy = this.nextRow - this.row;
    return (this.row + dy * this.progress) * CONFIG.CELL_PX;
  }

  get dirX() {
    if (this.progress > 0.05) return Math.sign(this.nextCol - this.col);
    return 0;
  }

  get dirY() {
    if (this.progress > 0.05) return Math.sign(this.nextRow - this.row);
    return 0;
  }

  setPath(path) {
    this.path = path;
    this.pathIndex = 0;
    if (path.length > 0) {
      this.row = path[0].row;
      this.col = path[0].col;
      this.nextRow = path[0].row;
      this.nextCol = path[0].col;
      this.progress = 0;
      this.state = 'moving';
    }
  }

  update(dt, now, hallwayTracker) {
    this.pulse = (this.pulse + dt * 3) % (Math.PI * 2);

    if (this.state === 'held' || this.state === 'idle' ||
        this.state === 'at_pickup' || this.state === 'at_dropoff') {
      return;
    }

    if (this.state !== 'moving' && this.state !== 'at_staging') return;
    if (this.state === 'at_staging') return;

    if (this.progress > 0) {
      const speed = this.baseSpeed * (this.inHallway ? hallwayTracker.speedMultiplier : 1.0);
      this.progress += speed * dt;

      if (this.progress >= 1) {
        this.progress = 0;
        this.row = this.nextRow;
        this.col = this.nextCol;

        if (this.onCellEntered) this.onCellEntered(this.row, this.col);

        this.pathIndex++;
        // Only advance to next cell if still moving — onCellEntered may have
        // applied a staging hold by setting state = 'at_staging'.
        if (this.state === 'moving') this._tryAdvance();
      }
      return;
    }

    this._tryAdvance();
  }

  _tryAdvance() {
    if (this.pathIndex >= this.path.length - 1) {
      this.progress = 0;
      this.state = 'idle';
      if (this.onPathComplete) this.onPathComplete();
      return;
    }

    const next = this.path[this.pathIndex + 1];
    this.nextRow = next.row;
    this.nextCol = next.col;
    this.progress = 0.001;
  }

  snapToHome() {
    this.row = this.homeRow;
    this.col = this.homeCol;
    this.nextRow = this.homeRow;
    this.nextCol = this.homeCol;
    this.progress = 0;
    this.path = [];
    this.pathIndex = 0;
    this.state = 'idle';
    this.job = null;
    this.inHallway = false;
    this.stateTimer = 0;
  }
}
