/**
 * Created by mak.punyachokchai on 12/7/2020 AD.
 */

const {_, jwtDecode, moment} = require.main.require('./helpers')

const {socketConstants: SC} = require.main.require('./static-data')

function isValid (token) {
  const currentUser = jwtDecode(token)
  const isExpired = moment.unix(currentUser.exp) < moment()
  return !isExpired
}

module.exports = io => {

  // middleware
  io.use((socket, next) => {
    let token = socket.handshake.query.token
    if (isValid(token)) {
      return next()
    }
    return next(new Error('authentication error'))
  })

  io.of(SC.CHAT_ROOM.NAME_SPACE).on('connect', async socket => {

    const {token, ownerId} = socket.handshake.query
    const currentUser = jwtDecode(token)

    socket.join(SC.CHAT_ROOM.ROOMS.USER + currentUser._id)
    socket.join(SC.CHAT_ROOM.ROOMS.OWNER + ownerId)

    socket.on(SC.CHAT_ROOM.EVENTS.TS.READ_CHAT_ROOMS,
      require('./on-read-chat-rooms')(io, socket))

    socket.on(SC.CHAT_ROOM.EVENTS.TS.READ_MESSAGES,
      require('./on-read-messages')(io, socket))

    socket.on(SC.CHAT_ROOM.EVENTS.TS.ADD_MESSAGE,
      require('./on-add-message')(io, socket))

    socket.on(SC.CHAT_ROOM.EVENTS.TS.PAY_FOR_CHAT_ROOM,
      require('./on-pay-for-chat-room')(io, socket))

    socket.on(SC.CHAT_ROOM.EVENTS.TS.READ_BY,
      require('./on-read-by')(io, socket))

    socket.on('disconnect', onDisconnect)

    function onDisconnect (reason) {
      // console.log('disconnect reason: ', reason)
    }


  })

}