import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function execute_command(command: string, workdir?: string): Promise<string> {
  try {
    const options = workdir ? { cwd: workdir } : {};
    const { stdout, stderr } = await execAsync(command, options);

    if (stderr) {
      console.warn(`[SystemTools] Command stderr: ${stderr}`);
    }

    return stdout;
  } catch (error) {
    throw new Error(`Command execution failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}
