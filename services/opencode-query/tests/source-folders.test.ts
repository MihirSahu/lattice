import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { listSourceFolders } from "../dist/source-folders.js";

test("source folders preserve picker paths and depth while excluding hidden and linked directories", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "lattice-sources-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const vault = join(root, "vault");
  for (const directory of ["Books/Reading/Too deep", "Books/.hidden", ".obsidian", "Projects", "Empty"]) {
    await mkdir(join(vault, directory), { recursive: true });
  }
  const outside = join(root, "outside");
  await mkdir(outside);
  await symlink(outside, join(vault, "Linked"), "dir");
  await symlink(vault, join(vault, "Books", "Loop"), "dir");
  await writeFile(join(vault, "note.md"), "# A note\n");

  assert.deepEqual(await listSourceFolders(vault), [
    { id: "Books", title: "Books", path: "Books", depth: 1 },
    { id: "Books/Reading", title: "Books / Reading", path: "Books/Reading", depth: 2 },
    { id: "Empty", title: "Empty", path: "Empty", depth: 1 },
    { id: "Projects", title: "Projects", path: "Projects", depth: 1 }
  ]);
  assert.deepEqual(await listSourceFolders(join(vault, "Empty")), []);
  assert.equal((await listSourceFolders(vault, 1)).length, 3);
  await assert.rejects(listSourceFolders(join(root, "missing")), { code: "ENOENT" });
});
