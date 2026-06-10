export interface IdentityResetStatus {
  active: boolean;
  progressPercent: number;
  completedActions: string[];
  totalActions: number;
  lastRunAt: string | null;
  currentAction: string | null;
}

const TOTAL_ACTIONS = 8;

class IdentityResetState {
  active        = false;
  progressPercent = 0;
  completedActions: string[] = [];
  totalActions  = TOTAL_ACTIONS;
  lastRunAt: string | null = null;
  currentAction: string | null = null;

  startReset() {
    this.active           = true;
    this.progressPercent  = 0;
    this.completedActions = [];
    this.currentAction    = null;
  }

  recordAction(label: string) {
    this.completedActions.push(label);
    this.currentAction   = label;
    this.progressPercent = Math.round((this.completedActions.length / this.totalActions) * 100);
  }

  completeReset() {
    this.active          = false;
    this.progressPercent = 100;
    this.currentAction   = null;
    this.lastRunAt       = new Date().toISOString();
  }

  reset() {
    this.active           = false;
    this.progressPercent  = 0;
    this.completedActions = [];
    this.currentAction    = null;
    this.lastRunAt        = null;
  }

  snapshot(): IdentityResetStatus {
    return {
      active:           this.active,
      progressPercent:  this.progressPercent,
      completedActions: [...this.completedActions],
      totalActions:     this.totalActions,
      lastRunAt:        this.lastRunAt,
      currentAction:    this.currentAction,
    };
  }
}

export const identityResetStatus = new IdentityResetState();
