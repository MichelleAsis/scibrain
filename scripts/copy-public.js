// Copy all pages and home assets to project root so Vercel serves them (fixes 404)
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const pagesDir = path.join(root, 'src', 'pages');

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const name of fs.readdirSync(src)) {
      copyRecursive(path.join(src, name), path.join(dest, name));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

// 1. Home page at root
const home = path.join(pagesDir, 'HomePage');
['index.html', 'styles.css', 'script.js'].forEach((file) => {
  const src = path.join(home, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(root, file));
    console.log('Copied:', path.relative(root, src), '->', file);
  }
});
if (fs.existsSync(path.join(root, 'favicon.ico'))) {
  console.log('favicon.ico at root (ok)');
}

// 2. Other pages as /PageName/...
const pageFolders = fs.readdirSync(pagesDir).filter((name) => {
  const full = path.join(pagesDir, name);
  return fs.statSync(full).isDirectory() && name !== 'HomePage';
});
for (const name of pageFolders) {
  const srcDir = path.join(pagesDir, name);
  const destDir = path.join(root, name);
  if (fs.existsSync(destDir)) {
    try {
      fs.rmSync(destDir, { recursive: true });
    } catch (_) {}
  }
  copyRecursive(srcDir, destDir);
  console.log('Copied page:', name);
}

console.log('Public files ready for Vercel.');
