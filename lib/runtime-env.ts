import { AsyncLocalStorage } from "node:async_hooks";
const context = new AsyncLocalStorage<Record<string, unknown>>();
export function runWithRuntimeEnv<T>(
  env: Record<string, unknown>,
  action: () => T,
): T {
  return context.run({ ...env, __WORKER_RUNTIME: true }, action);
}
export function getRuntimeEnv(): Record<string, unknown> {
  return context.getStore() ?? {};
}
