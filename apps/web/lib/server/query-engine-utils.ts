export function resolveQueryLimit(requestLimit: number | undefined, defaultLimit: number) {
  return requestLimit ?? defaultLimit;
}
