const http = require('http')
const fs = require('fs')
const mime = require('mime')  // https://www.npmjs.com/package/mime
const path = require('path')
const cache = {}  // 缓存

// common method
// 404
function send404 (res) {
  res.writeHead(404, {'Content-Type': 'text/plain'})
  res.write('something wrong in page')
  res.end()
}

// file I/O
function sendFile (res, filePath, fileContents) {
  res.writeHead(200, {'Content-Type': mime.getType(path.basename(filePath))})
  res.end(fileContents)
}

// cache or not; exist or not => RAM存在则避免进一步读取硬盘，增加性能
function isCache (res, cache, absPath) {
  if (cache[absPath]) {
    sendFile(res, absPath, cache[absPath])
  } else {
    // fs.exist 新版本废弃掉；并且官方强调不要在open/read/write前判断文件是否存在，会造成进程混乱，应直接进行I/O操作，报错再做后续处理
    fs.readFile(absPath, (err, data) => {
      if (err) {
        send404(res)
      } else {
        cache[absPath] = data // 存到缓存里
        sendFile(res, absPath, cache[absPath])
      }
    })
  }
}


// create server
const server = http.createServer((req, res) => {
  // isCache(res, cache, )
  let filePath = ''
  
  if (req.url === '/') {
    filePath = '/index.html'
  } else {
    filePath = `${req.url}` // 首页的样式、脚本资源等
  }
  filePath = `../static${filePath}`
  isCache(res, cache, filePath)
    
})

server.listen(8080, () => {
  console.log('监听8080端口')
})

// chat_server
const chatServer = require('./chat_server/index')
chatServer.listen(server)