/**
 * Created by mak.punyachokchai on 6/2/2018 AD.
 */

const {_, Boom, format, Joi, moment} = require.main.require('./helpers')

const {chatRoomStatus, chatRoomTypes, ownerTypes, postTypes, socketConstants, teamRoles} = require.main.require(
  './static-data')

const {ChatRoom, Post, Team, User} = require.main.require('./models')

const {
  getRecipientsByType,
  getPostTemplateSubstitutions,
  censorChatRoom,
} = require.main.require('./lib/common-lib')

const {chatRoomsTemplate} = require('../notification-templates')

const payloadSchema = Joi.object({
  initiator: Joi.object({
    ownerId: Joi.objectId().required(),
    ownerType: Joi.string().valid(_.values(ownerTypes)),
  }),
  responder: Joi.object({
    ownerId: Joi.objectId().required(),
    ownerType: Joi.string().valid(_.values(ownerTypes)),
  }),
  type: Joi.string().valid(_.values(chatRoomTypes)),
  metadata: Joi.string(),
  message: Joi.string().required(),
})

module.exports = {
  config: {
    auth: 'jwt',
    description: 'Create a chat room',
    notes: 'Create a new chat room',
    tags: ['api'],
    validate: {
      payload: payloadSchema,
      failAction: (request, h, err) => {
        throw err
        return
      },
    },
  },
  method: 'POST',
  path: '/chat-rooms',
  handler: async (request, h) => {
    try {

      let initiator, responder

      let chatRoom = new ChatRoom()
      let metadata = JSON.parse(request.payload.metadata)

      /**
       * Prepare initiator
       */

      chatRoom.initiator = {...request.payload.initiator}

      if (request.payload.initiator.ownerType === ownerTypes.USER) {

        initiator = await User.findOne(
          {_id: request.payload.initiator.ownerId}).lean()

        if (!initiator) {
          return Boom.badRequest('ไม่พบผู้ใช้')
        }

        chatRoom.initiator.name = initiator.firstName + ' ' + initiator.lastName

      } else if (request.payload.initiator.ownerType === ownerTypes.TEAM) {

        initiator = await Team.findOne(
          {_id: request.payload.initiator.ownerId}).lean()

        if (!initiator) {
          return Boom.badRequest('ไม่พบทีม')
        }

        chatRoom.initiator.name = initiator.name

      } else {
        return Boom.badRequest('Wrong initiator owner type')
      }

      chatRoom.initiator.avatar = _.omit(initiator.avatar, ['metadata'])

      /**
       * Prepare responder
       */

      chatRoom.responder = {...request.payload.responder}

      if (request.payload.responder.ownerType === ownerTypes.USER) {

        responder = await User.findOne(
          {_id: request.payload.responder.ownerId}).lean()

        if (!responder) {
          return Boom.badRequest('ไม่พบผู้ใช้')
        }

        chatRoom.responder.name = responder.firstName + ' ' + responder.lastName

      } else if (request.payload.responder.ownerType === ownerTypes.TEAM) {

        responder = await Team.findOne(
          {_id: request.payload.responder.ownerId}).lean()

        if (!responder) {
          return Boom.badRequest('ไม่พบทีม')
        }

        chatRoom.responder.name = responder.name

      } else {
        return Boom.badRequest('Wrong responder owner type')
      }

      chatRoom.responder.avatar = _.omit(responder.avatar, ['metadata'])

      /**
       * Prepare message
       */

      const message = {
        userId: request.auth.credentials._id,
        name: request.auth.credentials.firstName + ' ' +
        request.auth.credentials.lastName,
        avatar: _.omitBy(request.auth.credentials.avatar, ['metadata']),
        message: request.payload.message,
      }

      /**
       * Prepare type
       */

      chatRoom.type = request.payload.type

      /**
       * Prepare status and metadata
       */

      switch (request.payload.type) {
        case chatRoomTypes.POST:
          chatRoom.status = metadata.postType === postTypes.OWNER
            ? chatRoomStatus.LOCKED
            : chatRoomStatus.UNLOCKED
          chatRoom.metadata = request.payload.metadata
          break
        case chatRoomTypes.REPORT:
          chatRoom.status = chatRoomStatus.UNLOCKED
          chatRoom.metadata = request.payload.metadata
          break
        default:
          chatRoom.status = chatRoomStatus.UNLOCKED
          break
      }

      /**
       * Final preparation
       */

      chatRoom.messages.push(message)
      chatRoom = await chatRoom.save()

      chatRoom.lastMessage = _.last(chatRoom.messages)
      chatRoom.readBy = [request.auth.credentials._id]

      // chatRoom.lastMessageAt = moment().toDate()

      // Note need to save twice to have a timestamp on the message.
      chatRoom = await chatRoom.save()

      /**
       * End of chat room creation
       */

      /**
       * Socket
       */

      const leanChatRoom = _.omit(chatRoom.toJSON(), ['messages'])

      request.server.app.io.of(socketConstants.CHAT_ROOM.NAME_SPACE).
        to(socketConstants.CHAT_ROOM.ROOMS.OWNER + chatRoom.initiator.ownerId).
        emit(socketConstants.CHAT_ROOM.EVENTS.TC.ADD_CHAT_ROOM, {
          chatRoom: leanChatRoom,
        })

      request.server.app.io.of(socketConstants.CHAT_ROOM.NAME_SPACE).
        to(socketConstants.CHAT_ROOM.ROOMS.OWNER + chatRoom.responder.ownerId).
        emit(socketConstants.CHAT_ROOM.EVENTS.TC.ADD_CHAT_ROOM, {
          chatRoom: chatRoom.status === chatRoomStatus.LOCKED
            ? censorChatRoom(leanChatRoom)
            : leanChatRoom,
        })

      switch (request.payload.type) {
        case chatRoomTypes.POST: {

          /*
           / Email
           */

          const metadata = JSON.parse(request.payload.metadata)
          const post = await Post.findOne({_id: metadata.postId})

          if (!post) {
            return Boom.badRequest('ไม่พบประกาศ')
          }

          const postTemplateSubstitutions = getPostTemplateSubstitutions(post)

          // Send notification to customer.

          request.server.app.sendgrid.send({
            templateName: 'notification',
            language: 'th',
            content: {
              to: request.auth.credentials.email,
              title: chatRoomsTemplate.CREATE_CHAT_ROOM_NOTIFY_INITIATOR.title,
              name: message.name,
              body: format(
                chatRoomsTemplate.CREATE_CHAT_ROOM_NOTIFY_INITIATOR.body,
                {
                  yourMessage: message.message,
                  yourEmail: request.auth.credentials.email,
                  yourPhoneNumber: request.auth.credentials.phoneNumber,
                  link: process.env.BASE_URL +
                  `/announcements/${chatRoom.postId}`,
                  ...postTemplateSubstitutions
                }),
            },
          })

          // Send notification to owner.

          let recipientList = await getRecipientsByType(
            {
              type: request.payload.responder.ownerType,
              id: request.payload.responder.ownerId,
              permission: request.payload.responder.ownerType === 'TEAM'
                ? teamRoles.MANAGE_MESSAGE
                : undefined,
            })

          _.each(recipientList, recipient => {
            request.server.app.sendgrid.send({
              templateName: 'notification',
              language: 'th',
              content: {
                to: recipient.email,
                title: chatRoomsTemplate.CREATE_CHAT_ROOM_NOTIFY_RESPONDER.title,
                name: recipient.name,
                body: format(
                  chatRoomsTemplate.CREATE_CHAT_ROOM_NOTIFY_RESPONDER.body, {
                    link: process.env.BASE_URL + `/access-control/login`,
                    ...postTemplateSubstitutions,
                  }),
              },
            })
          })

          break
        }
        case chatRoomTypes.REPORT: {
          /*
           / Email
           */

          // Send notification to Makadin support.

          let recipientList = await getRecipientsByType(
            {
              type: request.payload.responder.ownerType,
              id: request.payload.responder.ownerId,
              permission: teamRoles.MANAGE_MESSAGE,
            })

          _.each(recipientList, recipient => {
            request.server.app.sendgrid.send({
              templateName: 'notification',
              language: 'th',
              content: {
                to: recipient.email,
                title: chatRoomsTemplate.CREATE_CHAT_ROOM_NOTIFY_MAKADIN_SUPPORT.title,
                name: recipient.name,
                body: format(
                  chatRoomsTemplate.CREATE_CHAT_ROOM_NOTIFY_MAKADIN_SUPPORT.body,
                  {
                    link: process.env.BASE_URL + `/access-control/login`,
                  }),
              },
            })
          })

          break
        }

        default:
          break
      }

      return h.response({_id: chatRoom._id, message: 'ส่งข้อความสำเร็จแล้ว'}).
        code(201)
    } catch (err) {
      return Boom.badImplementation(err)
    }
  },
}
