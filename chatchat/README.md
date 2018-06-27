# 初始化(服务端)
```
// 将nodejs服务端挂载socket.io上，端口同步映射
// init nodejs server
const http = require('http')
const server = http.createServer((req, res) => {
  let filePath = ''
  
  if (req.url === '/') {
    filePath = '/index.html'
  } else {
    filePath = `${req.url}` // 首页的样式、脚本资源等
  }
  filePath = `../static${filePath}`
})
server.listen(8081, () => {
  console.log('监听8081端口')
})

// init socket.io server
// require('socket.io')(server, {opts}) => opts 是自定义选项
const io = require('socket.io')(server)
// 监听函数
socket.on('connection', (socket) => {
  socket.emit('all events', { for: 'everyone' })
})
```

# 会话
1. 会话广播事件
- socket.to('room1').emit('an event', { some: 'data' }) // 等同于命名空间为/；事件只会广播到【某个房间】已加入给定的用户（不包含当前用户）
- socket.to('room1').to('room2').emit('an event', { some: 'data' }) // 等同于命名空间为/；事件只会广播到【多个房间】的用户（不包含当前用户）
- socket.to(socket.id).emit('an event', { some: 'data' }) // 等同于命名空间为/；事件只会广播到【某个房间】的【某个用户】（不包含当前用户）
2. 断开连接
会话与命名空间的关系：会话包含命名空间，命名空间包含房间。
- socket.disconnect([Boolean]) // true则为关闭会话连接，否则为关闭命名空间


# 命名空间
> 一个命名空间可以存在多个房间
socket.of('/room') => 返回初始化后的命名空间本身，后面直接跟 监听或者发送方法 都可，要注意的是后续所有方法都是针对该房间的

1. namespace.to（room）=> 等同于namespace.in（room）；可以给已经加入的room设置 / 绑定一个事件
```
const io = require('socket.io')();
const adminNamespace = socket.of('/admin');

adminNamespace.to('room1').emit('an event', { some: 'data' });  // 等同于adminNamespace.in('room1')；要发射到指定多个房间，可以to多个房间
```

2. namespcae.clients(cb)
> 获取连接到此命名空间的用户ID
```
const io = require('socket.io')();

// 1)获取到连接room命名空间的用户ID
socket.of('/room').clients((error, clients) => {
  if (error) throw error;
  console.log(clients); // => [PZDoMHjiu8PYfRiKAAAF, Anw2LatarvGVVXEIAAAD]
});

// 2)获取到连接room命名空间中test房间的用户ID
socket.of('/room').in('test').clients((error, clients) => {
  if (error) throw error;
  console.log(clients); // => [PZDoMHjiu8PYfRiKAAAF, Anw2LatarvGVVXEIAAAD]
});

// 3)默认是获取到连接/命名空间的用户ID
socket.clients((error, clients) => {
  if (error) throw error;
  console.log(clients); // => [PZDoMHjiu8PYfRiKAAAF, Anw2LatarvGVVXEIAAAD]
});

```

# 监听
- socket.emit('all events', {for : 'everyone'}) 通过message事件来进行监听
- 除了 connect、 message 和 disconnect 的自带事件之外，还可以触发自定义事件

# 发送
单独emit，也相当于广播给包含自身的所有人
```
// 举例就不看成把nodejs挂载到socket上了，麻烦
const socket = require('socket.io')(80)

socket.on('all events', function (data, cb) {
    // data => { for: 'everyone' }
    // cb => function (data) {console.log('等待响应返回数据')}
    cb('I am back, bitxh.')
})

/*
* 这种方式跟下面等效
* socket.of('/Guest').emit('all events', { for: 'everyone' }, function (data) {
*    console.log('等待响应返回数据')
* })
*/
socket.emit('all events', { for: 'everyone' }, function (data) {
    console.log('等待响应返回数据')
})
```

# 广播
广播有多种方式：
1. 要将事件发送给每个用户【包括自身】: socket.emit('all events', { for: 'everyone' });   // 这个是没有通过【监听函数】调用
2. 要将消息发送给【除发送者自身以外】的所有人: socket.broadcast.emit('hello world'); // 这个是通过【监听函数】调用
3. 要将消息发送给【除发送者自身以外】的所有人: socket.broadcast.send('hello world'); // 这个是通过【监听函数】调用
4. 要将消息广播到指定房间：socket.broadcast.to(room).emit(event', opts)

# 关于房间
## 加入房间
- socket.join('room', cb) // 加入某个房间
- socket.join(['room', 'room2'], cb) // 加入多个房间

## 离开房间
- socket.leave(room [，cb) // 离开某个房间

## 事件速查表
https://www.w3cschool.cn/socket/socket-buvk2eib.html

## 参考
https://www.w3cschool.cn/socket/index.html