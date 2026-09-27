import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import test from "node:test";

test("SQLite statements survive garbage collection while the database stays open", () => {
  const require = createRequire(import.meta.url);
  // A native assertion aborts the process, so exercise cleanup in a child.
  const result = spawnSync(process.execPath, ["--expose-gc", "-e", `
    const assert = require('node:assert/strict');
    const vm = require('node:vm');
    const Database = require(process.argv[1]);
    const db = new Database(':memory:');
    db.exec('create table messages (id integer primary key, body text not null)');
    for (let batch = 0; batch < 20; batch++) {
      db.transaction(() => {
        for (let i = 0; i < 100; i++) {
          db.prepare('insert into messages (body) values (?)').run('Synthetic answer');
          assert.equal(db.prepare('select body from messages order by id desc limit 1').get().body, 'Synthetic answer');
        }
      })();
      // Collect disposable statements in both the Node and a separate V8 context.
      global.gc();
      vm.runInNewContext('gc()', { gc: global.gc });
      assert.equal(db.open, true);
      assert.equal(db.prepare('select count(*) as count from messages').get().count, (batch + 1) * 100);
    }
    db.close();
    global.gc();
    console.log('SQLite lifecycle passed');
  `, require.resolve("better-sqlite3")], { encoding: "utf8", timeout: 30_000 });

  assert.ifError(result.error);
  assert.equal(result.signal, null, result.stderr);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /SQLite lifecycle passed/);
});
