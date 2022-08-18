/**
 * Created by mak.punyachokchai on 6/5/2018 AD.
 */

 import template from './chat-room-input-message.pug'

 ChatRoomInputMessageController.$inject = [
   '$timeout',
   'STATIC_DATA',
   'jquery',
   'poll'
 ]
 
 function ChatRoomInputMessageController ($timeout, STATIC_DATA, jquery, poll) {
 
   /**
    * Private properties
    */
 
   const vm = this
   const SC = STATIC_DATA.socketConstants
 
   /**
    * Public Properties
    */
 
   vm.formModels = {
     message: '',
   }
 
   vm.sendingMessage = false
 
   /**
    * Public method mappings
    */
 
   vm.keydown = keydown
   vm.submit = submit
 
   /**
    * Life cycle hooks
    */
 
   vm.$onInit = () => {
     setupHeight()
   }
 
   vm.$onDestroy = () => {
   }
 
   /**
    * Public methods
    */
 
   function keydown (event) {
 
     if (event.keyCode === 13 && !event.shiftKey) {
       submit()
     }
 
   }
 
   function submit () {
     if (vm.formModels.message !== '') {
       let temp = vm.formModels.message
       vm.formModels.message = ''
       vm.sendingMessage = true
       vm.socket.emit(SC.CHAT_ROOM.EVENTS.TS.ADD_MESSAGE, {
         chatRoomId: vm.chatRoom._id,
         message: temp,
       }, () => {
         vm.sendingMessage = false
         // if(buttonClicked){
         //   jquery('#input-message').val('')
         //   jquery('#input-message').outerHeight(38)
         // }
         $timeout(()=>{
           jquery('#input-message').val('')
           jquery('#input-message').outerHeight(38)
         }, 0)
       })
     }else{
       $timeout(()=>{
         jquery('#input-message').val('')
         jquery('#input-message').outerHeight(38)
 
       }, 0)
     }
   }
 
   /**
    * Private methods
    */
 
   function setupHeight () {
     const condition = () => angular.element(
       document.querySelector('#input-message')).length === 1
     poll(condition, 10000, 500).then(() => {
 
       jquery(document).on('input', '#input-message', function () {
         jquery(this).
           outerHeight(38).
           outerHeight(this.scrollHeight > 100 ? 100 : this.scrollHeight) // 38 or '1em' -min-height
       })
 
       //
       // jquery('#input-message').each(function () {
       //   this.setAttribute('style',
       //     'height:' + (this.scrollHeight) + 'px;overflow-y:hidden;')
       // }).on('keydown', function () {
       //   this.style.height = '38px;'
       //   if (this.scrollHeight > 100) {
       //     this.style.height = '100px'
       //   } else {
       //     this.style.height = (this.scrollHeight) + 'px'
       //   }
       // })
     })
   }
 
 }
 
 export default {
   bindings: {
     chatRoom: '<',
     socket: '=',
     disabled: '<',
   },
   template: template,
   controller: ChatRoomInputMessageController,
   controllerAs: 'Ctrl',
 }