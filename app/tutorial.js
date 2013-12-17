module.exports = Tutorial;

var Emitter = require('emitter');

var snowmanBtn = '<a class="js-build-snowman build-snowman-btn">BUTTON</a>'
var copy = [
  //0
  {
    mouse:'Click anywhere in the snow to start!',
    touch:'Tap anywhere in the snow to start!'
  },
  //1
  {
    mouse:'Drag the ball or use arrow keys to roll it',
    touch:'Drag the ball to roll it'
  },
  //2
  {
    mouse:'At least three of them would be great',
  },
  //3
  {
    mouse:'Perfect! You got three! Now press this '+ snowmanBtn,
    touch:'Perfect! You got three! Now tap this ' + snowmanBtn
  },
  //4
  {
    mouse:'Great! Start with placing the nose. Click to attach.',
    touch:'Great! Start with placing the nose. Tap where you want it.'
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
      self.toStep(self._currentStep, true);
    },this._temporaryNoteTimeOut*1000 )

  } else {

    this._currentStep = this._toStep;
    this._toStep = null;
    var currentCopy = copy[this._currentStep]['mouse'];
    this.$contentEl.html( currentCopy );

    if( currentCopy.indexOf('BUTTON') !== -1 ){
      var btn = $('.js-build-snowman');
      btn.bind('click', function(evt){
        evt.preventDefault();
        evt.stopPropagation();
        self.emit('createSnowman');
        self.hide();
      })
    }
  }

  this._inTransition = true;

  TweenMax.fromTo( this.$el,1,{y:200},{delay:0.5, y:0, ease:Back.easeOut, force3D:true, onComplete: transitionDone});

  function transitionDone(){
    self._inTransition = false;
  }
}

p._animationOut = function(){

  this._inTransition = true;

  $('.js-build-snowman').unbind();

  this._clearTemporaryTimeouts();

  var self = this;
  TweenMax.fromTo(this.$el,0.3,{y:0},{y:200, ease:Back.easeIn, force3D:true, onComplete: transitionDone });

  function transitionDone(){
    self._inTransition = false;
    self._isActive = false;
    if( self._toStep ) {
      self._show();
    }
  }
}

p._clearTemporaryTimeouts = function(){
  if( this._temporaryTimeoutId ) {
    clearTimeout(this._temporaryTimeoutId);
    this._temporaryTimeoutId = null;
  }
}

p.toStep = function( step , force){

  //test if it's the next step
  if( step === this._currentStep + 1 || force) {

    if( this._inTransition ) {
      TweenMax.killTweensOf(this.$el);
    }

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

  this._inTransition = false;

  this._clearTemporaryTimeouts();

  this._temporaryNote = str;
  this._temporaryNoteTimeOut = time;

  this._show();


}
