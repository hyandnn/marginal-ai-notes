async function simulateStream(text, onChunk, chunkSize = 4, delayMs = 18) {
  let full = "";
  for (let i = 0; i < text.length; i += chunkSize) {
    const delta = text.slice(i, i + chunkSize);
    full += delta;
    onChunk(delta, full);
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return full;
}
