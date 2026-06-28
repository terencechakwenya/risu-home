import { runPull } from "./pull";
import { runPush } from "./push";

export { runPull } from "./pull";
export { runPush } from "./push";

// Pull fresh server state into the cache, then flush any queued local writes.
export async function runSync(): Promise<void> {
  await runPull();
  await runPush();
}
