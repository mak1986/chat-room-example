/**
 * Created by mak.punyachokchai on 14/7/2020 AD.
 */


const {_, jwtDecode} = require.main.require('./helpers')

const {ChatRoom} = require.main.require('./models')

const {socketConstants: SC} = require.main.require(
  './static-data')

const {
  censorChatRoom,
  shouldCensorChatRoom,
  censorChatRoomMessage
} = require.main.require('./lib/common-lib')

module.exports = (io, socket) => {

  const {ownerId, token} = socket.handshake.query
  const currentUser = jwtDecode(token)

  async function onAddMessage (payload, ack) {

    const {chatRoomId, message} = payload

    let chatRoom = await ChatRoom.findOne({_id: chatRoomId})

    chatRoom.messages.push({
      avatar: currentUser.avatar,
      userId: currentUser._id,
      name: currentUser.firstName + ' ' + currentUser.lastName,
      message: message,
    })
    chatRoom.readBy = [currentUser._id]

    chatRoom = await chatRoom.save()

    // Note need to save twice to have a timestamp on the message.
    chatRoom.lastMessage = _.last(chatRoom.messages)

    await chatRoom.save()

    let leanChatRoom = _.omit(chatRoom.toJSON(), ['messages'])


    io.of(SC.CHAT_ROOM.NAME_SPACE).
      to(SC.CHAT_ROOM.ROOMS.OWNER + chatRoom.initiator.ownerId).
      emit(SC.CHAT_ROOM.EVENTS.TC.UPDATE_CHAT_ROOM, {
        chatRoom: leanChatRoom,
      })


    io.of(SC.CHAT_ROOM.NAME_SPACE).
      to(SC.CHAT_ROOM.ROOMS.OWNER + chatRoom.responder.ownerId).
      emit(SC.CHAT_ROOM.EVENTS.TC.UPDATE_CHAT_ROOM, {
        chatRoom: shouldCensorChatRoom(leanChatRoom, chatRoom.responder.ownerId.toString())
          ? censorChatRoom(leanChatRoom)
          : leanChatRoom,
      })



    // io.clients((err, clients)=>{
    //   console.log('clients: ', clients)
    //   _.each(io.of(SC.CHAT_ROOM.NAME_SPACE).connected[SC.CHAT_ROOM.NAME_SPACE + '#' + clients[0]].rooms, (key, val)=>{
    //     console.log('room:', key, val)
    //   })
    //   console.log('conneccted: '+_.keys(io.of(SC.CHAT_ROOM.NAME_SPACE).connected))
    //
    // })
    // console.log('room: '+SC.CHAT_ROOM.ROOMS.CHAT_ROOM + chatRoomId)

    // io.of(SC.CHAT_ROOM.NAME_SPACE).
    //   to(SC.CHAT_ROOM.ROOMS.CHAT_ROOM + chatRoomId).
    //   emit(SC.CHAT_ROOM.EVENTS.TC.ADD_MESSAGE, {
    //     chatRoomId: leanChatRoom._id,
    //     message: leanChatRoom.lastMessage,
    //   })

    io.of(SC.CHAT_ROOM.NAME_SPACE).
      to(SC.CHAT_ROOM.ROOMS.OWNER + chatRoom.initiator.ownerId).
      emit(SC.CHAT_ROOM.EVENTS.TC.ADD_MESSAGE, {
        chatRoomId: leanChatRoom._id,
        message: leanChatRoom.lastMessage,
      })

    io.of(SC.CHAT_ROOM.NAME_SPACE).
      to(SC.CHAT_ROOM.ROOMS.OWNER + chatRoom.responder.ownerId).
      emit(SC.CHAT_ROOM.EVENTS.TC.ADD_MESSAGE, {
        chatRoomId: leanChatRoom._id,
        message: shouldCensorChatRoom(leanChatRoom, leanChatRoom.responder.ownerId.toString())
          ? censorChatRoomMessage(chatRoom.toJSON().lastMessage)
          : leanChatRoom.lastMessage,
      })


    ack()


  }

  return onAddMessage
}





