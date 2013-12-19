module.exports = Tutorial;

var Emitter = require('emitter');

var snowmanBtn = '<a class="js-build-snowman build-snowman-btn">BUTTON</a>';
var okBtn = '<a class="js-build-ok build-snowman-btn">OK</a>';
var shotBtn = '<a class="js-build-shot build-snowman-btn">PICTURE</a>';
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
    mouse:'Create more by clicking the snow. At least three would be great.',
    touch:'Create more by tapping the snow. At least three would be great.'
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
    mouse:'Arms perhaps?',
    touch:'Arms perhaps?'
  },
  //6
  {
    mouse:'Decorate with stones, press '+ okBtn +' when you are done.',
    touch:'Decorate with stones, tap '+ okBtn +' when you are done.'
  },
  //7
  {
    mouse:'Take a '+ shotBtn +' ?',
    touch:'Take a '+ shotBtn +' ?',
  },
  //8
  {
    mouse:'Merry Cristmas everybody!',
    touch:'Merry Cristmas everybody!',
  },
]

function Tutorial( renderer ) {
  this.renderer = renderer;
  this.$el = $("#instructions");
  this.$contentEl = $("#instructionContent");
  this.$snowmanEl = $(".snowman-icon");
  this._currentStep = -1;
  this._isActive = false;
  this.$el.removeClass("inactive")
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
    else if( currentCopy.indexOf('OK') !== -1 ){
      var btn = $('.js-build-ok');
      btn.bind('click', function(evt){
        evt.preventDefault();
        evt.stopPropagation();
        self.emit('editDone');
        self.hide();
      })
    }
    else if( currentCopy.indexOf('PICTURE') !== -1 ){
      var btn = $('.js-build-shot');

      btn[0].href = this.renderer.domElement.toDataURL();
      btn[0].download = "snowman-" + (Date.now()) + ".png";

      btn.bind('click', function(evt){
        //evt.preventDefault();
        //evt.stopPropagation();
        self.emit('takePicture');
        self.hide();
      })
    }
  }

  this._inTransition = true;

  TweenMax.fromTo( this.$snowmanEl,0.7,{y:180},{delay:0.5, y:0, ease:Back.easeOut, force3D:true});
  TweenMax.fromTo( this.$el,0.7,{y:200},{delay:0.5, y:0, ease:Back.easeOut, force3D:true, onComplete: transitionDone});

  function transitionDone(){
    self._inTransition = false;
  }
}

p._animationOut = function(){

  this._inTransition = true;

  $('.js-build-snowman').unbind();
  $('.js-build-ok').unbind();
  $('.js-build-shot').unbind();

  this._clearTemporaryTimeouts();

  var self = this;
  TweenMax.fromTo( this.$snowmanEl,0.7,{y:0},{delay:0.5, y:180, ease:Back.easeIn, force3D:true});
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
