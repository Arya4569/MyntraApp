const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const NotificationService = require('./notificationService');

const STATE_FILE = path.join(__dirname, '..', '..', 'data', 'scheduler_state.json');

class SchedulerService {
  constructor() {
    this.cronTasks = new Map();
    this.jobLocks = new Map();
    this.state = this.loadState();
    this.initialized = false;
  }

  loadState() {
    try {
      if (fs.existsSync(STATE_FILE)) {
        const raw = fs.readFileSync(STATE_FILE, 'utf8');
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn('[Scheduler] Error loading state file:', e.message);
    }
    return {
      abandoned_carts: {
        lastRun: null,
        lastCompleted: null,
        executionCount: 0,
        lastResult: null,
      },
    };
  }

  saveState() {
    try {
      const dir = path.dirname(STATE_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(STATE_FILE, JSON.stringify(this.state, null, 2), 'utf8');
    } catch (e) {
      console.warn('[Scheduler] Error saving state file:', e.message);
    }
  }

  /**
   * Initialize all background scheduled jobs
   */
  init() {
    if (this.initialized) {
      return this.getStatus();
    }

    const cronExpr = process.env.ABANDONED_CART_CRON || '0 * * * *'; // Default every hour on the hour

    if (cron.validate(cronExpr)) {
      const task = cron.schedule(cronExpr, async () => {
        await this.runJob('abandoned_carts');
      });
      this.cronTasks.set('abandoned_carts', {
        task,
        cronExpr,
        enabled: true,
      });
      console.log(`[Scheduler] Abandoned-cart reminder job scheduled with cron "${cronExpr}".`);
    } else {
      console.warn(`[Scheduler] Invalid cron expression for abandoned_carts: "${cronExpr}".`);
    }

    this.initialized = true;
    return this.getStatus();
  }

  /**
   * Run a registered job safely with locking, deduplication, and persistence
   */
  async runJob(jobName = 'abandoned_carts') {
    if (this.jobLocks.get(jobName)) {
      console.log(`[Scheduler] Job "${jobName}" is already currently running. Skipping duplicate trigger.`);
      return { skipped: true, reason: 'Job currently in progress (locked)' };
    }

    this.jobLocks.set(jobName, true);
    const startTime = new Date().toISOString();

    if (!this.state[jobName]) {
      this.state[jobName] = {
        lastRun: null,
        lastCompleted: null,
        executionCount: 0,
        lastResult: null,
      };
    }
    this.state[jobName].lastRun = startTime;
    this.saveState();

    try {
      let result = null;
      if (jobName === 'abandoned_carts') {
        result = await NotificationService.checkAbandonedCarts();
      } else {
        throw new Error(`Unknown job name: ${jobName}`);
      }

      this.state[jobName].lastCompleted = new Date().toISOString();
      this.state[jobName].executionCount = (this.state[jobName].executionCount || 0) + 1;
      this.state[jobName].lastResult = result;
      this.saveState();

      console.log(`[Scheduler] Job "${jobName}" finished successfully:`, result);
      return { success: true, result, startTime, completedTime: this.state[jobName].lastCompleted };
    } catch (err) {
      console.error(`[Scheduler] Job "${jobName}" failed:`, err);
      this.state[jobName].lastError = err.message;
      this.saveState();
      return { success: false, error: err.message };
    } finally {
      this.jobLocks.set(jobName, false);
    }
  }

  /**
   * Get live scheduler status and job metrics
   */
  getStatus() {
    const jobs = [];
    for (const [name, meta] of this.cronTasks.entries()) {
      const jobState = this.state[name] || {};
      jobs.push({
        name,
        cron: meta.cronExpr,
        enabled: meta.enabled,
        isLocked: !!this.jobLocks.get(name),
        lastRun: jobState.lastRun || null,
        lastCompleted: jobState.lastCompleted || null,
        executionCount: jobState.executionCount || 0,
        lastResult: jobState.lastResult || null,
        lastError: jobState.lastError || null,
      });
    }

    return {
      initialized: this.initialized,
      jobsCount: jobs.length,
      jobs,
    };
  }

  /**
   * Stop all scheduled cron jobs (for graceful shutdown or testing)
   */
  stop() {
    for (const [name, meta] of this.cronTasks.entries()) {
      if (meta.task) {
        meta.task.stop();
      }
    }
    this.cronTasks.clear();
    this.initialized = false;
  }
}

module.exports = new SchedulerService();
