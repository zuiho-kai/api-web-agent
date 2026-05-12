import { ToolRegistry } from '../registry';
import { bundleFiles } from './bundle-files';
import { webFetch } from './web-fetch';
import { webSearch } from './web-search';

export function createDefaultRegistry(): ToolRegistry {
  const r = new ToolRegistry();
  r.register(webSearch);
  r.register(webFetch);
  r.register(bundleFiles);
  return r;
}

export { webSearch, webFetch, bundleFiles };
