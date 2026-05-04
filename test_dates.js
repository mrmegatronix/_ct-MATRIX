const fs = require('fs');
const text = fs.readFileSync('live_headers_check.csv', 'utf8');
const result = [];
let row = []; let col = ''; let inQuotes = false;
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

function parseDate(d) {
  if (!d) return null;
  const p = d.split('/');
  if(p.length===3) return new Date(p[2], p[1]-1, p[0]);
  return null;
}
const now = new Date(); 
const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

let activeCount = 0;
result.slice(1).forEach((clean, idx) => {
  if(!clean[3] && !clean[0]) return;
  const dateObj = parseDate(clean[0]);
  let diffDays = -1;
  let active = true;
  if(dateObj) {
     const evDay = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
     diffDays = Math.round((evDay - today) / (1000 * 3600 * 24));
     if(diffDays < 0 || diffDays > 14) active = false;
  } else {
    // If there is NO date, and it's a "lock slide" or a day-based recurring slide, what happens?
    // Let's assume it's active.
    active = true;
  }
  if (active) {
    activeCount++;
    console.log('Row ' + (idx+2) + ' Title: ' + clean[3] + ' | Date: ' + clean[0] + ' | diffDays: ' + diffDays);
  }
});
console.log('Total active:', activeCount);
