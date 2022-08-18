/**
 * Created by mak.punyachokchai on 14/7/2020 AD.
 */

const {_} = require.main.require('./helpers')

const {ChatRoom} = require.main.require('./models')

const {
  shouldCensorChatRoom,
  censorChatRoomMessage
} = require.main.require('./lib/common-lib')

const {socketConstants: SC} = require.main.require(
  './static-data')

module.exports = (io, socket) => {

  const {ownerId} = socket.handshake.query

  async function onReadMessages (payload, ack) {
    const {chatRoomId} = payload
    const roomName = SC.CHAT_ROOM.ROOMS.CHAT_ROOM + chatRoomId

    socket.join(roomName, ()=>{
      _.chain(socket.rooms).
        keys().
        filter(room => room.indexOf(SC.CHAT_ROOM.ROOMS.CHAT_ROOM) === 0).
        each(room => {
          if(room !== roomName){
            socket.leave(room)
          }
        }).
        value()
    })

    let chatRoom = await ChatRoom.findOne({_id: chatRoomId})

    chatRoom = chatRoom.toJSON()

    ack({
      messages: shouldCensorChatRoom(chatRoom, ownerId)
            ? _.map(chatRoom.messages, censorChatRoomMessage)
            : chatRoom.messages
    })
  }

  return onReadMessages
}