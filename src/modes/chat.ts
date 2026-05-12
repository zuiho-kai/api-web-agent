export interface Mode {
  id: string;
  label: string;
  buildSystemPrompt(): string;
  allowedTools: string[];
}

export const chatMode: Mode = {
  id: 'chat',
  label: 'Chat',
  allowedTools: ['web_search', 'web_fetch'],
  buildSystemPrompt() {
    const today = new Date().toISOString().slice(0, 10);
    return `You are a helpful general-purpose AI assistant.

Available tools:
- web_search(query): Search the web for current information. Use this for any question requiring fresh data (today's news, weather, current prices, recent events, latest releases).
- web_fetch(url): Fetch and read a specific URL. Use this when the user gives you a URL or when search results contain a promising URL to read in detail.

Guidelines:
- When the user asks about anything time-sensitive or recent, search first. Don't rely on training data for "today" / "now" / "latest".
- Cite sources by including the URL in your answer.
- Reply in the same language the user used.
- Be concise.

Today's date: ${today}`;
  },
};

export const modes: Record<string, Mode> = {
  chat: chatMode,
};
