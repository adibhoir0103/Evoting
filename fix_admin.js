const fs = require('fs');

const replaceInFile = (file, replacements) => {
    let content = fs.readFileSync(file, 'utf8');
    let newContent = content;
    replacements.forEach(r => {
        newContent = newContent.replace(r.from, r.to);
    });
    if (content !== newContent) {
        fs.writeFileSync(file, newContent);
        console.log('Updated', file);
    }
};

// 1. Remove Authorization headers from Admin components
const adminComponents = [
    './frontend/src/components/Admin/VoterRolls.jsx',
    './frontend/src/components/Admin/PendingRegistrations.jsx',
    './frontend/src/components/Admin/ElectionWizard.jsx',
    './frontend/src/components/Admin/AuditLogs.jsx',
    './frontend/src/pages/AdminPanel.jsx'
];

adminComponents.forEach(f => {
    replaceInFile(f, [
        { from: /const token = localStorage\.getItem\('adminToken'\);\s*/g, to: '' },
        { from: /const getToken = \(\) => localStorage\.getItem\('adminToken'\);\s*/g, to: '' },
        { from: /'Authorization': `Bearer \$\{getToken\(\)\}`/g, to: '' },
        { from: /'Authorization': `Bearer \$\{token\}`/g, to: '' },
        // Cleanup leftover empty headers or trailing commas if necessary, though simpler to just leave it as is if it's `{ headers: { 'Content-Type': '...' } }`
        { from: /,?\s*'Authorization':\s*`Bearer[^`]+`/g, to: '' }
    ]);
});

// 2. Fix AdminLoginPage.jsx
replaceInFile('./frontend/src/pages/AdminLoginPage.jsx', [
    { from: /localStorage\.setItem\('adminToken',\s*data\.token\);/g, to: "localStorage.setItem('admin', JSON.stringify(data.admin));" },
    { from: /onLogin\(\)/g, to: "onLogin(data.admin)" }
]);

// 3. Fix App.jsx and Navbar.jsx
replaceInFile('./frontend/src/App.jsx', [
    { from: /!!localStorage\.getItem\('adminToken'\)/g, to: "!!localStorage.getItem('admin')" },
    { from: /localStorage\.getItem\('adminToken'\)/g, to: "localStorage.getItem('admin')" },
    { from: /localStorage\.removeItem\('adminToken'\);\s*/g, to: "" }
]);

replaceInFile('./frontend/src/components/Navbar.jsx', [
    { from: /localStorage\.getItem\('adminToken'\)/g, to: "localStorage.getItem('admin')" }
]);

// 4. Fix blockchainService.js
replaceInFile('./frontend/src/services/blockchainService.js', [
    { from: /localStorage\.getItem\('adminToken'\)/g, to: "localStorage.getItem('admin')" }
]);

console.log('Done replacing adminToken.');
