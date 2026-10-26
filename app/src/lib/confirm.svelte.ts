export interface Step {
  title: string;
  body: string;
  /** label of the button that goes ahead */
  ok: string;
}
export interface Ask {
  steps: Step[];
  danger?: boolean;
}

/** An in-app confirmation. Each step must be accepted in turn; `ask` resolves true only if all are. */
class Confirm {
  current = $state<Ask | null>(null);
  step = $state(0);
  private done: ((v: boolean) => void) | null = null;

  ask(a: Ask): Promise<boolean> {
    this.done?.(false);
    this.current = a;
    this.step = 0;
    return new Promise((res) => (this.done = res));
  }
  accept() {
    if (!this.current) return;
    if (this.step < this.current.steps.length - 1) this.step++;
    else this.finish(true);
  }
  cancel() {
    this.finish(false);
  }
  private finish(v: boolean) {
    this.current = null;
    this.done?.(v);
    this.done = null;
  }
}

export const confirm = new Confirm();
