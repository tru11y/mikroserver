import { promisify } from "util";
import { exec } from "child_process";

const execPromise = promisify(exec);

export async function execAsync(
  command: string,
): Promise<{ stdout: string; stderr: string }> {
  return execPromise(command, { timeout: 10000 });
}
