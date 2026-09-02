import { readFile, writeFile } from 'fs/promises';

export async function read_file(path: string): Promise<string> {
  try {
    return await readFile(path, 'utf-8');
  } catch (error) {
    throw new Error(`Failed to read file ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function write_file(path: string, content: string): Promise<boolean> {
  try {
    await writeFile(path, content, 'utf-8');
    return true;
  } catch (error) {
    throw new Error(`Failed to write file ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
