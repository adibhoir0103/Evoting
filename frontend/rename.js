const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.resolve(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else if (file.endsWith('.js')) {
            results.push(file);
        }
    });
    return results;
}

const jsFiles = walk(path.join(__dirname, 'src'));

jsFiles.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    // If it contains React imports or JSX-like syntax, rename to .jsx
    if (content.includes('import React') || content.includes('/>') || content.includes('</')) {
        const newPath = file.replace(/\.js$/, '.jsx');
        fs.renameSync(file, newPath);
        console.log(`Renamed: ${path.basename(file)} -> ${path.basename(newPath)}`);
    }
});
