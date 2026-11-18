import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const project = fileURLToPath(new URL('../', import.meta.url));
const dist = resolve(project, 'dist');
const index = readFileSync(resolve(dist, 'index.html'), 'utf8');
const engineLicence = readFileSync(resolve(project, 'node_modules/@wllama/wllama/LICENCE'), 'utf8');

function readAsset(url) {
  if (!/^\.?\/?assets\/[\w.-]+$/.test(url)) {
    throw new Error(`Unexpected production asset: ${url}`);
  }
  return readFileSync(resolve(dist, url.replace(/^\//, '')), 'utf8');
}

let scripts = 0;
let styles = 0;
const offline = index
  .replace('</head>', `<!-- Wllama\n${engineLicence.replaceAll('-->', '--&gt;')}\n-->\n</head>`)
  .replace(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/g, (_, url) => {
    scripts += 1;
    return `<script type="module">\n${readAsset(url).replace(/<\/script/gi, '<\\/script')}\n</script>`;
  })
  .replace(/<link\b[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+)"[^>]*>/g, (_, url) => {
    styles += 1;
    return `<style>\n${readAsset(url)}\n</style>`;
  })
  .replace(/\r+\n/g, '\n');

if (scripts !== 1 || styles !== 1 || /<(?:script|link)\b[^>]*\b(?:src|href)="/i.test(offline)) {
  throw new Error('Unable to bundle all Vite entry assets into a single offline file.');
}

writeFileSync(resolve(dist, '玄霄问道录.html'), offline);
writeFileSync(resolve(dist, 'Wllama-LICENSE.txt'), engineLicence);
writeFileSync(resolve(project, 'android/app/src/main/assets/www/index.html'), offline);
console.log('Generated the offline HTML and synchronized Android WebView assets.');
