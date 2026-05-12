const GITHUB_URL = 'https://github.com/zuiho-kai/api-web-agent';
const REPO = 'zuiho-kai/api-web-agent';

function GithubIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

export function Footer() {
  return (
    <div className="px-3 py-3 border-t border-zinc-200 text-[10px] text-zinc-500 space-y-2">
      <div className="flex items-center justify-between">
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noreferrer noopener"
          className="font-semibold text-zinc-700 hover:text-zinc-900"
        >
          api-web-agent
        </a>
        <a
          href={`${GITHUB_URL}/stargazers`}
          target="_blank"
          rel="noreferrer noopener"
          title="Give it a star ⭐"
        >
          <img
            alt="GitHub stars"
            src={`https://img.shields.io/github/stars/${REPO}?style=social`}
            className="h-3.5"
          />
        </a>
      </div>

      <div className="text-zinc-400 leading-snug">
        0 后端 · BYO key · 多 provider 的浏览器侧 AI Agent
      </div>

      <div className="flex flex-wrap gap-1">
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-zinc-100 rounded hover:bg-zinc-200 text-zinc-700"
        >
          <GithubIcon /> GitHub
        </a>
        <a
          href={`${GITHUB_URL}/issues`}
          target="_blank"
          rel="noreferrer noopener"
          className="px-1.5 py-0.5 bg-zinc-100 rounded hover:bg-zinc-200 text-zinc-700"
          title="提 issue / 反馈"
        >
          Issues
        </a>
        <a
          href={`${GITHUB_URL}#readme`}
          target="_blank"
          rel="noreferrer noopener"
          className="px-1.5 py-0.5 bg-zinc-100 rounded hover:bg-zinc-200 text-zinc-700"
        >
          README
        </a>
        <a
          href={`${GITHUB_URL}/blob/master/LICENSE`}
          target="_blank"
          rel="noreferrer noopener"
          className="px-1.5 py-0.5 bg-zinc-100 rounded hover:bg-zinc-200 text-zinc-700"
        >
          MIT
        </a>
      </div>

      <div className="text-zinc-400 text-[9px] pt-1 border-t border-zinc-100">
        Built with Claude · 喜欢的话给个 ⭐
      </div>
    </div>
  );
}
