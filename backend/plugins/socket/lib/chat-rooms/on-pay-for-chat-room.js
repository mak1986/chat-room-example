/**
 * Created by mak.punyachokchai on 14/7/2020 AD.
 */

const {_, jwtDecode} = require.main.require('./helpers')

const {ChatRoom, Team, Transaction, User} = require.main.require('./models')

const {chatRoomStatus, ownerTypes, socketConstants: SC, transactionTypes} = require.main.require(
  './static-data')

module.exports = (io, socket) => {

  const {ownerId, ownerType, token} = socket.handshake.query
  const currentUser = jwtDecode(token)

  async function onPayForChatRoom (payload, ack) {

    const {chatRoomId} = payload

    // let chatRoom = await ChatRoom.findOne({_id: chatRoomId})









    // request.log(['info', 'api', 'chat-rooms', 'pay-for-chat-room'], {
    //   message: '1. Enter pay for chat room handler.', info: {
    //     query: request.query,
    //     params: request.params,
    //   },
    // })

    const cost = 10
    let model
    if (ownerType === ownerTypes.USER) {
      model = User
    } else if (ownerType === ownerTypes.TEAM) {
      model = Team
    }
    const owner = await model.findOne({_id: ownerId})

    // request.log(['info', 'api', 'chat-rooms', 'pay-for-chat-room'], {
    //   message: '2. Get owner.', info: {
    //     owner,
    //   },
    // })

    if (owner.finance.balance < cost) {
      return ack({data: {message: 'โทเคนไม่เพียงพอในการชำระ'}})
    }

    const chatRoom = await ChatRoom.findOne({_id: chatRoomId}).
      select('-__v')
    const metadata = JSON.parse(chatRoom.metadata)

    // request.log(['info', 'api', 'chat-rooms', 'pay-for-chat-room'], {
    //   message: '3. Get chat room.', info: {
    //     chatRoom,
    //   },
    // })

    if (chatRoom.status !== chatRoomStatus.LOCKED) {
      return ack({data: {message: 'ค่าเปิดห้องสนทนาได้ถูกชำระก่อนหน้าแล้ว'}})
    }

    chatRoom.status = chatRoomStatus.UNLOCKED
    chatRoom.readBy.push(currentUser._id)

    let savedChatRoom = await chatRoom.save()

    owner.finance.balance -= cost

    const savedOwner = await owner.save()

    const transaction = new Transaction()

    transaction.ownerId = ownerId
    transaction.ownerType = ownerType
    transaction.type = transactionTypes.PAY_FOR_CHAT_ROOM
    transaction.referenceId = chatRoomId
    transaction.amount = -cost
    transaction.balance = owner.finance.balance
    transaction.metadata = JSON.stringify({chatRoomId: chatRoom._id, postId: metadata.postId, postNumber: metadata.postNumber})
    transaction.byUser = {
      userId: currentUser._id,
      userFullName: currentUser.firstName + ' ' + currentUser.lastName,
      role: currentUser.role,
    }

    const savedTransaction = await transaction.save()

    // request.log(['info', 'api', 'chat-rooms', 'pay-for-chat-room'], {
    //   message: '4. Exit pay for chat room handler.', info: {
    //     savedOwner,
    //     savedTransaction,
    //   },
    // })

    savedChatRoom = savedChatRoom.toJSON()

    ack()

    io.of(SC.CHAT_ROOM.NAME_SPACE).
      to(SC.CHAT_ROOM.ROOMS.OWNER + savedChatRoom.responder.ownerId).
      emit(SC.CHAT_ROOM.EVENTS.TC.UPDATE_CHAT_ROOM, {
        chatRoom: _.omit(savedChatRoom, ['messages']),
      })

    // return h.response(savedChatRoom).code(200)






  }

  return onPayForChatRoom
}





