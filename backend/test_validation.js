// Regex patterns from SignupPage.js
const patterns = {
    name: /^[A-Za-z\s]+$/,
    epic: /^[A-Z]{3}[0-9]{7}$/,
    mobile: /^\d{10}$/,
    password: {
        length: (p) => p.length >= 8,
        upper: (p) => /[A-Z]/.test(p),
        lower: (p) => /[a-z]/.test(p),
        number: (p) => /[0-9]/.test(p),
        symbol: (p) => /[^A-Za-z0-9]/.test(p)
    }
};

function test(label, valid, invalid) {
    console.log(`\n--- Testing ${label} ---`);

    valid.forEach(val => {
        let passed;
        if (label === 'Password') {
            const p = patterns.password;
            passed = p.length(val) && p.upper(val) && p.lower(val) && p.number(val) && p.symbol(val);
        } else {
            passed = patterns[label.toLowerCase().split(' ')[0]].test(val);
        }
        console.log(`[${passed ? 'PASS' : 'FAIL'}] "${val}" should be VALID`);
    });

    invalid.forEach(val => {
        let passed;
        if (label === 'Password') {
            const p = patterns.password;
            passed = p.length(val) && p.upper(val) && p.lower(val) && p.number(val) && p.symbol(val);
        } else {
            passed = patterns[label.toLowerCase().split(' ')[0]].test(val);
        }
        console.log(`[${!passed ? 'PASS' : 'FAIL'}] "${val}" should be INVALID`);
    });
}

// Test Cases
test('Name',
    ['John Doe', 'Alice', 'Ravi Kumar'],
    ['John123', 'Alice!', 'Ravi_Kumar']
);

test('EPIC ID',
    ['ABC1234567', 'XYZ9876543'],
    ['AB1234567', 'ABCD123456', '123ABC4567', 'abc1234567'] // Lowercase rejected by regex
);

test('Mobile',
    ['9876543210', '1234567890'],
    ['987654321', '98765432100', '+919876543210', 'abcdefghij']
);

test('Password',
    ['Password1!', 'Secure#2026', 'A@1bcdef'],
    ['password', 'PASSWORD', 'Pass123', 'Pass!'] // Missing requirements
);
