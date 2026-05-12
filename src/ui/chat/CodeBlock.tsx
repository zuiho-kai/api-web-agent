import React, { useState } from 'react';

interface Props {
  language: string;
  text: string;
  children: React.ReactNode;
}

const LANG_TO_EXT: Record<string, string> = {
  typescript: 'ts', javascript: 'js', tsx: 'tsx', jsx: 'jsx',
  python: 'py', rust: 'rs', go: 'go', java: 'java',
  cpp: 'cpp', c: 'c', csharp: 'cs', swift: 'swift', kotlin: 'kt',
  ruby: 'rb', php: 'php',
  sh: 'sh', bash: 'sh', shell: 'sh', zsh: 'sh',
  yaml: 'yaml', yml: 'yml', toml: 'toml', json: 'json', xml: 'xml',
  html: 'html', css: 'css', scss: 'scss', less: 'less',
  sql: 'sql', graphql: 'graphql', markdown: 'md',
};

export function CodeBlock({ language, text, children }: Props) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(text).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => {
        // fallback: select & exec
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        try {
          document.execCommand('copy');
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } finally {
          document.body.removeChild(ta);
        }
      },
    );
  }

  function download() {
    const ext = LANG_TO_EXT[language.toLowerCase()] ?? language.toLowerCase() ?? 'txt';
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `snippet-${ts}.${ext}`;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  return (
    <div className="relative group my-3">
      {language && (
        <div className="absolute left-3 top-2 text-[10px] uppercase text-zinc-400 font-mono z-10 pointer-events-none">
          {language}
        </div>
      )}
      <div className="absolute right-2 top-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <button
          type="button"
          onClick={copy}
          className="text-[11px] px-2 py-0.5 bg-zinc-700/70 hover:bg-zinc-700 text-zinc-100 rounded backdrop-blur-sm"
          title="复制代码"
        >
          {copied ? '✓ 已复制' : '复制'}
        </button>
        <button
          type="button"
          onClick={download}
          className="text-[11px] px-2 py-0.5 bg-zinc-700/70 hover:bg-zinc-700 text-zinc-100 rounded backdrop-blur-sm"
          title="下载为单文件"
        >
          下载
        </button>
      </div>
      {children}
    </div>
  );
}
