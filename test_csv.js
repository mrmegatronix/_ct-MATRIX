const fs = require('fs');
const csv = fs.readFileSync('live_headers_check.csv', 'utf8');

function parseCSVToEvents(text) {
  const result = [];
  let row = [];
  let col = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i+1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        col += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        col += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        row.push(col.trim());
        col = '';
      } else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
        if (char === '\r') i++;
        row.push(col.trim());
        result.push(row);
        row = [];
        col = '';
      } else {
        col += char;
      }
    }
  }
  if (col || row.length > 0) {
    row.push(col.trim());
    result.push(row);
  }
  
  for(let j=1; j<result.length; j++) {
    if (result[j][13] || result[j][14] || result[j][17]) {
      console.log('Row', j, 'Title:', result[j][3], '| QR(13):', result[j][13], '| FooterQR(14):', result[j][14], '| BG(17):', result[j][17]);
    }
  }
}

parseCSVToEvents(csv);
