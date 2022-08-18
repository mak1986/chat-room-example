/**
 * Created by mak.punyachokchai on 6/10/2018 AD.
 */


const plugin = {
  name: 'messages',
  register: async function (server, options) {

    // Crud

    server.route(require('./routes/create-chat-room'))
    server.route(require('./routes/create-message'))
    server.route(require('./routes/read-chat-rooms'))
    server.route(require('./routes/read-chat-room'))

    // Features

    server.route(require('./routes/pay-for-chat-room'))
    server.route(require('./routes/read-counterpart-profile'))
  },
}

exports.plugin = plugin
