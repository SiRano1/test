// Превращает однофайловую сборку (dist-single/index.html) в страницу для публикации:
// без <html>/<head>/<body>, с <title> в начале и явным тёмным фоном.
import { readFileSync, writeFileSync } from 'node:fs';
const src = readFileSync('dist-single/index.html', 'utf8');
const head = src.match(/<head>([\s\S]*?)<\/head>/)[1];
const body = src.match(/<body>([\s\S]*?)<\/body>/)[1];
const styles = [...head.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
const scripts = [...head.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)].map((m) => `<script${m[1]}>${m[2]}</script>`).join('\n');
const out = `<title>Хроники Глубинного Трона</title>
<style>:root{color-scheme:dark;background:#0b0810}html,body{background:#0b0810;height:100%}
${styles}</style>
${body}
${scripts}
`;
const outPath = process.argv[2] ?? 'dist-single/artifact.html';
writeFileSync(outPath, out);
console.log(outPath, (out.length / 1024).toFixed(0) + ' KB');
