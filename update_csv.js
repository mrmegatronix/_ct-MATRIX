const fs = require('fs');
const text = fs.readFileSync('live_headers_check.csv', 'utf8');
const lines = text.split('\n');

for(let i=1; i<lines.length; i++) {
   if(lines[i].includes('Quiz Night')) {
      lines[i] = lines[i].replace('images/bg2.jpg', '_backgrounds/quiz.png');
      
      let row = []; let col = ''; let inQuotes = false;
      let chars = lines[i].split('');
      for (let j = 0; j < chars.length; j++) {
        const char = chars[j]; const nextChar = chars[j+1];
        if (inQuotes) {
          if (char === '"' && nextChar === '"') { col += '"'; j++; }
          else if (char === '"') { inQuotes = false; }
          else { col += char; }
        } else {
          if (char === '"') { inQuotes = true; }
          else if (char === ',') { row.push(col); col = ''; }
          else if (char === '\r') { }
          else { col += char; }
        }
      }
      row.push(col);

      // Pad array if it doesn't have 25 columns
      while(row.length < 25) row.push('');

      if(!row[13]) row[13] = 'https://ctmatrix.com/quiz';
      if(!row[14]) row[14] = 'https://ctmatrix.com/quiz-footer';
      
      if(row[0] === '29/04/2026') row[0] = '05/05/2026';

      lines[i] = row.map(c => {
         if(c.includes(',') || c.includes('"')) return '"' + c.replace(/"/g, '""') + '"';
         return c;
      }).join(',');
   }
}

fs.writeFileSync('live_headers_check.csv', lines.join('\n'), 'utf8');
console.log('CSV updated');
