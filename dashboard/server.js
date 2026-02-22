const http = require('http');
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname,'index.html');
const port = process.env.PORT || 8080;

const html = fs.readFileSync(file);

http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }
  res.writeHead(404);
  res.end('Not found');
}).listen(port, () => console.log(`Dashboard available at http://localhost:${port}`));
