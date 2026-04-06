const fs = require('fs');
const path = require('path');
function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      if (!file.includes('node_modules') && !file.includes('dist')) {
        results = results.concat(walk(file));
      }
    } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk('./frontend/src');
let errors = 0;

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const importRegex = /import\s+.*?\s+from\s+['"](.*?)['"]/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1];
    if (importPath.startsWith('.')) {
      const dir = path.dirname(file);
      let resolvedPath = path.resolve(dir, importPath);
      let basename = path.basename(resolvedPath);
      let dirPath = path.dirname(resolvedPath);
      
      try {
        const filesInDir = fs.readdirSync(dirPath);
        const hasExt = importPath.endsWith('.js') || importPath.endsWith('.jsx') || importPath.endsWith('.css');
        if (!hasExt) {
          const matched = filesInDir.find(f => f === basename || f === basename + '.js' || f === basename + '.jsx');
          if (!matched) {
            const caseInsensitiveMatch = filesInDir.find(f => f.toLowerCase() === basename.toLowerCase() || f.toLowerCase() === (basename + '.js').toLowerCase() || f.toLowerCase() === (basename + '.jsx').toLowerCase());
            if (caseInsensitiveMatch) {
                console.error('Case Sensitivity Error in ' + file + ': import ' + importPath + ' (should be ' + caseInsensitiveMatch + ')');
                errors++;
            } else {
                console.error('File not found: ' + resolvedPath + ' from ' + file);
            }
          }
        } else {
             const matched = filesInDir.find(f => f === basename);
             if(!matched) {
                 const caseInsensitiveMatch = filesInDir.find(f => f.toLowerCase() === basename.toLowerCase());
                 if (caseInsensitiveMatch) {
                    console.error('Case Sensitivity Error in ' + file + ': import ' + importPath + ' (should be ' + caseInsensitiveMatch + ')');
                    errors++;
                 } else {
                    console.error('File not found: ' + resolvedPath + ' from ' + file);
                 }
             }
        }
      } catch (e) {
      }
    }
  }
});
console.log('Total case sensitivity errors: ' + errors);
