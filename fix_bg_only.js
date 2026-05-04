const fs = require('fs');

function parseCSVRow(str) {
    let row = []; let col = ''; let inQuotes = false;
    for (let i = 0; i < str.length; i++) {
        const char = str[i];
        const nextChar = str[i+1];
        if (inQuotes) {
            if (char === '"' && nextChar === '"') {
                col += '"'; i++;
            } else if (char === '"') {
                inQuotes = false;
            } else {
                col += char;
            }
        } else {
            if (char === '"') {
                inQuotes = true;
            } else if (char === ',') {
                row.push(col); col = '';
            } else if (char === '\r') {
                // skip
            } else {
                col += char;
            }
        }
    }
    row.push(col);
    return row;
}

function stringifyCSVRow(row) {
    return row.map(c => {
        if (c.includes(',') || c.includes('"') || c.includes('\n') || c.includes('\r')) {
            return '"' + c.replace(/"/g, '""') + '"';
        }
        return c;
    }).join(',');
}

let lines = fs.readFileSync('live_headers_check.csv', 'utf8').split('\n');
for(let i=1; i<lines.length; i++) {
    if(!lines[i].trim()) continue;
    let row = parseCSVRow(lines[i]);
    
    // Fix broken backgrounds, but do NOT inject mock QR data
    if (row[3] && row[3].includes('Quiz Night')) {
        if(row[17] === 'images/bg2.jpg') {
            row[17] = ''; // Clear broken path so it uses the system default quiz background
        }
        
        // Ensure dates are active so the slide appears
        if(row[0] === '29/04/2026') row[0] = '05/05/2026';
        if(row[0] === '01/05/2026') row[0] = '05/05/2026';
        if(row[0] === '02/05/2026') row[0] = '05/05/2026';
    }

    lines[i] = stringifyCSVRow(row);
}

fs.writeFileSync('live_headers_check.csv', lines.join('\n'), 'utf8');
console.log('CSV updated safely without mock data');
