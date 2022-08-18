/**
 * Created by mak.punyachokchai on 14/7/2020 AD.
 */

const {_, jwtDecode} = require.main.require('./helpers')

const {ChatRoom} = require.main.require('./models')

const {
  shouldCensorChatRoom,
  censorChatRoom,
} = require.main.require('./lib/common-lib')

const {socketConstants: SC} = require.main.require(
  './static-data')

module.exports = (io, socket) => {

  const {ownerId, token} = socket.handshake.query
  const currentUser = jwtDecode(token)

  async function onReadBy (payload) {
    const {chatRoomId} = payload

    let readByChanged = false
    let chatRoom = await ChatRoom.findOne({_id: chatRoomId})

    let readBy = _.map(chatRoom.readBy, (userId) => {
      return userId.toString()
    })

    if (!readBy.includes(currentUser._id)) {
      chatRoom.readBy.push(currentUser._id)
      chatRoom = await chatRoom.save()
      readByChanged = true
    }

    let leanChatRoom = _.omit(chatRoom.toJSON(), ['messages'])

    if (readByChanged) {
      socket.emit(SC.CHAT_ROOM.EVENTS.TC.UPDATE_CHAT_ROOM, {
        chatRoom: shouldCensorChatRoom(leanChatRoom, ownerId)
          ? censorChatRoom(leanChatRoom)
          : leanChatRoom,
      })
    }

  }

  return onReadBy
}





