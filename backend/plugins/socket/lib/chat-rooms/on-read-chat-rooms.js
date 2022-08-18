/**
 * Created by mak.punyachokchai on 14/7/2020 AD.
 */

const {_} = require.main.require('./helpers')

const {chatRoomStatus} = require.main.require(
  './static-data')

const {ChatRoom} = require.main.require('./models')

const {
  censorChatRoom,
} = require.main.require('./lib/common-lib')


module.exports = (io, socket)=>{

  const {ownerId} = socket.handshake.query

  async function onReadList(payload, ack) {

    const criteria = {
      '$or': [
        {'initiator.ownerId': ownerId},
        {'responder.ownerId': ownerId},
      ],
    }

    const chatRooms = await ChatRoom.find(criteria).select({
      messages: 0,
      __v: 0,
      // sort: request.query.order,
      // page: request.query.page,
      // limit: request.query.limit,
    }).sort('-lastMessage.createdAt').lean()

    ack({
      chatRooms: _.map(chatRooms,
        chatRoom => {
          if(
            chatRoom.status === chatRoomStatus.LOCKED &&
            ownerId === chatRoom.responder.ownerId.toString()
          ){
            return censorChatRoom(chatRoom)
          }else{
           return chatRoom
          }
        },
      ),
    })
  }


  return onReadList
}