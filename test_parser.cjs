const fs = require('fs');

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
  return result;
}

const text = fs.readFileSync('test.csv', 'utf-8');
const rows = parseCSVToEvents(text);
const events = rows.slice(1).map(clean => {
    return {
      date: clean[0],
      day: clean[1],
      event_type: clean[2] || 'Event',
      title: (clean[3] || '').replace(/\n/g, '<br>')
    };
});
const earlyJune = events.filter(e => e.date && e.date.includes('/06/2026'));
console.log(earlyJune);
