const fs = require('fs');

let csvContent = 'Name,Question,Target,Exclusion\n';

for (let i = 1; i <= 50; i++) {
    const name = `User${String(i).padStart(3, '0')}`;
    let question = '';
    let target = 'All';
    let exclusion = '';

    // Mix of line breaks
    if (i % 3 === 0) {
        question = `"Question ${i} line 1\nQuestion ${i} line 2\nQuestion ${i} line 3"`;
    } else if (i % 2 === 0) {
        question = `"Question ${i} line 1\nQuestion ${i} line 2"`;
    } else {
        question = `Question ${i} single line`;
    }

    // Mix of targets
    if (i % 5 === 0) target = 'TanakaReader';
    if (i % 7 === 0) target = 'SuzukiReader';

    // Mix of exclusions
    if (i === 10 || i === 20 || i === 30) exclusion = 'x';
    if (i === 40) exclusion = '*';

    csvContent += `${name},${question},${target},${exclusion}\n`;
}

fs.writeFileSync('c:\\Users\\TOHNICHI\\木曜会\\Roulette\\test_large_50.csv', csvContent, 'utf8');
console.log('generated test_large_50.csv');
