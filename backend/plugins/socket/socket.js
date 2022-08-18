/**
 * Created by mak.punyachokchai on 13/7/2020 AD.
 */

const Hapi = require('hapi')
const SocketIO = require('socket.io')

const socketHandlers = require('./lib')

const plugin = {
  name: 'socket-plugin',
  version: '1.0.0',
  register: async function (server, options) {

    const init = async () => {

      const socketServer = new Hapi.server(options)

      const io = SocketIO(socketServer.listener, {path: '/ws'})

      socketHandlers(io)

      server.app.io = io

      await socketServer.start()

      server.log(['info', 'plugin'], 'Successfully initiated Socket')
      return server
    }

    try {
      return await init()
    } catch (error) {
      server.log(['error', 'plugin'], 'Failed to initiate Socket: ' + error)
      throw error
    }
  },
}

exports.plugin = plugin