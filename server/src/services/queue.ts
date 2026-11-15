/** Runs jobs with limited concurrency. `run` resolves when that job finishes (or fails). */
export type VerificationQueue = {
  run(id: string, job: () => Promise<void>): Promise<void>;
  /** Resolves when everything queued so far is done (tests, shutdown). */
  idle(): Promise<void>;
};

export function createQueue(concurrency = 2): VerificationQueue {
  const waiting: (() => void)[] = [];
  const inFlight = new Map<string, Promise<void>>();
  let active = 0;

  const acquire = () =>
    new Promise<void>((resolve) => {
      if (active < concurrency) {
        active += 1;
        resolve();
      } else {
        waiting.push(() => {
          active += 1;
          resolve();
        });
      }
    });
  const release = () => {
    active -= 1;
    waiting.shift()?.();
  };

  return {
    run(id, job) {
      const existing = inFlight.get(id);
      if (existing) return existing;
      const p = (async () => {
        await acquire();
        try {
          await job();
        } catch (e) {
          console.error(`verification ${id} failed`, e);
        } finally {
          release();
          inFlight.delete(id);
        }
      })();
      inFlight.set(id, p);
      return p;
    },
    async idle() {
      while (inFlight.size) await Promise.all([...inFlight.values()]);
    },
  };
}
