import { readdir } from "node:fs/promises";
import { join } from "node:path";

export type SourceFolder = {
  id: string;
  title: string;
  path: string;
  depth: number;
};

export async function listSourceFolders(rootPath: string, maxDepth = 2): Promise<SourceFolder[]> {
  const folders: SourceFolder[] = [];

  async function walk(currentPath: string, segments: string[]) {
    if (segments.length >= maxDepth) return;

    const entries = await readdir(currentPath, { withFileTypes: true });
    const directories = entries
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
      .sort((left, right) => left.name.localeCompare(right.name));

    for (const directory of directories) {
      const nextSegments = [...segments, directory.name];
      const relativePath = nextSegments.join("/");
      folders.push({
        id: relativePath,
        title: nextSegments.join(" / "),
        path: relativePath,
        depth: nextSegments.length
      });
      await walk(join(currentPath, directory.name), nextSegments);
    }
  }

  await walk(rootPath, []);
  return folders;
}
