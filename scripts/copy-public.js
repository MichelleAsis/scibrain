// Copy pages to root for Vercel static serving (so /Dashboard/, /UploadPage/ etc. work)
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const pagesDir = path.join(root, 'pages');

if (!fs.existsSync(pagesDir)) {
  console.log('No pages/ folder, skipping copy.');
  process.exit(0);
}

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

const pageFolders = fs.readdirSync(pagesDir).filter((name) => {
  const full = path.join(pagesDir, name);
  return fs.statSync(full).isDirectory();
});

for (const name of pageFolders) {
  const srcDir = path.join(pagesDir, name);
  const destDir = path.join(root, name);
  if (fs.existsSync(destDir)) try { fs.rmSync(destDir, { recursive: true }); } catch (_) {}
  copyRecursive(srcDir, destDir);
  console.log('Copied page:', name);
}

// Ensure home page at root (use src/pages/HomePage if present, else leave existing)
const homeSrc = path.join(root, 'src', 'pages', 'HomePage', 'index.html');
if (fs.existsSync(homeSrc) && !fs.existsSync(path.join(root, 'index.html'))) {
  fs.copyFileSync(homeSrc, path.join(root, 'index.html'));
  fs.copyFileSync(path.join(root, 'src', 'pages', 'HomePage', 'styles.css'), path.join(root, 'styles.css'));
  fs.copyFileSync(path.join(root, 'src', 'pages', 'HomePage', 'script.js'), path.join(root, 'script.js'));
  console.log('Copied HomePage to root');
}

console.log('Build done.');
