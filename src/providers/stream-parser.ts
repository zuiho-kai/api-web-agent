export interface SSEEvent {
  event: string | null;
  data: string;
}

export async function* parseSSE(response: Response): AsyncGenerator<SSEEvent> {
  if (!response.body) throw new Error('Response has no body');
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buf = '';
  let currentEvent: string | null = null;

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });

      while (true) {
        const i = buf.indexOf('\n');
        if (i < 0) break;
        const line = buf.slice(0, i).replace(/\r$/, '');
        buf = buf.slice(i + 1);

        if (line === '') {
          currentEvent = null;
          continue;
        }
        if (line.startsWith(':')) continue;
        if (line.startsWith('event:')) {
          currentEvent = line.slice(6).trim();
          continue;
        }
        if (line.startsWith('data:')) {
          yield { event: currentEvent, data: line.slice(5).trim() };
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
