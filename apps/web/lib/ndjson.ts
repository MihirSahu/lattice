export class NdjsonParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NdjsonParseError";
  }
}

export class NdjsonLineParser<T> {
  private buffer = "";

  push(chunk: string): T[] {
    this.buffer += chunk;
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() ?? "";

    return this.parseLines(lines);
  }

  flush(): T[] {
    const line = this.buffer;
    this.buffer = "";

    return this.parseLines(line.trim() ? [line] : []);
  }

  private parseLines(lines: string[]) {
    const values: T[] = [];

    for (const line of lines) {
      if (!line.trim()) {
        continue;
      }

      try {
        values.push(JSON.parse(line) as T);
      } catch (error) {
        throw new NdjsonParseError(error instanceof Error ? error.message : "Failed to parse NDJSON line.");
      }
    }

    return values;
  }
}

export function encodeNdjsonEvent(event: unknown) {
  return `${JSON.stringify(event)}\n`;
}
