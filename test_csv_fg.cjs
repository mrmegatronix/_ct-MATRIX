const fs = require('fs');

const code = fs.readFileSync('matrix-core.js', 'utf8');
const parseCode = code.substring(code.indexOf('function parseCSVToEvents'), code.indexOf('function getDefaultBackground'));
const parseCSV = code.substring(code.indexOf('function parseCSV('), code.indexOf('function parseCSVToEvents'));

const script = `
const window = { MATRIX: { CONFIG: { MODULE_DELAY: 30000, SWAP_DELAY: 30000 }, STATE: {} } };
` + parseCSV + "\n" + parseCode + `
const csvText = fs.readFileSync('test.csv', 'utf8');
const result = parseCSVToEvents(csvText);
result[0].events.forEach((ev, i) => {
  if (ev.fgImage) {
    console.log("Row " + (i+1) + " has fgImage: " + ev.fgImage + " | title: " + ev.title);
  }
});
`;

eval(script);
