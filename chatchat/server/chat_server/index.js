// 仅需记住，每个socket会话都有自身的id，我们需要利用这个id做很多事情
const socketIO = require('socket.io')

// 一些常用变量
let io
let guestNumber = 1 // 访客数
let nickNames = {}  // 昵称
let namesUsed = []  // 曾用名
let currentRoom = {}  // 当前房间

// 1. 分配访客名  ok
function assignGuestName (socket, guestNumber, nickNames, namesUsed) {
  const name = `Guest_${guestNumber}`
  nickNames[socket.id] = name // 每个socketId都有其对应的昵称
  namesUsed.push(nickNames) // 将当前分配昵称存进曾用名数组 => 改名时不能跟这个数组内的名字重复
  
  socket.emit('nameResult', {
    success: true,
    name
  })  // 告知监听'nameResult'的事件已分配的名字

  return guestNumber + 1  // 累加当前访客数
}

// 2. 加入房间
function joinRoom (socket, room) {
  socket.join(room) // 当前会话加入某个房间
  currentRoom[socket.id] = room // 每个socketId都有其对应的房间

  // 统计下当前房间内的所有用户 => check this part 20180604
  let usersInRoomSummary = ''
  const usersInRoom = io.sockets.adapter.rooms[room]  // 1.4+ 获取房间内用户的方法
  const usersInRoom2 = io.in(room).clients((err, clients) => {
    console.log(clients)
  })  // ok, 获取指定房间内用户的方法 => 还可以指定命名空间里的房间，io.of(namespace).in(room)
  console.log('Way 1, how many people in room: ', usersInRoom)
  if (usersInRoom.length === 1) {
    usersInRoomSummary = `You are the only person in ${room}.`

    // const userSocketIds = Object.keys(usersInRoom.sockets)

    // userSocketIds.map((userSocketId, index) => {
    //   if (userSocketId !== socket.id) {
    //     console.log('你不是当前连接进来的用户')
    //     // 由于用户id是以socket.id赋值的，那么说明【当前不是正在连接的用户】
    //     // if (index > 0) {
    //     //   usersInRoomSummary += ', '  // index大于0，意味着已经有超过1个人在房间了
    //     // }
    //     // usersInRoomSummary += nickNames[userSocketId]
    //   }
    // })
  } else {
    usersInRoomSummary = `These users are in ${room}: `
    for (let key in nickNames) {
      usersInRoomSummary += `${nickNames[key]}, `
    }
    usersInRoomSummary += '.'
  }

  socket.emit('joinResult', {
    room
  })  // 告知监听'joinResult'的事件当前用户进入了某个房间

  socket.emit('message', {
    text: usersInRoomSummary
  })

  // 告知监听'message'的事件对房间内所有用户广播
  io.sockets.in(room).emit('message', {
    text: `${nickNames[socket.id]} has joined ${room}.` 
  })
}

/**
 * 3. 处理用户改名需求
 * - 用户不能改成以Guest_开头的
 * - 用户不能改成跟已有昵称重复的
 */
function handleNameChangeAttempts (socket, nickNames, namesUsed) {
  socket.on('nameAttempt', (name) => {
    if (name.indexOf('Guest_') === 0) {
      socket.emit('nameResult', {
        success: false,
        message: 'Names cannot begin with "Guest_"!'
      })
    } else {
      if (namesUsed.indexOf(name) === -1) {
        // 不存在则注册一个
        const oldName = nickNames[socket.id]
        const oldNameIndex = namesUsed.indexOf(oldName)
        namesUsed.push(name)
        nickNames[socket.id] = name
        delete namesUsed[oldNameIndex]

        socket.emit('nameResult', {
          success: true,
          name
        })
        socket.broadcast.to(currentRoom[socket.id]).emit('message', {
          text: `${oldName} is now known as ${name}.`
        })
      } else {
        // 已经存在
        socket.emit('nameResult', {
          success: true,
          message: `${name} has already existed!`
        })
      }
    }
  })
}

// 4. 统一处理用户发送的信息
function handleMessageBroadcasting (socket, nickNames) {
  socket.on('message', (message) => {
    console.log(message, 'check message')
    socket.broadcast.to(message.room).emit('message', {
      text: `${nickNames[socket.id]}: ${message.text}`
    })
  })
}

// 5. 处理加入房间
function handleRoomJoining (socket) {
  socket.on('join', (room) => {
    socket.leave(currentRoom[socket.id])  // 离开当前房间
    joinRoom(socket, room.newRoom)  // 加入新的房间
  })
}

// 6. 断开连接
function handleClientDisconnection (socket, nickNames, namesUsed) {
  socket.on('disconnect', () => {
    const nameIndex = namesUsed.indexOf(nickNames[socket.id]) // 通过当前用户昵称去曾用名数组中，查找对应对象项的索引，然后删除相关项
    delete namesUsed[nameIndex]
    delete nickNames[socket.id]
  })
}

exports.listen = function (server) {
  io = socketIO.listen(server)  // 将传入来的server再次封装，实则为将socketIO服务器搭载在server上
  // io.set('log level', 1)
  io.on('connection', (socket) => {
    guestNumber = assignGuestName(socket, guestNumber, nickNames, namesUsed)  // 用户连接上来时，分配其一个访客名，返回访客人数
    joinRoom(socket, 'Guest') // 加入Guest房间
    
    // 处理用户的消息、改名和加入房间
    handleMessageBroadcasting(socket, nickNames)
    handleNameChangeAttempts(socket, nickNames, namesUsed)
    handleRoomJoining(socket)
    
    socket.on('rooms', () => {  // 用户发出请求【查询房间】时，向其提供已经被占用的聊天室列表
      socket.emit('rooms', io.sockets.manager.rooms)
    })

    handleClientDisconnection(socket, nickNames, namesUsed) // 用户断开连接
  })
}