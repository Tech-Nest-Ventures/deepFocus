import { build } from 'esbuild';
import { readFile, mkdir, writeFile } from 'node:fs/promises';

const base = new URL('./', import.meta.url);
const bundle=await build({entryPoints:[new URL('src/widget.mjs',base).pathname],bundle:true,minify:true,format:'esm',platform:'browser',write:false,
  loader:{'.png':'dataurl','.svg':'dataurl'}});
const css=await readFile(new URL('src/widget.css',base),'utf8');
const script=bundle.outputFiles[0].text.replace(/<\/script/gi,'<\\/script');
const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Deep Focus · Sample day</title><style>${css}</style></head><body><main id="app" aria-busy="true"><p class="loading">Opening your sample day…</p></main><script type="module">${script}</script></body></html>`;
await mkdir(new URL('dist/',base),{recursive:true});
await writeFile(new URL('dist/widget.html',base),html);
console.log(`Built self-contained sample card (${Math.round(Buffer.byteLength(html)/1024)} KiB).`);
