const http = require('http')
const fs = require('fs')
const url = require('url')

http.createServer((req, res) => {
  res.writeHead(200, {'Content-Type': 'text/plain'})
  if (req.url === '/favicon.ico') {
    return false
  } else if (url.parse(req.url, true).query.way === '2') {
    fs.createReadStream('./way2.json').pipe(res)
  } else {
    res.end('1 way')
  }
}).listen(8080, () => {
  console.log('Now u r watching 8080 port.')
})