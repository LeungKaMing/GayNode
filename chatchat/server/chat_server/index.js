const socketIO = require('socket.io')

// 一些常用变量
let io
let guestNumber = 1 // 访客数
let nickNames = {}  // 昵称
let namesUsed = []  // 曾用名
let currentRoom = {}  // 当前房间

/**
 * 1. 分配访客名  ok
 * @param {*} socket 
 * @param {*} guestNumber 
 * @param {*} nickNames 
 * @param {*} namesUsed 
 */
function assignGuestName (socket, guestNumber, nickNames, namesUsed) {
  let name = `Guest_${guestNumber}`
  nickNames[socket.id] = {
    name
  }
  socket.emit('nameResult', {
    success: true,
    name
  })  // 告知监听'nameResult'的事件已分配的名字
  namesUsed.push(name) // 将当前分配昵称存进曾用名数组 => 改名时不能跟这个数组内的名字重复
  return guestNumber + 1  // 累加当前访客数
}

/**
 * 2. 加入房间  ok
 * @param {*} socket 
 * @param {*} room 
 */
function joinRoom (socket, room) {
  socket.join(room) // 当前会话加入某个房间
  socket.emit('joinResult', {
    room
  })  // 告知监听'joinResult'的事件当前用户进入了某个房间

  currentRoom[socket.id] = room // 每个socketId都有其对应的房间

  socket.emit('message', {
    text: `${nickNames[socket.id].name} has joined ${room}`
  })

  let usersInRoomSummary = `Users currently in room: ${nickNames[socket.id].name}`
  io.in(room).clients((err, clients) => {
    clients.map((perClientSocketID) => {
      if ((perClientSocketID !== socket.id) && (nickNames[perClientSocketID].name !== nickNames[socket.id].name)) {
        if (clients.length > 1) {
          usersInRoomSummary += ', '
        }
        usersInRoomSummary += nickNames[perClientSocketID].name
      }
    })
    usersInRoomSummary += '.'
    socket.emit('message', {
      text: usersInRoomSummary
    })
  })
}

/**
 * 3. 处理用户改名需求 ok
 * - 用户不能改成以Guest_开头的
 * - 用户不能改成跟已有昵称重复的
 * @param {*} socket 
 * @param {*} nickNames 
 * @param {*} namesUsed 
 */
function handleNameChangeAttempts (socket, nickNames, namesUsed) {
  socket.on('nameAttempt', (name) => {
    // 改的名字是以Guest_开头的
    if (name.indexOf('Guest_') === 0) {
      socket.emit('nameResult', {
        success: false,
        message: 'Names cannot begin with "Guest_"!'
      })
    } else {
      if (namesUsed.indexOf(name) === -1) {
        // 不在曾用名列表中，则注册一个
        const oldName = nickNames[socket.id].name
        const oldNameIndex = namesUsed.indexOf(oldName)

        namesUsed.push(name)
        nickNames[socket.id].name = name  // 覆盖当前socketID对应的名字

        delete namesUsed[oldNameIndex]  // 由于新昵称是追加在数组后面的，上面亦已经保留了旧昵称的索引，所以这里可以把旧项删掉
        socket.emit('nameResult', {
          success: true,
          name
        })
        socket.broadcast.to(currentRoom[socket.id]).emit('message', {
          text: `${oldName} is now known as ${name}.`
        })
      } else {
        // 已经存在在曾用名列表中
        socket.emit('nameResult', {
          success: false,
          message: `${name} has already existed!`
        })
      }
    }
  })
}

/*
 * 4. 统一处理用户发送的信息 ok
 * @param {*} socket 
 * @param {*} nickNames 
 */
function handleMessageBroadcasting (socket, nickNames) {
  socket.on('sendSMS', (message) => {
    // 广播除自身以外的人能看到
    socket.broadcast.to(message.room).emit('message', {
      text: `${nickNames[socket.id].name}: ${message.text}`
    })
    // 广播自身能看到
    socket.emit('message', {
      text: `${nickNames[socket.id].name}: ${message.text}`
    })
  })
}

/*
 * 5. 处理加入房间  ok
 * @param {*} socket 
 */
function handleRoomJoining (socket) {
  socket.on('join', (room) => {
    socket.leave(currentRoom[socket.id])  // 离开当前房间
    joinRoom(socket, room.newRoom)  // 加入新的房间
  })
}

/*
 * 6. 断开连接 ok
 * @param {*} socket 
 * @param {*} nickNames 
 * @param {*} namesUsed 
 */
function handleClientDisconnection (socket, nickNames, namesUsed) {
  socket.on('leaveRoom', () => {
    const nameIndex = namesUsed.indexOf(nickNames[socket.id].name) // 通过当前用户昵称去曾用名数组中，查找对应对象项的索引，然后删除相关项

    // 广播除自身以外的人能看到
    socket.broadcast.to(currentRoom[socket.id]).emit('message', {
      text: `${nickNames[socket.id].name}已断开连接`
    })
    // 广播自身能看到
    socket.emit('message', {
      text: `${nickNames[socket.id].name}已断开连接`
    })

    delete namesUsed[nameIndex]
    delete nickNames[socket.id].name

    socket.leave(currentRoom[socket.id])  // 离开当前房间
    socket.disconnect(true)
  })
}

function handleAskRooms (socket, roomList) {
  const list = []
  socket.on('rooms', () => {  // 用户发出请求【查询房间】时，向其提供已经被占用的聊天室列表
    // socket.emit('rooms', roomList)
    for (let key in roomList) {
      list.push(roomList[key])
    }
    socket.emit('rooms', Array.from(new Set(list)))
  })
}

exports.listen = function (server, req) {
  io = socketIO.listen(server)  // 将传入来的server再次封装，实则为将socketIO服务器搭载在server上
  // io.set('log level', 1)
  io.on('connection', (socket) => {
    guestNumber = assignGuestName(socket, guestNumber, nickNames, namesUsed)  // 用户连接上来时，分配其一个访客名，返回访客人数
    joinRoom(socket, 'Guest') // 加入Guest房间
    
    // 处理用户的消息、改名和加入房间
    handleMessageBroadcasting(socket, nickNames)
    handleNameChangeAttempts(socket, nickNames, namesUsed)
    handleRoomJoining(socket)
    
    handleAskRooms(socket, currentRoom)

    handleClientDisconnection(socket, nickNames, namesUsed) // 用户断开连接
  })
}