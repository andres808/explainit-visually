import { abortIfNeeded, LearningError } from "./errors";

/** Each caller can leave a shared task; upstream work stops when the last caller leaves. */
export function createCoalescer<T>() {
  type Entry = {
    controller: AbortController;
    promise: Promise<T>;
    clients: number;
  };
  const tasks = new Map<string, Entry>();
  return (
    key: string,
    create: (signal: AbortSignal) => Promise<T>,
    signal?: AbortSignal,
  ): Promise<T> => {
    abortIfNeeded(signal);
    let entry = tasks.get(key);
    if (!entry) {
      const controller = new AbortController();
      const created: Entry = {
        controller,
        promise: Promise.resolve(undefined as T),
        clients: 0,
      };
      created.promise = create(controller.signal).finally(() => {
        if (tasks.get(key) === created) tasks.delete(key);
      });
      tasks.set(key, created);
      entry = created;
    }
    const current = entry;
    current.clients++;
    return new Promise((resolve, reject) => {
      let done = false;
      const finish = (error?: unknown, value?: T) => {
        if (done) return;
        done = true;
        signal?.removeEventListener("abort", cancel);
        current.clients--;
        if (current.clients === 0 && tasks.get(key) === current) {
          tasks.delete(key);
          current.controller.abort();
        }
        if (error) reject(error);
        else resolve(value!);
      };
      const cancel = () =>
        finish(
          new LearningError("CANCELLED", "This request was cancelled.", 499),
        );
      signal?.addEventListener("abort", cancel, { once: true });
      current.promise.then(
        (value) => finish(undefined, value),
        (error) => finish(error),
      );
    });
  };
}
