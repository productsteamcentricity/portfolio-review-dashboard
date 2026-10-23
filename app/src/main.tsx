// Entry point of the new application (CR-0006). Bundled by scripts/build.mjs into one offline HTML file.
// Reads the build-info data block (a non-executable JSON <script>, parsed with JSON.parse) and mounts the shell.

import { render } from 'preact';
import { App, type BuildInfo } from './ui/App.tsx';

function readBuildInfo(): BuildInfo | null {
  const el = document.getElementById('build-info');
  if (!el || !el.textContent) return null;
  try {
    return JSON.parse(el.textContent) as BuildInfo;
  } catch {
    return null;
  }
}

const root = document.getElementById('app');
if (root) {
  render(<App build={readBuildInfo()} />, root);
  root.dataset['ready'] = 'true';
}
