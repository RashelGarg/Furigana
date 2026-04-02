const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '../dist/index.html');
if (fs.existsSync(indexPath)) {
  let content = fs.readFileSync(indexPath, 'utf8');
  content = content.replace(/="\//g, '="./');
  fs.writeFileSync(indexPath, content);
  console.log('Fixed absolute paths to relative paths in index.html');
}
