'use strict';

module.exports = Builder;

var DomEventMap = require('dom-event-map');
var raf = require('raf');
var mixin = require('mixin');
var debug = require('debug');
var forEach = require('for-each');
var settings = require('./settings');
var SettingsUI = require('./settings-ui');
var Trail = require('./trail');
var Ball = require('./ball');
var detector = require('./utils/detector');
var ObjectPool = require('./utils/object-pool');
var SnowChunk = require('./snow-chunk');
var Sounds = require('./sounds');
var DecorationEditor = require('./decoration-editor');

var SHADOW_MAP_WIDTH = 1024*2;
var SHADOW_MAP_HEIGHT = 1024*2;

var STATE_CREATING_BALLS = "creating balls";
var STATE_ANIMATE_TO_SNOWMAN = "animate balls";
var STATE_EDIT_SNOWMAN_HEAD = "edit snowman head";

function Builder() {

  this.groundSize = {width:2000,height:2000};

  this.size = {};
  this._mouse2D = new THREE.Vector2();
  this._normalizedMouse2D = new THREE.Vector2();
  this._canCreateBallAt = new THREE.Vector3(-1,-1,0);

  this._cameraOffset = new THREE.Vector3(0,300,300);
  this._mouseMoved = false;
  this._steerIsActive = false;
  this._keyStatus = Object.call(this);
  //bind scope

  this._draw = this._draw.bind(this);
  this._onResize = this._onResize.bind(this);
  this._onMouseMove = this._onMouseMove.bind(this);
  this._onMouseDown = this._onMouseDown.bind(this);
  this._onMouseUp = this._onMouseUp.bind(this);
  this._onUpdateTrailPosition = this._onUpdateTrailPosition.bind(this);
  this._createSnowman = this._createSnowman.bind(this);
  this._initEditMode = this._initEditMode.bind(this);
  this._updateMousePicker = this._updateMousePicker.bind(this);

  this.sizeRatio = 1;
  this.projector = new THREE.Projector();

  this._balls = [];
  this._ballMap = {};
  this._currentBallSelected = 0;
  this._snowmanBalls = [];
  this._lookAtPosition = null;

  this.trailCanvas = new Trail();

  this._initSnowChunks();

  this.settingsUI = new SettingsUI();

 // this._spawnSnowChunk = this._spawnSnowChunk.bind(this);
}

DomEventMap(Builder.prototype);

mixin(Builder.prototype, {

  init: function() {

    this._sounds = new Sounds();
    this._sounds.init();

    this._stage = document.getElementById('stage');
    this._$createSnowmanBtn = $('#createSnowmanBtn');

    this._clock = new THREE.Clock();

    this._state = STATE_CREATING_BALLS;

    this._init3D();
    this._onResize();
    this._initLights();
    this._createSceneObjects();


    this._draw();

    this._addEventListeners();

    return;

    var ball = this._createNewBall( new THREE.Vector3(100,0,100), false);
    ball.ballRadius = 50;
    ball.update();

    ball = this._createNewBall( new THREE.Vector3(-100,0,-100), false);
    ball.ballRadius = 30;
    ball.update();

    ball = this._createNewBall( new THREE.Vector3(0,0,0), false);
    ball.ballRadius = 20;
    ball.update();

    this._createSnowman();

  },

  _initSnowChunks: function(){

    this._snowChunks = [];

    this._snowChunksPool = new ObjectPool();

    this._snowChunksPool.createObject = function(){
      var chunk = new SnowChunk();
      return chunk;
    }
  },

  _spawnSnowChunk: function(){

    /*var newChunk = this._snowChunksPool.getObject();
    newChunk.add(this.scene);
    newChunk.mesh.position.copy(this.snowBall.position ).sub(new THREE.Vector3(Math.random()*10,settings.ballRadius*0.5,0)).add(this.moveDir.negate().multiplyScalar(44));

    this._snowChunks.push(newChunk);*/
  },

  _addEventListeners: function(){

    var self = this;

    this.mapListener(window, 'resize', this._onResize);
    this.mapListener(window, 'mouseup', this._onMouseUp);
    this.mapListener(this._stage, 'mousedown', this._onMouseDown);
    this.mapListener(this._stage, 'mousemove', this._onMouseMove);

    //ui buttons

    this.mapListener(this._$createSnowmanBtn[0], 'click', this._createSnowman);

    var list = ['left','right','up','down'];

    forEach(list,function(dir){

      Mousetrap.bind(dir, keyDown, 'keydown');
      Mousetrap.bind(dir, keyUp, 'keyup');

      function keyDown() {
        self._keyStatus[dir] = true;
        self._steerIsActive = true;

        if( self._balls.length === 0 ) {
          self._createNewBall();
        }

      }

      function keyUp() {
        self._keyStatus[dir] = false;

        //set steering flag
        self._steerIsActive = self._keyStatus['left'] || self._keyStatus['right'] || self._keyStatus['down'] || self._keyStatus['up'];

      }
    })
  },

  _onMouseMove: function( evt ){
    this._mouse2D.set( evt.clientX,evt.clientY);

    this._normalizedMouse2D.set(
      (this._mouse2D.x/this.size.width-0.5)*2,
      (this._mouse2D.y/this.size.height-0.5)*2
    );

    if( this._mouseIsDown ) {
      return;
    }

    this._mouseMoved = true;
  },

  _onMouseDown: function( evt ){
    this._mouseIsDown = true;

    if( this._state === STATE_CREATING_BALLS && this._canCreateBallAt.x !== 5000 ) {
      this._createNewBall(this._canCreateBallAt);
    }
  },

  _onMouseUp: function( evt ){
    this._mouseIsDown = false;

    if( this._decorationEditor && this._decorationEditor.getCurrentBall() ) {
      this._decorationEditor.attachObject();
    }
  },

  _init3D: function(){

    this.camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 1, 7000 );
    this.scene = new THREE.Scene();

    this.camera.position.copy( this._cameraOffset );
    this.camera.lookAt( this.scene.position );
    this.camera.lookAtTarget = new THREE.Vector3();
    this.scene.add(this.camera);
    //this.scene.overrideMaterial = new THREE.MeshBasicMaterial({wireframe:true,color:0x333333});

    if( detector.isTouchDevice && detector.isMobile ) {
      this.sizeRatio = 2.5;
    }

    try {
      this.renderer = new THREE.WebGLRenderer({canvas: document.getElementById('builderCanvas'),antialias:true});
    }
    catch( err ) {
      this._showFallback();
      return;
    }

    this.renderer.sortElements = false;
    this.renderer.setClearColor(0xffffff,1);

    this.renderer.gammaInput = true;
    this.renderer.gammaOutput = true;
    this.renderer.physicallyBasedShading = true;

    this.renderer.shadowMapEnabled = true;
    this.renderer.shadowMapSoft = true;
    this.renderer.shadowMapDebug = false;

    this.shadowMapType = THREE.PCFShadowMap;
    this.shadowMapCullFace = THREE.CullFaceFront;
    //this.renderer.shadowMapDebug = true;
    //this.renderer.shadowMapCascade = true;

    this.scene.fog = new THREE.Fog( 0xffffff, 1000, 6000 );

    if (this.sizeRatio > 1) {
      this.renderer.domElement.style.webkitTransform = "scale3d("+this.sizeRatio+", "+this.sizeRatio+", 1)";
      this.renderer.domElement.style.webkitTransformOrigin = "0 0 0";
    }

  },

  _showFallback: function() {
    var el = $('#error')
    el.html('<iframe src="//player.vimeo.com/video/" width="800" height="500" frameborder="0" webkitallowfullscreen mozallowfullscreen allowfullscreen></iframe>');
    $('#errorWrapper').removeClass('inactive');

  },

  _initLights: function(){

    this.ambientLight = new THREE.AmbientLight( 0x777777, 0.4 );
    this.scene.add(this.ambientLight);

    var hemiLight = new THREE.HemisphereLight( 0xfefefe,0xdce9f8 , 0.6 );
    this.scene.add(hemiLight);

    //this.pointLight = new THREE.PointLight( 0xffffff, 0.8,1000);
    //this.pointLight.position.set(0,1025,-1000);
    //this.scene.add(this.pointLight);

    this.dirLight = new THREE.DirectionalLight( 0xf9fafc, 0.97);
    this.dirLight.position.set( -500, 1400, -200  );

    this.dirLight.shadowMapWidth = 2048;
    this.dirLight.shadowMapHeight = 2048;

    this.dirLight.shadowCameraNear = 1150;
    this.dirLight.shadowCameraFar = 2300;
    this.dirLight.shadowDarkness = 0.3;
    this.dirLight.shadowBias = 0.039;
    //this.dirLight.shadowCameraFov = 50;
    this.dirLight.shadowCameraLeft = -1224;
    this.dirLight.shadowCameraRight = 1224;
    this.dirLight.shadowCameraTop = 1224;
    this.dirLight.shadowCameraBottom = -1224;
    this.dirLight.shadowCameraVisible = false;

    this.dirLight.castShadow = true;

    this.scene.add(this.dirLight);

  },


  _createSceneObjects: function(){

    this.trailTexture = new THREE.Texture(this.trailCanvas.el);
    this.trailTexture.needsUpdate = true
    this.trailCanvas.update(0,512,512,1);

    var diffuseMap = THREE.ImageUtils.loadTexture('assets/images/snow-diffuse4.jpg');
    diffuseMap.wrapT = diffuseMap.wrapS = THREE.RepeatWrapping;

    var groundGeo = new THREE.PlaneGeometry(this.groundSize.width,this.groundSize.height,150,150);

    var snowUniforms = {
      uDisplacementScale: { type: "f", value: 67.1 },
      time: { type: "f", value: 0 }
    };

    var finalSnowUniform = THREE.UniformsUtils.merge( [THREE.ShaderLib["phong"].uniforms, snowUniforms] );
    finalSnowUniform.map.value = diffuseMap;

    finalSnowUniform.shininess.value = 10;
    finalSnowUniform.bumpMap.value = this.trailTexture;
    finalSnowUniform.bumpScale.value = 3;
    /*
    finalSnowUniform.fogNear.value = this.scene.fog.near;
    finalSnowUniform.fogFar.value = this.scene.fog.far;
    finalSnowUniform.fogColor.value = new THREE.Color(0xffffff);*/

    var params = {
        uniforms:  finalSnowUniform,
        vertexShader: require('./shaders/ground_vs.glsl'),
        fragmentShader: require('./shaders/ground_fs.glsl'),
        lights: true,
    }

    var snowMaterial = new THREE.ShaderMaterial(params);
    snowMaterial.bumpMap = true;
    snowMaterial.shadowMapEnabled = true;
    snowMaterial.shadowMapDebug = true;

    //snowMaterial.shadowMapCascade = true;

    this.ground = new THREE.Mesh( groundGeo, snowMaterial);
    this.ground.id = "ground";
    this.ground.receiveShadow = true;
    this.ground.castShadow = false;
    this.ground.rotation.x = - 90 * Math.PI / 180;
    this.ground.position.y = 0;

    this.scene.add(this.ground);


    //distance material
    var finalSnowUniform2 = THREE.ShaderLib["phong"].uniforms;
    finalSnowUniform2.map.value = diffuseMap;
    finalSnowUniform2.shininess.value = 10;

    //create empty canvas for this material
    var canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    canvas.getContext("2d").fillStyle = 'white';
    canvas.getContext("2d").fillRect(0, 0, 1024, 1024);
    var trailTexture2 = new THREE.Texture(canvas);
    trailTexture2.needsUpdate = true
    finalSnowUniform2.bumpMap.value = trailTexture2;

    var largeMaterial = new THREE.ShaderMaterial({
      uniforms:  finalSnowUniform2,
      vertexShader: require('./shaders/ground_vs.glsl'),
      fragmentShader: require('./shaders/ground_fs.glsl'),
      lights: true,
    });
    largeMaterial.bumpMap = true;

    var largeGround = new THREE.Mesh( new THREE.PlaneGeometry(2000,6000, 10,10 ), largeMaterial);
    largeGround.rotation.x = -90 * Math.PI / 180;
    largeGround.position.x = 2000;
    this.scene.add(largeGround);

    largeGround = new THREE.Mesh( new THREE.PlaneGeometry(2000,6000, 10,10 ), largeMaterial);
    largeGround.rotation.x = -90 * Math.PI / 180;
    largeGround.position.x = -2000;
    this.scene.add(largeGround);

    largeGround = new THREE.Mesh( new THREE.PlaneGeometry(2000,2000, 10,10 ), largeMaterial);
    largeGround.rotation.x = -90 * Math.PI / 180;
    largeGround.position.z = -2000;
    this.scene.add(largeGround);

    largeGround = new THREE.Mesh( new THREE.PlaneGeometry(2000,2000, 10,10 ), largeMaterial);
    largeGround.rotation.x = -90 * Math.PI / 180;
    largeGround.position.z = 2000;
    this.scene.add(largeGround);

  },

  _createNewBall: function( position, skipAnimate ){

    var newBall = new Ball(this.scene);
    newBall.on("trailPositionUpdate", this._onUpdateTrailPosition)

    this._balls.push(newBall);
    this._ballMap[newBall.mesh] = newBall;

    if( position ) {
      newBall.mesh.position.x = position.x
      newBall.mesh.position.z = position.z
    }

    this._currentBallSelected = this._balls.length-1;

    if( this._balls.length > 2) {
      this._$createSnowmanBtn.removeClass("inactive");
    }

    if( !skipAnimate ) {
      TweenMax.fromTo( newBall,2.7,{ballRadius:5},{ballRadius:15});
    }

    return newBall;
  },

  _onUpdateTrailPosition: function( id, x, y, radius ){
    this.trailCanvas.update(id, x, y, radius)
    this.trailTexture.needsUpdate = true;
  },

  _createSnowman: function(){

    var self = this;
    var snowman = new THREE.Object3D();

    this._$createSnowmanBtn.addClass("inactive");

    this._state = STATE_ANIMATE_TO_SNOWMAN;

    var sortedBalls = this._balls.concat().sort(function(obj1, obj2) {
      return (obj2.ballRadius - obj1.ballRadius);
    }).splice(0,3);

    this._snowmanBalls = sortedBalls;
    var animationScale = 1;
    var ball;
    var currentHeight = -10;
    for (var i = 0; i < 3; i++) {
      ball = sortedBalls[i];
      ball.belongsToSnowman = true;

      currentHeight += ball.ballRadius + 3;
      ball.finalY = currentHeight;
      TweenMax.to(ball.mesh.position,1*animationScale,{delay:1*i,y:250, ease:Sine.easeInOut, onComplete:ballInCenter, onCompleteParams:[ball]});

      currentHeight += ball.ballRadius - 15;
    };

    TweenMax.to(this.camera.position,2*animationScale,{ease:Sine.easeInOut,x:0,y:currentHeight+50,z:140,onUpdate:updateCamera,onComplete:cameraInPlace});

    var lookAtTarget = new THREE.Vector3(0,sortedBalls[1].finalY,0);
    var currentLookAt = this._balls[1].mesh.position.clone();

    function dropBalls( ball ) {
      ball.mesh.position.x = 0;
      ball.mesh.position.z = 0;
    }

    function ballInCenter( ball ) {
      ball.mesh.position.x = 0;
      ball.mesh.position.z = 0;
      TweenMax.to(ball.mesh.position,0.7*animationScale,{ y: ball.finalY, ease:Sine.easeOut,  });
      TweenMax.to(ball.mesh.rotation,1*animationScale,{delay:0.4,y: "-0.5" });
    }

    function updateCamera(){
      //currentLookAt.lerp(lookAtTarget,0.1+ (1-animationScale));
      self.camera.lookAt(lookAtTarget );
    }

    function cameraInPlace(){
      TweenMax.to(self.camera.position,1*animationScale,{ease:Sine.easeInOut,x:0,y:currentHeight+20,z:150, onComplete: self._initEditMode });
    }

  },

  _initEditMode: function(){
    this._decorationEditor = new DecorationEditor(this.scene, this.camera);

    this._state = STATE_EDIT_SNOWMAN_HEAD;

    this._decorationEditor.activeBall( this._snowmanBalls[2] );

    this._decorationEditor.addStone();

  },

  _draw: function(){
    var delta = this._clock.getDelta();
    var time = this._clock.getElapsedTime() * 10;
    var self = this;

    //this.ground.material.uniforms.time.value += delta/100;

    if (isNaN(delta) || delta > 1000 || delta === 0 ) {
      delta = 1000/60;
    }
    this.delta = delta;

    if( this._mouseMoved ) {
      this._canCreateBallAt.set(5000,0,5000);
      this._mouseMoved = false;
      this._updateMousePicker();
    }

    if( this._state === STATE_EDIT_SNOWMAN_HEAD && this._lookAtPosition ) {
      var currentEditBall = this._decorationEditor.getCurrentBall();

      this.camera.position.y += ((this._lookAtPosition.y + 40 + currentEditBall.ballRadius*2)- this.camera.position.y)*0.1;
      this.camera.position.z += ((currentEditBall.ballRadius*3 + 60)- this.camera.position.z )*0.1;
      this.camera.lookAtTarget.lerp(this._lookAtPosition,0.1);
    }

    if( this._balls.length ) {
      var selectedBall = this._balls[this._currentBallSelected];

      if( this._state === STATE_CREATING_BALLS ) {
        if( this._mouseIsDown ) {
          selectedBall.steerWithMouse(this._normalizedMouse2D);
        }
        else if( this._steerIsActive) {
          selectedBall.steerWithKeyboard(this._keyStatus);
        }
        console.log(selectedBall.velocity.clone().lengthSq())

        this._sounds.setRollVolume(selectedBall.velocity.clone().lengthSq());

        this.camera.position.lerp(selectedBall.mesh.position.clone().add(this._cameraOffset),0.1);
        var ball;
        for (var i = this._balls.length - 1; i >= 0; i--) {
          ball = this._balls[i];
          ball.updateCollision( this._balls);
          ball.update();
        }
      }
    }

    this.renderer.render( this.scene, this.camera );

    raf( this._draw );
  },

  _updateMousePicker: function(){
    var vector = new THREE.Vector3(this._normalizedMouse2D.x,this._normalizedMouse2D.y*-1,0.5);
    this.projector.unprojectVector( vector,this.camera);

    var raycaster = new THREE.Raycaster(this.camera.position,vector.sub(this.camera.position).normalize() );
    var intersects = raycaster.intersectObjects( this.scene.children );

    if ( intersects.length > 0 ) {
      var intersect = intersects[0];

      if( intersect.object === this.ground ) {

        if( !this._balls.length ) {
          this._canCreateBallAt.copy(intersect.point);
        }
        else {
          var canSpawn = true;
          for (var i = this._balls.length - 1; i >= 0; i--) {
            if(this._balls[i].mesh.position.distanceTo(intersect.point) < 60) {
              canSpawn = false
            }
          }
          if( canSpawn ) {
            this._canCreateBallAt.copy(intersect.point);
          }
        }
      }
      else if( intersect.object.id.length > 0 && intersect.object.id.indexOf("ball") !== -1 && this._state === STATE_EDIT_SNOWMAN_HEAD ) {
        if( this._decorationEditor ) {
          this._decorationEditor.activeBall( intersect.object.parentObject);
          this._decorationEditor.set3DCursor(intersect.point, intersect.face.normal);
          this._lookAtPosition = intersect.object.position.clone();
        }
      }
    }
  },

  _onResize: function() {

    var winW = window.innerWidth;
    var winH = window.innerHeight;

    this.size.width = winW;
    this.size.height = winH;
    this.size.sizeRatio = this.sizeRatio;

    this.camera.aspect = winW / winH;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize( winW/this.sizeRatio, winH/this.sizeRatio);

    //this._$stage.css({width:winW +"px",height:visibleHeight+"px"});

  },

  _dispose: function() {
    this.unmapAllListeners();

    //return all arrows to pool
    for (i = this._snowChunks.length - 1; i >= 0; i--) {
      this._snowChunks[i].remove();
      this._snowChunksPool.returnObject( this._snowChunks[i].poolId );
    };

    this._snowChunks.length = 0;

  }
});
