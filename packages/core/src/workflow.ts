export interface WorkflowStepOptions {
  retries?: number;
  backoffMs?: number;
  rollback?: () => Promise<void>;
}

export interface StepRecord {
  status: "completed" | "failed" | "rolled_back";
  result?: any;
  error?: string;
  completedAt: string;
}

export interface WorkflowRun<TPayload = any, TResult = any> {
  runId: string;
  workflowName: string;
  status: "running" | "completed" | "failed";
  payload: TPayload;
  result?: TResult;
  error?: string;
  steps: Record<string, StepRecord>;
  startedAt: string;
  completedAt?: string;
}

export class WorkflowContext {
  public runId: string;
  public steps: Record<string, StepRecord> = {};
  private rollbacks: Array<{ name: string; rollback: () => Promise<void> }> = [];

  constructor(runId: string, initialSteps: Record<string, StepRecord> = {}) {
    this.runId = runId;
    this.steps = { ...initialSteps };
  }

  public async step<T>(
    stepName: string,
    fn: () => Promise<T>,
    options: WorkflowStepOptions = {}
  ): Promise<T> {
    // 1. Idempotency / Memoization: if step was already completed in this run, return stored result
    const existing = this.steps[stepName];
    if (existing && existing.status === "completed") {
      return existing.result as T;
    }

    const retries = options.retries !== undefined ? options.retries : 3;
    const baseBackoff = options.backoffMs || 50;

    let attempt = 0;
    while (true) {
      try {
        const result = await fn();
        this.steps[stepName] = {
          status: "completed",
          result,
          completedAt: new Date().toISOString()
        };

        if (options.rollback) {
          this.rollbacks.push({ name: stepName, rollback: options.rollback });
        }

        return result;
      } catch (err: any) {
        attempt++;
        if (attempt > retries) {
          this.steps[stepName] = {
            status: "failed",
            error: err.message || String(err),
            completedAt: new Date().toISOString()
          };
          // Trigger saga compensation rollback
          await this.triggerRollbacks();
          throw err;
        }
        // Jittered backoff
        const delay = baseBackoff * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  public async sleep(duration: string | number): Promise<void> {
    const ms = typeof duration === "number" ? duration : parseDurationToMs(duration);
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  public async triggerRollbacks(): Promise<void> {
    // Run rollbacks in reverse order
    for (let i = this.rollbacks.length - 1; i >= 0; i--) {
      const { name, rollback } = this.rollbacks[i]!;
      try {
        await rollback();
        if (this.steps[name]) {
          this.steps[name]!.status = "rolled_back";
        }
      } catch {
        // Continue rollbacks despite individual failure
      }
    }
  }
}

export function parseDurationToMs(str: string): number {
  const match = str.trim().match(/^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d)?$/i);
  if (!match) return 1000;
  const val = parseFloat(match[1]!);
  const unit = (match[2] || "ms").toLowerCase();
  switch (unit) {
    case "ms": return val;
    case "s": return val * 1000;
    case "m": return val * 60 * 1000;
    case "h": return val * 60 * 60 * 1000;
    case "d": return val * 24 * 60 * 60 * 1000;
    default: return val;
  }
}

export class ApexWorkflow<TPayload = any, TResult = any> {
  public name: string;
  private handler: (ctx: WorkflowContext, payload: TPayload) => Promise<TResult>;
  private runs = new Map<string, WorkflowRun<TPayload, TResult>>();

  constructor(
    name: string,
    handler: (ctx: WorkflowContext, payload: TPayload) => Promise<TResult>
  ) {
    this.name = name;
    this.handler = handler;
    workflowRegistry.set(name, this as any);
  }

  public async trigger(payload: TPayload): Promise<WorkflowRun<TPayload, TResult>> {
    const runId = `wf_${this.name}_${Math.random().toString(36).substring(2, 10)}`;
    const ctx = new WorkflowContext(runId);

    const runRecord: WorkflowRun<TPayload, TResult> = {
      runId,
      workflowName: this.name,
      status: "running",
      payload,
      steps: ctx.steps,
      startedAt: new Date().toISOString()
    };
    this.runs.set(runId, runRecord);

    try {
      const result = await this.handler(ctx, payload);
      runRecord.status = "completed";
      runRecord.result = result;
      runRecord.steps = ctx.steps;
      runRecord.completedAt = new Date().toISOString();
      return runRecord;
    } catch (err: any) {
      await ctx.triggerRollbacks();
      runRecord.status = "failed";
      runRecord.error = err.message || String(err);
      runRecord.steps = ctx.steps;
      runRecord.completedAt = new Date().toISOString();
      return runRecord;
    }
  }

  public getRun(runId: string): WorkflowRun<TPayload, TResult> | undefined {
    return this.runs.get(runId);
  }

  public listRuns(): WorkflowRun<TPayload, TResult>[] {
    return Array.from(this.runs.values());
  }
}

export const workflowRegistry = new Map<string, ApexWorkflow>();

export function workflow<TPayload = any, TResult = any>(
  name: string,
  handler: (ctx: WorkflowContext, payload: TPayload) => Promise<TResult>
): ApexWorkflow<TPayload, TResult> {
  return new ApexWorkflow<TPayload, TResult>(name, handler);
}
