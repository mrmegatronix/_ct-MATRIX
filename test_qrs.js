const fs = require('fs');
const text = fs.readFileSync('live_headers_check.csv', 'utf8');
const result = []; let row = []; let col = ''; let inQuotes = false;
for (let i = 0; i < text.length; i++) {
  const char = text[i]; const nextChar = text[i+1];
  if (inQuotes) {
    if (char === '"' && nextChar === '"') { col += '"'; i++; }
    else if (char === '"') { inQuotes = false; }
    else { col += char; }
  } else {
    if (char === '"') { inQuotes = true; }
    else if (char === ',') { row.push(col.trim()); col = ''; }
    else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
      if (char === '\r') i++;
      row.push(col.trim()); result.push(row); row = []; col = '';
    } else { col += char; }
  }
}
if (col || row.length > 0) { row.push(col.trim()); result.push(row); }

let qrCount = 0;
result.slice(1).forEach((clean, idx) => {
  if (clean[13] || clean[14]) {
      console.log('Row ' + (idx+2) + ' QR: ' + clean[13] + ' | FooterQR: ' + clean[14]);
      qrCount++;
  }
});
console.log('Total QRs found: ' + qrCount);
