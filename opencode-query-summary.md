### `services/opencode-query` Summary

#### High-level structure

`services/opencode-query` is split into two main parts:

- `src/server.ts`: the HTTP API layer
- `src/query-worker.ts`: the isolated worker that performs retrieval and model-based answering

This separation keeps web-server concerns apart from query execution logic.

#### `server.ts`

`server.ts` is responsible for:

- starting the HTTP server
- exposing `GET /health`
- exposing `POST /query`
- parsing the incoming JSON body
- validating the `question`
- normalizing and validating the optional `folder`
- ensuring the folder stays inside `VAULT_MIRROR_DIR`
- spawning a child process to handle the query
- enforcing a timeout
- translating worker success/failure into HTTP responses

#### Key request flow

For `POST /query`, the server:

1. Reads the request body
2. Extracts `question`, `limit`, and `folder`
3. Validates `question`
4. Resolves the local query scope under the vault mirror
5. Calls `runWorker({ question, limit, folder }, scopeRoot)`
6. Returns the worker's JSON result to the client

#### `query-worker.ts`

`query-worker.ts` is responsible for the actual query work:

- reading one JSON payload from `stdin`
- starting a local OpenCode server/client
- locking permissions down to read-only behavior
- searching the vault scope for relevant files and text matches
- reading candidate files
- building excerpts for the prompt
- prompting the model
- validating that returned citations match gathered evidence
- writing final JSON to `stdout`

#### Security posture in the worker

The worker config explicitly denies:

- `edit`
- `bash`
- `webfetch`

This means the worker is designed to answer using local evidence only, without changing files or running commands.

#### How the server passes the question to the worker

The server does not call the worker like a normal function. It starts it as a child process and sends the request payload over standard input.

In `server.ts`, this happens in two steps:

1. It creates the process with `spawn(process.execPath, [workerPath], ...)`.
2. It sends the payload with `child.stdin.end(JSON.stringify(payload))`.

So the worker receives JSON like:

```json
{
  "question": "...",
  "limit": 6,
  "folder": "..."
}
```

`scopeRoot` is not passed in that JSON. It is passed indirectly by setting the child process working directory with `cwd: scopeRoot`.

#### Where the code specifies creation of the query worker process

The worker process is created in `server.ts` with `spawn(process.execPath, [workerPath], ...)`.

Important pieces:

- `process.execPath` is the current Node executable
- `workerPath` points to `query-worker.js`

So this is effectively launching `node query-worker.js`.

The worker file path is built with:

```ts
const workerPath = join(dirname(fileURLToPath(import.meta.url)), "query-worker.js");
```

#### How event handlers work here

If you have mostly seen event handlers in frontend code, the concept is the same in Node:

- an object emits an event
- you register a callback
- the callback runs when that event happens

Browser examples:

- `click`
- `input`
- `change`

Node examples in this code:

- `data` on `stdout`
- `data` on `stderr`
- `error` on the child process
- `close` on the child process

The child process is started with:

```ts
stdio: ["pipe", "pipe", "pipe"]
```

That gives the parent access to the child's:

- `stdin`
- `stdout`
- `stderr`

The code listens for output like this:

```ts
child.stdout.on("data", (chunk) => {
  stdout += chunk.toString("utf8");
});

child.stderr.on("data", (chunk) => {
  stderr += chunk.toString("utf8");
});
```

Meaning:

- when the worker writes normal output, the parent receives `stdout` `"data"` events
- when the worker writes error or debug output, the parent receives `stderr` `"data"` events
- output can arrive in multiple chunks, so the parent appends it into strings

Later:

- `stdout` is parsed as the final JSON result
- `stderr` is used when reporting worker failures

#### Frontend analogy

`child.stdout.on("data", handler)` is conceptually similar to `input.addEventListener("input", handler)`.

Different API, same idea:

- browser DOM often uses `addEventListener(...)`
- Node often uses `.on(...)` from `EventEmitter`

#### `spawn()` lifecycle

`spawn()` starts another OS process and returns immediately with a `ChildProcess` object. It does not behave like a normal function call.

Typical lifecycle:

1. Parent calls `spawn(...)`
2. OS launches the child process
3. Parent immediately gets a `ChildProcess` handle
4. Parent attaches event listeners
5. Parent writes input to `child.stdin`
6. Child runs independently
7. Child emits `stdout` and `stderr` events as it works
8. Child eventually exits
9. Parent handles the `"close"` event and resolves or rejects accordingly

This is why `spawn()` feels different from a normal method call: it is event-driven and process-based, not a direct in-memory call.

#### What the parent process is doing while the child runs

While the child process is running, the parent process is not blocked.

The parent:

- waits for `stdout` and `stderr` events
- waits for `"error"` or `"close"`
- keeps a timeout running
- stays available to handle other async work

In this service, that means the parent HTTP server can still:

- accept other incoming requests
- answer `/health`
- manage multiple worker processes over time

Important distinction:

- the specific request handler is waiting on `await runWorker(...)`
- the overall Node server process is still free to continue servicing the event loop

#### Why `spawn()` is wrapped in a Promise

`spawn()` does not return a Promise. It returns a `ChildProcess`, and completion is communicated through events.

`runWorker()` wraps that event lifecycle in a `Promise` so callers can write `const result = await runWorker(...)`.

This wrapper is needed because `spawn(...)` returns immediately after starting the child process. At that point, the worker has not finished yet, there is no final result yet, and the parent still needs to wait for several later events:

- `stdout` data arriving
- `stderr` data arriving
- startup failures via `error`
- process completion via `close`

Without the Promise, `runWorker()` would return too early, before the server knew whether the worker succeeded, failed, timed out, or produced valid JSON.

The Promise acts as a bridge from the child process event model to the `async` and `await` model:

- start the process now
- listen for events while it runs
- resolve only when the worker has fully completed successfully
- reject if anything goes wrong

In other words, the Promise defines the moment that counts as the worker's real completion.

The Promise:

- resolves when the child exits successfully and `stdout` parses as valid JSON
- rejects on startup error, timeout, non-zero exit, or invalid output

This makes the worker invocation usable with `await`, even though the underlying API is event-based.

#### Why `runWorker()` is not marked `async`

A function does not need to be marked `async` in order to return a Promise.

These are both valid:

```ts
function a() {
  return Promise.resolve(123);
}

async function b() {
  return 123;
}
```

Both effectively return a `Promise<number>`.

The difference is:

- `async` automatically wraps the return value in a Promise
- a non-`async` function must return a Promise explicitly if you want Promise behavior

This is valid:

```ts
function runWorker() {
  return new Promise((resolve, reject) => {
    // adapt event-based child process behavior
  });
}
```

`async` is useful when the function body primarily uses `await` with existing Promises.

For example:

```ts
async function example() {
  const result = await something();
  return result;
}
```

Here, `runWorker()` is adapting an event and callback style API (`spawn`, stream events, process events) into a Promise manually, so returning `new Promise(...)` directly is the natural approach.

Marking it `async` would also work, but it would be unnecessary:

```ts
async function runWorker() {
  return await new Promise(...);
}
```

That adds no real benefit over simply returning the Promise directly.

A good rule of thumb:

- use `async` when your function mostly composes other Promises with `await`
- return `new Promise(...)` when you are adapting callback or event APIs into a Promise

`runWorker()` is in the second category.

#### Does new process creation have to be done this way?

No.

This code uses Node's low-level `spawn()` API because it wants explicit control over:

- creating a fresh process
- passing input over `stdin`
- collecting `stdout` and `stderr`
- enforcing a timeout
- killing the worker if needed
- isolating the worker with its own `cwd`

Frameworks often abstract this away, but that does not necessarily mean they create a new OS process per request.

For example, a framework feature like a server action often means:

- code runs on the server
- request and response serialization is abstracted
- execution happens inside an already-running server runtime

That is not the same thing as explicitly doing `spawn(...)`.

Important distinction:

- server-side execution does not automatically mean a new OS process
- `spawn()` specifically means create a new OS process now

Other implementation options could have been:

1. Same-process function call
2. Worker threads
3. A long-lived child worker process
4. A separate RPC or service boundary

This code appears to have chosen `spawn()` for straightforward per-request isolation and control.

#### Readability assessment

`server.ts` is mostly readable.

What reads well:

- responsibilities are cleanly separated
- helper function names are descriptive
- request flow is straightforward
- worker handoff is explicit

What is denser:

- `runWorker()` combines process startup, stream handling, timeout handling, error handling, and JSON parsing in one function
- the HTTP error-to-status mapping is compact and takes a moment to parse
- the folder safety check is correct but a bit dense on first read

Overall assessment:

- high-level flow is easy to follow
- lower-level child-process mechanics are moderately dense if you have not worked with `spawn()` before

#### Mental model

A simple way to think about the service:

- `server.ts`: Accept an HTTP request, validate it, run a worker, return the result.
- `query-worker.ts`: Search the vault, gather evidence, ask the model using only that evidence, and return structured JSON.

A simple way to think about the child process relationship:

- the server starts a separate helper program
- sends it a question
- listens for its output
- waits for it to finish
- returns the result as the HTTP response
