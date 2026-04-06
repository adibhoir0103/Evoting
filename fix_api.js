const fs = require('fs');
const path = require('path');
function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
      results.push(file);
    }
  });
  return results;
}
const files = walk('./frontend/src');
let count = 0;
const target1 = "const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';";
const target2 = 'const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1";';
const replacement = `const rawUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';\nconst API_URL = rawUrl.startsWith('http') ? (rawUrl.endsWith('/api/v1') ? rawUrl : rawUrl.replace(/\\/$/, '') + '/api/v1') : 'https://' + rawUrl.replace(/\\/$/, '') + (rawUrl.endsWith('/api/v1') ? '' : '/api/v1');`;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes(target1) || content.includes(target2)) {
    content = content.split(target1).join(replacement).split(target2).join(replacement);
    fs.writeFileSync(file, content);
    count++;
  }
});
console.log('Fixed API_URL in ' + count + ' files');
