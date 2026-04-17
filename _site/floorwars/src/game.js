'use strict';

// ── Utility ───────────────────────────────────────────────────────────────
function range(a, b) {
  const r = [];
  for (let i = a; i <= b; i++) r.push(i);
  return r;
}

// ── JobSystem ─────────────────────────────────────────────────────────────
class JobSystem {
  constructor(grid) {
    this.grid = grid;
    this._jobs = [];
    this._idSeq = 0;
    // Initial spawn timers — use CONFIG so changes take effect immediately
    const ftMin  = CONFIG.FORK_TRUCK_MIN_SPAWN_INTERVAL_MS * CONFIG.FORK_TRUCK_JOB_RATE_MULTIPLIER;
    const ftMax  = CONFIG.FORK_TRUCK_MAX_SPAWN_INTERVAL_MS * CONFIG.FORK_TRUCK_JOB_RATE_MULTIPLIER;
    const tugMin = CONFIG.TUGGER_MIN_SPAWN_INTERVAL_MS     * CONFIG.TUGGER_JOB_RATE_MULTIPLIER;
    const tugMax = CONFIG.TUGGER_MAX_SPAWN_INTERVAL_MS     * CONFIG.TUGGER_JOB_RATE_MULTIPLIER;
    this._ftSpawnMs  = ftMin  + Math.random() * (ftMax  - ftMin);
    this._tugSpawnMs = tugMin + Math.random() * (tugMax - tugMin);
    this.lineRunning = true;
    this._lineStopMs = 0;
    this._lineStopStart = null;

    this._ftPickups   = grid.cellsOfTypes(range(10, 19));
    this._ftDropoffs  = grid.cellsOfTypes(range(20, 29));
    this._tugPickups  = grid.cellsOfTypes(range(30, 39));
    this._tugDropoffs = grid.cellsOfTypes(range(40, 49));
  }

  get jobs() { return this._jobs; }

  update(dt, now, mode, onNewJob) {
    this._ftSpawnMs  -= dt * 1000;
    this._tugSpawnMs -= dt * 1000;

    if (this._ftSpawnMs <= 0) {
      const job = this._spawnJob('ft', now);
      if (onNewJob) onNewJob(job);
      const min = CONFIG.FORK_TRUCK_MIN_SPAWN_INTERVAL_MS * CONFIG.FORK_TRUCK_JOB_RATE_MULTIPLIER;
      const max = CONFIG.FORK_TRUCK_MAX_SPAWN_INTERVAL_MS * CONFIG.FORK_TRUCK_JOB_RATE_MULTIPLIER;
      this._ftSpawnMs = min + Math.random() * (max - min);
    }
    if (this._tugSpawnMs <= 0) {
      const job = this._spawnJob('tug', now);
      if (onNewJob) onNewJob(job);
      const min = CONFIG.TUGGER_MIN_SPAWN_INTERVAL_MS * CONFIG.TUGGER_JOB_RATE_MULTIPLIER;
      const max = CONFIG.TUGGER_MAX_SPAWN_INTERVAL_MS * CONFIG.TUGGER_JOB_RATE_MULTIPLIER;
      this._tugSpawnMs = min + Math.random() * (max - min);
    }

    for (const job of this._jobs) {
      if (job.lineStopFired || job.status === 'completed') continue;
      if (now - job.spawnMs >= job.graceMs) {
        job.lineStopFired = true;
        this.lineRunning = false;
        if (this._lineStopStart === null) this._lineStopStart = now;
      }
    }

    if (!this.lineRunning) {
      this._lineStopMs += dt * 1000;
    }
  }

  completeJob(jobId, now) {
    const job = this._jobs.find(j => j.id === jobId);
    if (!job || job.status === 'completed') return;
    job.status = 'completed';

    if (job.lineStopFired) {
      const anyActive = this._jobs.some(j => j !== job && j.lineStopFired && j.status !== 'completed');
      if (!anyActive) {
        this.lineRunning = true;
        this._lineStopStart = null;
      }
    }
    return job;
  }

  getMetrics() {
    return {
      lineStops: this._jobs.filter(j => j.lineStopFired).length,
      lineStopTotalMs: this._lineStopMs,
      carsNotMade: (this._lineStopMs / 60000) * CONFIG.CARS_PER_MINUTE_RATE,
      jobsCompleted: this._jobs.filter(j => j.status === 'completed').length,
    };
  }

  getFtNextSpawnMs() { return this._ftSpawnMs; }

  _spawnJob(type, now) {
    const pickups  = type === 'ft' ? this._ftPickups  : this._tugPickups;
    const dropoffs = type === 'ft' ? this._ftDropoffs : this._tugDropoffs;
    const pickup  = pickups[Math.floor(Math.random() * pickups.length)];
    const dropoff = dropoffs[Math.floor(Math.random() * dropoffs.length)];
    const displayId = String(this._idSeq % 100).padStart(2, '0');
    const job = {
      id: this._idSeq++,
      displayId,
      type,
      priority: type === 'ft' ? 1 : 2,
      pickupCell:  pickup,
      dropoffCell: dropoff,
      spawnMs: now,
      graceMs: type === 'ft' ? CONFIG.FORK_TRUCK_GRACE_PERIOD_MS : CONFIG.TUGGER_GRACE_PERIOD_MS,
      status: 'pending',
      robot: null,
      lineStopFired: false,
    };
    this._jobs.push(job);
    return job;
  }
}

// ── Robot factory ─────────────────────────────────────────────────────────
function createFleet(grid) {
  const ftHomes  = grid.cellsOfTypes(range(50, 59));
  const tugHomes = grid.cellsOfTypes(range(60, 69));
  const robots = [];
  for (let i = 0; i < CONFIG.FORK_TRUCK_COUNT && i < ftHomes.length; i++) {
    robots.push(new Robot({ id: i, type: 'ft', homeRow: ftHomes[i].row, homeCol: ftHomes[i].col }));
  }
  for (let i = 0; i < CONFIG.TUGGER_COUNT && i < tugHomes.length; i++) {
    robots.push(new Robot({ id: i, type: 'tug', homeRow: tugHomes[i].row, homeCol: tugHomes[i].col }));
  }
  return robots;
}

// ── Dispatch helpers ──────────────────────────────────────────────────────
function idleRobots(robots, type) {
  return robots.filter(r => r.type === type && r.state === 'idle' && r.job === null);
}

function nearestIdle(robots, type, toRow, toCol) {
  const pool = idleRobots(robots, type);
  if (!pool.length) return null;
  return pool.reduce((best, r) => {
    const db = Math.abs(best.row - toRow) + Math.abs(best.col - toCol);
    const dr = Math.abs(r.row    - toRow) + Math.abs(r.col    - toCol);
    return dr < db ? r : best;
  });
}

// ── Robot assignment ──────────────────────────────────────────────────────
function assignJob(robot, job, pathfinder) {
  job.status = 'dispatched';
  job.robot  = robot;
  robot.job  = job;

  const path = pathfinder.findPath(robot.row, robot.col, job.pickupCell.row, job.pickupCell.col);
  if (!path) { console.warn('No path to pickup for robot', robot.id); return; }

  robot.setPath(path);
  robot.state = 'moving';

  robot.onPathComplete = () => {
    robot.state = 'at_pickup';
    robot.stateTimer = 0;
  };
}

function continueToDropoff(robot, job, pathfinder) {
  const path = pathfinder.findPath(robot.row, robot.col, job.dropoffCell.row, job.dropoffCell.col);
  if (!path) {
    console.warn('No path to dropoff for robot', robot.id, '— forcing at_dropoff');
    robot.state = 'at_dropoff';
    robot.stateTimer = 0;
    return;
  }
  robot.setPath(path);
  robot.state = 'moving';
  robot.onPathComplete = () => {
    robot.state = 'at_dropoff';
    robot.stateTimer = 0;
  };
}

function returnHome(robot, pathfinder) {
  const path = pathfinder.findPath(robot.row, robot.col, robot.homeRow, robot.homeCol);
  if (!path) { robot.snapToHome(); return; }
  robot.setPath(path);
  robot.state = 'moving';
  robot.onPathComplete = () => {
    robot.snapToHome();
  };
}

// ── StagingManager ────────────────────────────────────────────────────────
// Two fixed staging zones: east entry (row 9, col 11) and west entry (row 10, col 24).
// Each zone maintains FIFO queues for robots waiting to enter the hallway.
// Mode 2: per-fleet queues (FTs yield to FTs, TUGs yield to TUGs, no cross-fleet stop).
// Mode 3: shared queue (all bots yield to any bot in hallway; TUGs preempt on release).
class StagingManager {
  constructor() {
    this.zones = {
      east: { row: 9,  col: 11, ftQueue: [], tugQueue: [], sharedQueue: [] },
      west: { row: 10, col: 24, ftQueue: [], tugQueue: [], sharedQueue: [] },
    };
  }

  reset() {
    for (const z of Object.values(this.zones)) {
      // Release any held robots so they aren't frozen across modes
      for (const r of [...z.ftQueue, ...z.tugQueue, ...z.sharedQueue]) {
        r.state = 'moving';
        r.holdStartMs = null;
      }
      z.ftQueue = [];
      z.tugQueue = [];
      z.sharedQueue = [];
    }
  }

  // Called from robot.onCellEntered when robot arrives at a staging cell.
  // ALWAYS holds when the robot's next step is a hallway cell — unconditional
  // enqueue eliminates the race where two robots arrive at different staging
  // cells in the same frame and both see hallwayCount=0.
  // tryReleaseAll() releases immediately next frame when the hallway is clear.
  checkAndHold(robot, mode, hallwayTracker, now) {
    const zone = this._zoneAt(robot.row, robot.col);
    if (!zone) return false;

    // pathIndex hasn't been incremented yet when onCellEntered fires, so:
    //   path[pathIndex]   = previous cell
    //   path[pathIndex+1] = current cell (staging zone, just arrived)
    //   path[pathIndex+2] = next step  ← must be hallway to warrant a hold
    const nextStep = robot.path[robot.pathIndex + 2];
    if (!nextStep || !hallwayTracker.isHallwayCell(nextStep.row, nextStep.col)) return false;

    // Always hold — tryReleaseAll will release this robot next frame if hallway is clear
    robot.state = 'at_staging';
    robot.holdStartMs = now;

    if (mode === 2) {
      const q = robot.type === 'ft' ? zone.ftQueue : zone.tugQueue;
      if (!q.includes(robot)) q.push(robot);
    } else {
      if (!zone.sharedQueue.includes(robot)) zone.sharedQueue.push(robot);
    }
    return true;
  }

  // Called once per frame after hallwayTracker.sync(). Coordinates releases
  // across BOTH zones so we never release more than one robot per type (mode 2)
  // or one robot total (mode 3) in a single frame.
  tryReleaseAll(mode, hallwayTracker, now) {
    const zones = Object.values(this.zones);

    // Safety timeouts: force-release any robot held too long
    for (const zone of zones) {
      const allQueued = mode === 2
        ? [...zone.ftQueue, ...zone.tugQueue]
        : [...zone.sharedQueue];
      for (const robot of allQueued) {
        if (robot.holdStartMs && (now - robot.holdStartMs) >= CONFIG.STAGING_AREA_MAX_HOLD_MS) {
          this._release(robot, zone, mode);
        }
      }
    }

    if (mode === 2) {
      // Release at most ONE FT and ONE TUG across all zones this frame.
      // This prevents the race where east and west zones each release a robot
      // of the same type before the hallway tracker registers the first entry.
      if (hallwayTracker.countOfType('ft') === 0) {
        for (const zone of zones) {
          if (zone.ftQueue.length > 0) { this._release(zone.ftQueue[0], zone, mode); break; }
        }
      }
      if (hallwayTracker.countOfType('tug') === 0) {
        for (const zone of zones) {
          if (zone.tugQueue.length > 0) { this._release(zone.tugQueue[0], zone, mode); break; }
        }
      }
    } else {
      // Mode 3: release at most ONE robot total. Tuggers preempt.
      if (hallwayTracker.count === 0) {
        for (const zone of zones) {
          if (zone.sharedQueue.length === 0) continue;
          const idx = zone.sharedQueue.findIndex(r => r.type === 'tug');
          const robot = idx >= 0 ? zone.sharedQueue.splice(idx, 1)[0] : zone.sharedQueue.shift();
          robot.state = 'moving';
          robot.holdStartMs = null;
          break; // one robot total across all zones
        }
      }
    }
  }

  _release(robot, zone, mode) {
    if (mode === 2) {
      const q = robot.type === 'ft' ? zone.ftQueue : zone.tugQueue;
      const i = q.indexOf(robot);
      if (i >= 0) q.splice(i, 1);
    } else {
      const i = zone.sharedQueue.indexOf(robot);
      if (i >= 0) zone.sharedQueue.splice(i, 1);
    }
    robot.state = 'moving';
    robot.holdStartMs = null;
  }

  _zoneAt(row, col) {
    for (const z of Object.values(this.zones)) {
      if (z.row === row && z.col === col) return z;
    }
    return null;
  }

  isStaginCell(row, col) {
    return !!this._zoneAt(row, col);
  }
}

// ── FloorWarsGame ─────────────────────────────────────────────────────────
class FloorWarsGame {
  constructor({ grid, pathfinder, hallwayTracker }) {
    this.grid = grid;
    this.pathfinder = pathfinder;
    this.hallwayTracker = hallwayTracker;
    this.stagingManager = new StagingManager();

    this.phase = 'select';
    this.mode  = 1;
    this.timer = CONFIG.SESSION_DURATION_SECONDS;
    this.results = [];

    this.robots = [];
    this.jobSystem = null;
    this.carsProduced = 0;
  }

  startMode(mode) {
    this.mode  = mode;
    this.phase = 'running';
    this.timer = CONFIG.SESSION_DURATION_SECONDS;
    this.carsProduced = 0;

    this.hallwayTracker.reset();
    this.stagingManager.reset();

    this.robots = createFleet(this.grid);
    this._wireRobotCallbacks();

    this.jobSystem = new JobSystem(this.grid);
  }

  // Set onCellEntered on every robot to handle staging checks (Modes 2 & 3).
  _wireRobotCallbacks() {
    for (const robot of this.robots) {
      robot.onCellEntered = (row, col) => {
        if (this.mode >= 2) {
          this.stagingManager.checkAndHold(robot, this.mode, this.hallwayTracker, performance.now());
        }
      };
    }
  }

  update(dt, now) {
    if (this.phase !== 'running') return;

    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = 0;
      this._endMode(now);
      return;
    }

    this.jobSystem.update(dt, now, this.mode, (newJob) => {
      if (this.mode === 2) this._tryAutoDispatch(newJob);
    });

    // Mode 2: re-sweep any pending jobs that weren't dispatched at spawn time
    // (e.g. all robots were busy when the job was created)
    if (this.mode === 2) {
      for (const job of this.jobSystem.jobs) {
        if (job.status === 'pending') this._tryAutoDispatch(job);
      }
    }

    if (this.mode === 3) this._orchestrate(now);

    // Sync hallway occupancy from actual robot positions before updating movement
    this.hallwayTracker.sync(this.robots, now);

    // Release any staged robots now that the hallway state is updated.
    // Single coordinated call so both zones can't release the same type in one frame.
    if (this.mode >= 2) {
      this.stagingManager.tryReleaseAll(this.mode, this.hallwayTracker, now);
    }

    for (const robot of this.robots) {
      robot.update(dt, now, this.hallwayTracker);
      this._handleRobotStateTransitions(robot, dt, now);
    }

    if (this.jobSystem.lineRunning) {
      this.carsProduced += (CONFIG.CARS_PER_MINUTE_RATE / 60) * dt;
    }
  }

  _handleRobotStateTransitions(robot, dt, now) {
    if (robot.state === 'at_pickup') {
      robot.stateTimer += dt;
      if (robot.stateTimer >= CONFIG.PICKUP_DURATION_SEC) {
        robot.stateTimer = 0;
        if (robot.job) continueToDropoff(robot, robot.job, this.pathfinder);
      }
    } else if (robot.state === 'at_dropoff') {
      robot.stateTimer += dt;
      if (robot.stateTimer >= CONFIG.DROPOFF_DURATION_SEC) {
        robot.stateTimer = 0;
        if (robot.job) this.jobSystem.completeJob(robot.job.id, now);
        returnHome(robot, this.pathfinder);
      }
    }
  }

  _tryAutoDispatch(job) {
    const robot = nearestIdle(this.robots, job.type, job.pickupCell.row, job.pickupCell.col);
    if (robot) assignJob(robot, job, this.pathfinder);
  }

  _orchestrate(now) {
    // Dispatch all pending FT jobs to nearest idle FTs
    const pendingFT = this.jobSystem.jobs.filter(j => j.type === 'ft' && j.status === 'pending');
    for (const job of pendingFT) {
      const robot = nearestIdle(this.robots, 'ft', job.pickupCell.row, job.pickupCell.col);
      if (!robot) break;
      assignJob(robot, job, this.pathfinder);
    }

    // Dispatch all pending tugger jobs to nearest idle tuggers
    const pendingTug = this.jobSystem.jobs.filter(j => j.type === 'tug' && j.status === 'pending');
    for (const job of pendingTug) {
      const robot = nearestIdle(this.robots, 'tug', job.pickupCell.row, job.pickupCell.col);
      if (!robot) break;
      assignJob(robot, job, this.pathfinder);
    }
  }

  humanDispatch(jobId) {
    const job = this.jobSystem.jobs.find(j => j.id === jobId);
    if (!job || job.status !== 'pending') return;
    const robot = nearestIdle(this.robots, job.type, job.pickupCell.row, job.pickupCell.col);
    if (!robot) return;
    assignJob(robot, job, this.pathfinder);
  }

  _endMode(now) {
    const jobMetrics = this.jobSystem.getMetrics();
    const hwMetrics  = this.hallwayTracker.getAndResetMetrics();
    const avgFT = hwMetrics.ftTransitTimes.length > 0
      ? hwMetrics.ftTransitTimes.reduce((a, b) => a + b, 0) / hwMetrics.ftTransitTimes.length
      : 0;

    this.results.push({
      mode: this.mode,
      carsNotMade: jobMetrics.carsNotMade,
      lineStops: jobMetrics.lineStops,
      congestionEvents: hwMetrics.congestionEvents,
      avgFTTransit: avgFT,
      jobsCompleted: jobMetrics.jobsCompleted,
    });

    this.phase = 'transition';
  }

  backToMenu() {
    this.phase = 'select';
  }

  showComparison() {
    this.phase = 'comparison';
  }
}
