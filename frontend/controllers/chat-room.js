/**
 * Created by mak.punyachokchai on 6/5/2018 AD.
 */

 import template from './chat-room.pug'

 ChatRoomController.$inject = [
   '_',
   '$filter',
   '$scope',
   '$state',
   'STATIC_DATA',
   'ChatRoom',
   'ModalService',
   'NotifierService',
   'Post',
   'authManager',
   'io',
   'jquery',
   'moment',
   'poll',
   'safeApply',
 ]
 
 function ChatRoomController (_, $filter, $scope, $state, STATIC_DATA,
                          ChatRoom, ModalService,
                          NotifierService, Post, authManager, io,
                          jquery, moment, poll, safeApply) {
 
   /**
    * Private properties
    */
 
   let vm = this
   const SC = STATIC_DATA.socketConstants
 
   /**
    * Public Properties
    */
 
   vm.params = $state.params
   vm.currentUser = authManager.getUserInfo()
   vm.formModels = {}
   vm.chatRooms = []
   vm.messages = []
 
   /**
    * Public method mappings
    */
 
   vm.showReportModal = showReportModal
   vm.selectChatRoom = selectChatRoom
   vm.payForChatRoom = payForChatRoom
   vm.showCounterpartProfile = showCounterpartProfile
   vm.showPost = showPost
 
   /**
    * Life cycle hooks
    */
 
   vm.$onInit = () => {
 
     vm.loading = true
 
     const condition = () => angular.element(
       document.querySelector('#chat-sidebar-header')).length === 1
     poll(condition, 10000, 500).then(() => {
       jquery('body').
         on('click', '#chat-sidebar-toggle-button', toggleChatSidebar)
 
       toggleChatSidebar()
     })
 
     setupSocket()
 
   }
 
   vm.$onDestroy = () => {
     teardownSocket()
   }
 
   /**
    * Public methods
    */
 
   function showReportModal(){
 
     let profile
     if(vm.currentChatRoom.responder.ownerId === vm.params.ownerId){
       profile = vm.currentChatRoom.initiator
     }else if(vm.currentChatRoom.initiator.ownerId === vm.params.ownerId){
       profile = vm.currentChatRoom.responder
     }
 
     const title = 'แจ้งปัญหาการสนทนากับ ' + profile.name
     const options = {
       title,
       metadata: {
         type: profile.ownerType,
         ...profile
       },
       initiator: {
         ownerId: vm.params.ownerId,
         ownerType: vm.params.ownerType,
       }
     }
     ModalService.showModalReport(options)
   }
 
   function selectChatRoom (chatRoom) {
     if (isMobile()) {
       toggleChatSidebar()
     }
 
     if (!vm.currentChatRoom || chatRoom._id !== vm.currentChatRoom._id) {
 
       vm.currentChatRoom = chatRoom
       vm.messages = []
 
       // if(!$filter('isChatCensored')(chatRoom)){
         readMessages(chatRoom)
       // }else{
         vm.loading = false
       // }
 
     }else{
       vm.loading = false
     }
 
   }
 
   function payForChatRoom (chatRoom) {
     if (authManager.isUserVerified()) {
       const options = {
         callback: function (confirm) {
           if (confirm) {
             // console.log(chatRoom)
             confirmPayForChatRoom(chatRoom)
           }
         },
       }
       ModalService.showModalConfirm(options)
     } else {
       ModalService.showModalUserNotVerified(authManager.getUserInfo()._id)
     }
   }
 
   function showCounterpartProfile () {
     vm.isCounterpartProfileVisible = false
     const params = {
       ownerId: vm.params.ownerId,
       ownerType: vm.params.ownerType,
       chatRoomId: vm.currentChatRoom._id
     }
     ChatRoom.getCounterpartProfile(params).$promise.then(counterpartProfile => {
       vm.counterpartProfile = counterpartProfile
       vm.isCounterpartProfileVisible = true
     }).catch(err => {
       NotifierService.error(err.data.message)
     })
   }
 
   function showPost () {
     vm.isShowPostVisible = false
     const metadata = JSON.parse(vm.currentChatRoom.metadata)
     Post.getAnnouncement({postId: metadata.postId}).$promise.then(post => {
       vm.currentPost = post
       vm.isShowPostVisible = true
     }).catch(err => {
       NotifierService.error(err.data.message)
     })
   }
 
   function toggleChatSidebar () {
     // console.log('toggleChatSidebar')
     jquery('#chat-sidebar-header').toggleClass('sidebar-is-active')
     jquery('#chat-main-content-header').toggleClass('sidebar-is-active')
     jquery('#chat-sidebar').toggleClass('sidebar-is-active')
     jquery('#chat-main-content').toggleClass('sidebar-is-active')
   }
 
   /**
    * Private methods
    */
 
 
   function isMobile () {
     return window.matchMedia('only screen and (max-width: 767px)').matches
   }
 
 
   function confirmPayForChatRoom (chatRoom) {
 
     vm.socket.emit(SC.CHAT_ROOM.EVENTS.TS.PAY_FOR_CHAT_ROOM, {
       chatRoomId: chatRoom._id,
     }, (error) => {
       if (error) {
         ModalService.showModalInsufficientFunds(error,
           chatRoom.responder.ownerId, chatRoom.responder.ownerType)
       } else {
         // const {chatRoom} = payload
         // _.assign(vm.currentChatRoom, chatRoom)
         readMessages(chatRoom)
         NotifierService.success('ชำระค่าบริการสำเร็จ')
       }
     })
 
   }
 
   function readMessages(chatRoom){
     // console.log('chatRoom', chatRoom)
     vm.socket.emit(SC.CHAT_ROOM.EVENTS.TS.READ_MESSAGES,
       {chatRoomId: chatRoom._id},
       payload => {console.log('payload', payload)
         const {messages} = payload
         vm.messages = messages
         // console.log('vm.currentChatRoom ', vm.currentChatRoom)
 
         if(!chatRoom.readBy.includes(vm.currentUser._id)){
           vm.socket.emit(SC.CHAT_ROOM.EVENTS.TS.READ_BY, {
             chatRoomId: chatRoom._id
           })
         }
 
         vm.loading = false
         safeApply($scope)
         scrollToBottom()
       })
   }
 
   function setupSocket () {
     vm.socket = io(SC.CHAT_ROOM.NAME_SPACE, {
       query: {
         token: authManager.getToken(),
         ownerId: $state.params.ownerId,
         ownerType: $state.params.ownerType,
       },
       transports: ['websocket'],
     })
 
     const socket = vm.socket
 
     socket.on('connect', () => {
 
       socket.emit(SC.CHAT_ROOM.EVENTS.TS.READ_CHAT_ROOMS, null,
         (payload) => {
           const {chatRooms} = payload
           vm.chatRooms = chatRooms
 
           if(vm.params.chatRoomId){
             const chatRoom = _.find(chatRooms, chatRoom=>chatRoom._id === vm.params.chatRoomId)
             selectChatRoom(chatRoom)
           }else if (chatRooms[0]) {
             selectChatRoom(chatRooms[0])
           }else{
             vm.loading = false
           }
 
           safeApply($scope)
         })
 
       socket.on(SC.CHAT_ROOM.EVENTS.TC.ADD_CHAT_ROOM, payload => {
         // console.log('payload', payload)
         const {chatRoom} = payload
         vm.chatRooms.unshift(chatRoom)
         if (vm.chatRooms.length === 1) {
           selectChatRoom(vm.chatRooms[0])
         }
         safeApply($scope)
       })
 
       socket.on(SC.CHAT_ROOM.EVENTS.TC.UPDATE_CHAT_ROOM, payload => {
         const {chatRoom} = payload
         const matchedChatRoom = _.find(vm.chatRooms,
           room => room._id === chatRoom._id)
         _.assign(matchedChatRoom, chatRoom)
 
         console.log('Updated Chat Room')
         if (chatRoom._id === vm.currentChatRoom._id) {
           console.log('Updated Chat Room if if')
           console.log('vm.messages.length', vm.messages.length)
 
           _.assign(vm.currentChatRoom, chatRoom)
           // Chat room was locked and now unlocked
           if(vm.messages.length === 0){
             console.log('vm.messages.length in if')
             readMessages(chatRoom)
           }
         }
 
         vm.chatRooms = _.chain(vm.chatRooms).
           sortBy(room => moment(room.lastMessage.createdAt)).
           reverse().
           value()
         safeApply($scope)
       })
 
       socket.on(SC.CHAT_ROOM.EVENTS.TC.ADD_MESSAGE, payload => {
         const {chatRoomId, message} = payload
 
         console.log('message1', message)
 
         if(chatRoomId === vm.currentChatRoom._id){
           vm.messages = [...vm.messages, message]
 
           // console.log('vm.messages', vm.messages)
 
           // console.log('message2', message)
 
           safeApply($scope)
 
           scrollToBottom()
 
           socket.emit(SC.CHAT_ROOM.EVENTS.TS.READ_BY, {
             chatRoomId: vm.currentChatRoom._id
           })
         }
 
 
       })
     })
 
     socket.on('reconnect_attempt', () => {
       socket.io.opts.transports = ['polling', 'websocket']
       // socket.io.opts.query = {
       //   token: authManager.getToken()
       // }
     })
 
   }
 
 
 
   function teardownSocket () {
     vm.socket.disconnect()
   }
 
   function scrollToBottom () {
     // $timeout(() => {
 
       const items = document.querySelectorAll('.message li')
       if (items && items.length > 0) {
         const last = items[items.length - 1]
         last.scrollIntoView()
       }
 
     // }, 100)
   }
 
 }
 
 export default {
   bindings: {
     owner: '<',
   },
   template: template,
   controller: ChatRoomController,
   controllerAs: 'Ctrl',
 }