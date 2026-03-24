export function randomUUID() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).slice(2, 10);
  const extraPart = Math.random().toString(36).slice(2, 10);

  return `${timestamp}-${randomPart}-${extraPart}`;
}
