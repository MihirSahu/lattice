import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { createStore } from "@tobilu/qmd";

type QmdAction = "update" | "embed";
type QmdStore = Awaited<ReturnType<typeof createStore>>;

const action = process.argv[2];
const dbPath = process.env.QMD_DB_PATH || "/var/lib/qmd/index.sqlite";
const collection = process.env.QMD_COLLECTION || "vault";
const collectionPath = process.env.VAULT_MIRROR_DIR || "/srv/vault-mirror";

function isValidAction(value: string | undefined): value is QmdAction {
  return value === "update" || value === "embed";
}

if (!isValidAction(action)) {
  console.error("Usage: node qmd-admin.js <update|embed>");
  process.exit(1);
}

await mkdir(dirname(dbPath), { recursive: true });

const store: QmdStore = await createStore({
  dbPath,
  config: {
    collections: {
      [collection]: {
        path: collectionPath,
        pattern: "**/*.{md,markdown,txt}"
      }
    }
  }
});

try {
  if (action === "update") {
    const result = await store.update({
      collections: [collection]
    });

    console.log(`UPDATED_FILES=${result.updated ?? 0}`);
    console.log(`INDEXED_FILES=${result.indexed ?? 0}`);
    console.log(`UNCHANGED_FILES=${result.unchanged ?? 0}`);
    console.log(`REMOVED_FILES=${result.removed ?? 0}`);
    console.log(`NEEDS_EMBEDDING=${result.needsEmbedding ?? 0}`);
  }

  if (action === "embed") {
    const result = await store.embed({
      force: false,
      chunkStrategy: "auto"
    });

    console.log(`EMBEDDED_CHUNKS=${result.chunksEmbedded ?? 0}`);
    console.log("SKIPPED_CHUNKS=0");
  }
} finally {
  await store.close();
}
