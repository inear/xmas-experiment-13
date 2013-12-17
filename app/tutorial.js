module.exports = Tutorial;

var Emitter = require('emitter');

var snowmanBtn = '<a class="js-build-snowman build-snowman-btn">BUTTON</a>'
var copy = [
  //0
  {
    mouse:'Click anywhere to create a ball',
    touch:'Tap anywhere tp create a ball'
  },
  //1
  {
    mouse:'Drag the ball or use arrow keys to roll it',
    touch:'Drag the ball to roll it'
  },
  //2
  {
    mouse:'Go on and create as many as you like',
  },
  //3
  {
    mouse:'Oh, you got three! Now press this '+ snowmanBtn,
    touch:'Oh, you got three! Now tap this ' + snowmanBtn
  },
  //4
  {
    mouse:'Great! Start with placing the nose with mousedown',
    touch:'Great! Drag and release to place the nose'
  },
  //5
  {
    mouse:'Same thing, decorate the snowman with stones',
    touch:'Same thing, decorate the snowman with stones'
  },

]

function Tutorial() {
  this.$el = $("#instructions");
  this.$contentEl = $("#instructionContent");
  this._currentStep = -1;
  this._isActive = false;
}

var p = Tutorial.prototype;
Emitter(p);

p._show = function(){
  var self = this;

  if( this._inTransition ) return;

  this._isActive = true;

  if( this._temporaryNote ) {
    this.$contentEl.html( this._temporaryNote );
    this._temporaryNote = null;
    this._temporaryTimeoutId = setTimeout(function(){
      console.log("timed out")
      self.toStep(self._currentStep, true);
    },this._temporaryNoteTimeOut*1000 )

  } else {

    this._currentStep = this._toStep;
    var currentCopy = copy[this._currentStep]['mouse'];
    this.$contentEl.html( currentCopy );

    if( currentCopy.indexOf('BUTTON') !== -1 ){
      var btn = $('.js-build-snowman');
      btn.bind('click', function(){
        self.emit('createSnowman');
        self.hide();
      })
    }
  }

  this._inTransition = true;

  TweenMax.to( this.$el,1,{delay:0.5, y:0, ease:Back.easeOut, force3D:true, onComplete: transitionDone});

  function transitionDone(){
    self._inTransition = false;
  }
}

p._animationOut = function(){

  this._inTransition = true;

  $('.js-build-snowman').unbind();

  if( this._temporaryTimeoutId ) {
    clearTimeout(this._temporaryTimeoutId);
    this._temporaryTimeoutId = null;
  }

  var self = this;
  TweenMax.to(this.$el,0.3,{y:200, ease:Back.easeIn, force3D:true, onComplete: transitionDone });

  function transitionDone(){
    self._inTransition = false;
    self._isActive = false;
    if( self._toStep ) {
      self._show();
    }
  }
}

p.toStep = function( step , force){

  if( this._inTransition ) return;

  //test if it's the next step
  if( step === this._currentStep + 1 || force) {
    //step is valid
    this._toStep = step;

    if( !this._isActive ) {
      this._show();
    }
    else {
      this._animationOut();
    }

  }
}

p.hide = function(){
  this._animationOut();
}

p.temporaryNote = function(str, time ){

  if( this._inTransition ) return;

  this._temporaryNote = str;
  this._temporaryNoteTimeOut = time;
  if( !this._isActive ) {
    this._show();
  }
  else {
    this._animationOut();
  }

}
