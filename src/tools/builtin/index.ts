import { ToolRegistry } from '../registry';
import { webFetch } from './web-fetch';
import { webSearch } from './web-search';

export function createDefaultRegistry(): ToolRegistry {
  const r = new ToolRegistry();
  r.register(webSearch);
  r.register(webFetch);
  return r;
}

export { webSearch, webFetch };
