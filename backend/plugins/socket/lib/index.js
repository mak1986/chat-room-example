/**
 * Created by mak.punyachokchai on 12/7/2020 AD.
 */

const chatRooms = require('./chat-rooms')

module.exports = io=>{
  chatRooms(io)
}