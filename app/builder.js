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
var Tutorial = require('./tutorial');

var SHADOW_MAP_WIDTH = 1024*2;
var SHADOW_MAP_HEIGHT = 1024*2;

var STATE_CREATING_BALLS = "creating balls";
var STATE_ANIMATE_TO_SNOWMAN = "animate balls";
var STATE_EDIT_SNOWMAN = "edit snowman";
var STATE_COMPLETE = "edit complete";

var CURSOR_OPEN_HAND = 'cursor open hand';
var CURSOR_CLOSED_HAND = 'cursor closed hand';
var CURSOR_POINTER = 'cursor pointer';

function Builder() {

  this.usePostProcessing = !detector.isMobile && !detector.isTablet;
  this.postProcessingActivated = false;

  this.groundSize = {width:2000,height:2000};

  this.size = {};
  this._cursor = '';
  this._mouse2D = new THREE.Vector2();
  this._normalizedMouse2D = new THREE.Vector2();
  this._collisionList = [];
  this._canCreateBallAt = new THREE.Vector3(-1,-1,0);

  this._cameraOffset = new THREE.Vector3(0,300,300);
  this._greetingCameraCenter = new THREE.Vector3(0,10,0);
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
  this._onSnowmanEditDone = this._onSnowmanEditDone.bind(this);
  this._updateMousePicker = this._updateMousePicker.bind(this);
  this._onTakePicture = this._onTakePicture.bind(this);

  this.sizeRatio = 1;
  this.projector = new THREE.Projector();

  this._balls = [];
  this._ballMap = {};
  this._currentBallSelected = 0;
  this._currentBallHover = 0;
  this._snowmanBalls = [];
  this._lookAtPosition = null;

  this._initSnowChunks();

  //this.settingsUI = new SettingsUI();

 // this._spawnSnowChunk = this._spawnSnowChunk.bind(this);
}

DomEventMap(Builder.prototype);

mixin(Builder.prototype, {

  init: function() {

    if( detector.isMobile ) {
      this._showFallback();
      return;
    }

    this._sounds = new Sounds();
    this._sounds.init();

    this._stage = document.getElementById('stage');
    this._$stage = $(document.getElementById('stage'));

    this._clock = new THREE.Clock();

    this._state = STATE_CREATING_BALLS;

    this.trailCanvas = new Trail();

    this._init3D();

    this._updateTrailTexture = this._updateTrailTexture.bind(this);
    this.trailCanvas.on('updateTrailTexture', this._updateTrailTexture);

    if( this.usePostProcessing ) {
      this._initPostProcessing();
    }

    this._onResize();
    this._initLights();
    this._createSceneObjects();

    this._draw();

    this._addEventListeners();

    this._tutorial = new Tutorial(this.renderer);

    this._createSnowman = this._createSnowman.bind(this);
    this._tutorial.once('createSnowman', this._createSnowman );
    this._tutorial.once('editDone', this._onSnowmanEditDone );
    this._tutorial.on('takePicture', this._onTakePicture );

    this._tutorial.toStep(0);

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

    //this._createSnowman();

  },

  _updateTrailTexture: function(){
    this.trailTexture.needsUpdate = true;
  },

  _onTakePicture: function(){
    this._tutorial.toStep(8);
    _gaq.push(['_trackEvent','Picture taken']);
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
/*
    Mousetrap.bind('space', function(){
      self._greetingCameraCenter = new THREE.Vector3(0,20,-50);
      self.trailCanvas.showGreeting();
      self.trailTexture.needsUpdate = true;
    })
*/
    var list = ['left','right','up','down'];

    forEach(list,function(dir){

      Mousetrap.bind(dir, keyDown, 'keydown');
      Mousetrap.bind(dir, keyUp, 'keyup');

      function keyDown( evt ) {
        evt.preventDefault();
        self._keyStatus[dir] = true;
        self._steerIsActive = true;

        if( self._balls.length === 0 ) {
          self._createNewBall();
        }

      }

      function keyUp(evt) {
        evt.preventDefault();

        if( self._balls.length === 1) {
          self._tutorial.toStep(2);
        }

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

    if( this._state === STATE_CREATING_BALLS ) {
      if( this._canCreateBallAt.x !== 5000 ) {
        this._createNewBall(this._canCreateBallAt);
      }
      else if( this._currentBallHover !== -1) {
        this._currentBallSelected = this._currentBallHover;
      }
    }
  },

  _onMouseUp: function( evt ){
    this._mouseIsDown = false;

    if( this._decorationEditor ) {

      var currEditBall = this._decorationEditor.getCurrentBall();

      if( currEditBall ) {

        if( this._balls.length === 1) {
          this._tutorial.toStep(2);
        }

        this._decorationEditor.attachObject();
      }
    }
  },

  _init3D: function(){

    this.camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 1, 7000 );
    this.scene = new THREE.Scene();

    this.camera.position.copy( this._cameraOffset );
    this.camera.lookAt( this.scene.position );
    this.camera.lookAtTarget = new THREE.Vector3();
    //this.scene.add(this.camera);
    //this.scene.overrideMaterial = new THREE.MeshBasicMaterial({wireframe:true,color:0x333333});

    if( detector.isTouchDevice && detector.isMobile ) {
      this.sizeRatio = 2.5;
    }

    try {
      this.renderer = new THREE.WebGLRenderer({canvas: document.getElementById('builderCanvas'),antialias:false,preserveDrawingBuffer: true});
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

    //this.scene.fog = new THREE.Fog( 0xffffff, 3000, 6000 );

    if (this.sizeRatio > 1) {
      this.renderer.domElement.style.webkitTransform = "scale3d("+this.sizeRatio+", "+this.sizeRatio+", 1)";
      this.renderer.domElement.style.webkitTransformOrigin = "0 0 0";
    }

  },

  _showFallback: function() {

    _gaq.push(['_trackPageview','fallback']);

    var el = $('#error')
    el.html('<iframe id="fallback" src="//player.vimeo.com/video/82333173" width="100%" height="100%"" frameborder="0" webkitallowfullscreen mozallowfullscreen allowfullscreen></iframe>');

    this.$fallback = el.find('#fallback');

    $('#errorWrapper').removeClass('inactive');

    var self = this;

    this.mapListener(window, 'resize', this._onResize);
    this.mapListener(window, 'orientationchange', function() {
       self._onResize();
    });

    this._onResize();

    $("body").addClass("fallback-bg");

  },

  _initPostProcessing: function(){
    //if (!tabletDevice && !ie && doPostprocessing) {

      this.renderer.autoClear = false;

      // postprocessing
      this.composer = new THREE.EffectComposer( this.renderer );
      this.composer.addPass( new THREE.RenderPass( this.scene, this.camera ) );

      this.depthTarget = new THREE.WebGLRenderTarget( this.size.width/this.sizeRatio, this.size.height/this.sizeRatio, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat } );

      this.ssao = new THREE.ShaderPass( THREE.SSAOShader );
      this.ssao.uniforms[ 'tDepth' ].value = this.depthTarget;
      this.ssao.uniforms[ 'size' ].value.set( this.size.width/this.sizeRatio, this.size.height/this.sizeRatio );
      this.ssao.uniforms[ 'cameraNear' ].value = 10;
      this.ssao.uniforms[ 'cameraFar' ].value = 1000;
      this.ssao.uniforms[ 'aoClamp' ].value = 0.6;
      this.ssao.uniforms[ 'lumInfluence' ].value = 0.9;
      this.ssao.uniforms[ 'onlyAO' ].value = 0;
      this.composer.addPass( this.ssao );

      this.fxaa = new THREE.ShaderPass( THREE.FXAAShader );
      this.fxaa.uniforms[ 'resolution' ].value = new THREE.Vector2( 1/this.size.width, 1/(this.size.height) );
      this.fxaa.renderToScreen = true;
      this.composer.addPass( this.fxaa );

      // depth pass
      this.depthPassPlugin = new THREE.DepthPassPlugin();
      this.depthPassPlugin.renderTarget = this.depthTarget;

      this.renderer.addPrePlugin( this.depthPassPlugin );

    //}

  },

  _initLights: function(){

    this.ambientLight = new THREE.AmbientLight( 0x777777, 0.4 );
    this.scene.add(this.ambientLight);

    var hemiLight = new THREE.HemisphereLight( 0xfefefe,0xdce9f8 , 0.6 );
    this.scene.add(hemiLight);

    this.dirLight = new THREE.DirectionalLight( 0xf9fafc, 0.97);
    this.dirLight.position.set( -500, 1400, -200  );

    this.dirLight.shadowMapWidth = 2048;
    this.dirLight.shadowMapHeight = 2048;

    this.dirLight.shadowCameraNear = 1150;
    this.dirLight.shadowCameraFar = 2500;
    this.dirLight.shadowDarkness = 0.3;
    this.dirLight.shadowBias = 0.039;

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
    this.diffuseMap = diffuseMap;
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


    this.groundPicker = new THREE.Mesh( new THREE.PlaneGeometry(this.groundSize.width,this.groundSize.height,10,10), new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:0,wireframe:false}))
    this.groundPicker.rotation.x = - 90 * Math.PI / 180;
    this.groundPicker.id = "groundPicker";
    this.scene.add(this.groundPicker);
    this._collisionList.push(this.groundPicker);

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

    //fence
    var finalGeo = new THREE.Geometry();
    var poleMat = new THREE.MeshLambertMaterial({color:0x000000})
    var h = 50;
    var poleGeo = new THREE.CubeGeometry(4,h,4,2,2,2);
    var pole = new THREE.Mesh(poleGeo,poleMat);

    var areaSize = 1800
    var areaSizeHalf = 1800*0.5

    //horz
    for (var pz = 0; pz < 2; pz++) {
      for (var px = 0; px < 11; px++) {

        pole.position.y = h*0.5;
        pole.position.x = areaSize/10*px - areaSizeHalf;
        pole.position.z = pz*areaSize-areaSizeHalf;
        THREE.GeometryUtils.merge(finalGeo, pole);
      };
    }

    //ribs
    var ribWidth = areaSize/11 + 22;
    var ribGeo = new THREE.CubeGeometry(ribWidth,5,1,2,2,2);
    var rib = new THREE.Mesh(ribGeo,poleMat);

    //horz
    for (var pz = 0; pz < 2; pz++) {
      for (var px = 0; px < 10; px++) {

        rib.position.y = h*0.35;
        rib.position.x = areaSize/10*px - areaSizeHalf + ribWidth*0.5 - 2;
        rib.position.z = pz*areaSize-areaSizeHalf;
        rib.rotation.z = (Math.random()*2-1)*Math.PI/180
        THREE.GeometryUtils.merge(finalGeo, rib);

        rib.position.y = h*0.85;
        rib.position.x = areaSize/10*px - areaSizeHalf + ribWidth*0.5 - 2;
        rib.position.z = pz*areaSize-areaSizeHalf;
        rib.rotation.z = (Math.random()*2-1)*Math.PI/180
        THREE.GeometryUtils.merge(finalGeo, rib);
      };
    }

    var copy = finalGeo.clone();
    copy.applyMatrix( new THREE.Matrix4().makeRotationY( - Math.PI / 2 ))
    THREE.GeometryUtils.merge(finalGeo, copy);

    var fence = new THREE.Mesh(finalGeo,poleMat);
    fence.castShadow = true;
    this.scene.add( fence );


  },

  _createNewBall: function( position, skipAnimate ){

    var newBall = new Ball(this.scene);
    newBall.on("trailPositionUpdate", this._onUpdateTrailPosition)

    this._balls.push(newBall);
    this._ballMap[newBall.mesh] = newBall;
    this._collisionList.push(newBall.mesh);

    if( position ) {
      newBall.mesh.position.x = position.x
      newBall.mesh.position.z = position.z
    }

    this._currentBallSelected = this._balls.length-1;

    if( this._balls.length === 1 ) {
      this._tutorial.toStep(1);
    }
    else if( this._balls.length === 3) {
      this._tutorial.toStep(3,true);
    }

    if( !skipAnimate ) {
      TweenMax.fromTo( newBall,0.3,{ballRadius:5},{ballRadius:15});
    }

    _gaq.push(['_trackEvent','Create ball' + this._balls.length ]);

    return newBall;
  },

  _onUpdateTrailPosition: function( id, x, y, radius ){
    this.trailCanvas.update(id, x, y, radius)
    this.trailTexture.needsUpdate = true;
  },

  _createSnowman: function(){

    var self = this;
    var snowman = new THREE.Object3D();

    _gaq.push(['_trackEvent','Create snowman']);

    this._state = STATE_ANIMATE_TO_SNOWMAN;

    var sortedBalls = this._balls.concat().sort(function(obj1, obj2) {
      return (obj2.ballRadius > obj1.ballRadius);
    }).splice(0,3);

    this._snowmanBalls = sortedBalls;
    var animationScale = 1;
    var ball;
    var currentHeight = -20;
    for (var i = 0; i < 3; i++) {
      ball = sortedBalls[i];
      ball.belongsToSnowman = true;
      ball.snowmanIndex = i
      currentHeight += ball.ballRadius + 3 + 3*i;
      ball.finalY = currentHeight;
      TweenMax.to(ball.mesh.position,1*animationScale,{delay:1*i,y:1250, ease:Sine.easeInOut, onComplete:ballInCenter, onCompleteParams:[ball]});

      currentHeight += ball.ballRadius - 15;
    };


    function dropBalls( ball ) {
      ball.mesh.position.x = 0;
      ball.mesh.position.z = 0;
    }

    var hasMadeMArkInSnow = false;
    function ballInCenter( ball ) {
      ball.mesh.position.x = 0;
      ball.mesh.position.z = 0;
      TweenMax.to(ball.mesh.position,0.7*animationScale,{ y: ball.finalY, ease:Sine.easeIn, onComplete:showSmokeRing, onCompleteParams:[ball] });
      TweenMax.to(ball.mesh.rotation,0.2*animationScale,{ x: "0.1",delay:0.6,ease:Sine.easeOut });

      function showSmokeRing( ball ) {

        if( ball.snowmanIndex === 0) {
          self.trailCanvas.makeRoomForSnowman( self._snowmanBalls[0].ballRadius/40 );
          self.trailTexture.needsUpdate = true;
        }

        var smokeRing = new THREE.Mesh(new THREE.TorusGeometry(30-ball.snowmanIndex*8,10-ball.snowmanIndex*2,8,14), new THREE.MeshPhongMaterial({map: self.diffuseMap,wireframe:false,transparent:true,opacity:0.6}));
        self.scene.add(smokeRing);
        smokeRing.scale.set(0.3,0.1,0.3)
        smokeRing.rotation.x = Math.PI*0.5;
        smokeRing.position.y = ball.mesh.position.y - ball.ballRadius +10;
        var toScale = 2-ball.snowmanIndex*0.5;
        TweenMax.to(smokeRing.scale,1,{x:toScale,y:toScale,z:toScale,ease:Sine.easeOut})
        TweenMax.to(smokeRing.material,1,{opacity:0, onComplete:transitionComplete, onCompleteParams:[smokeRing]});
        TweenMax.to(smokeRing.position,0.8,{delay:0,y:smokeRing.position.y-15, ease:Sine.easeIn});

        function transitionComplete( ring ){
          self.scene.remove(ring);
          ring = undefined;

          //last ring
          if( ball.snowmanIndex === 2) {
            if( self.usePostProcessing ) {
              self.postProcessingActivated = true;
              self._onResize();
            }
          }
        }
      }
      //TweenMax.to(ball.mesh.rotation,1*animationScale,{delay:0.4,y: "-0.5" });
    }

    //animate camera
    TweenMax.to(this.camera.position,2*animationScale,{ease:Sine.easeInOut,x:0,y:currentHeight+50,z:240,onUpdate:updateCamera,onComplete:cameraInPlace});
    var lookAtTarget = new THREE.Vector3(0,sortedBalls[1].finalY,0);
    var currentLookAt = this._balls[this._currentBallSelected].mesh.position.clone();

    TweenMax.to(currentLookAt,2*animationScale,{ease:Sine.easeInOut,x:lookAtTarget.x,y:lookAtTarget.y,z:lookAtTarget.z});


    function updateCamera(){
      //currentLookAt.lerp(lookAtTarget,0.1+ (1-animationScale));
      self.camera.lookAt(currentLookAt );
    }

    function cameraInPlace(){
      TweenMax.to(self.camera.position,1*animationScale,{ease:Sine.easeInOut,x:0,y:currentHeight+20,z:150, onComplete: self._initEditMode });
    }

  },

  _onSnowmanEditDone: function(){
    this._state = STATE_COMPLETE;

    _gaq.push(['_trackEvent','Snowman done']);

    var self = this;
    setTimeout(function(){
      self._tutorial.toStep(7);

      self.trailCanvas.showGreeting();
      self.trailTexture.needsUpdate = true;

    },2000)
  },

  _initEditMode: function(){
    var self = this;

    this._decorationEditor = new DecorationEditor(this.scene, this.camera);

    setTimeout( function(){
      self._state = STATE_EDIT_SNOWMAN;
    },2000)


    this._decorationEditor.activeBall( this._snowmanBalls[2] );

    this._decorationEditor.addCarrot();
    this._decorationEditor.on("attachedObject", onObjectAttached)
    this._tutorial.toStep(4);

    function onObjectAttached( type, targetBall ){
      if( type === 'carrot') {

        if( targetBall === self._snowmanBalls[0] || targetBall === self._snowmanBalls[1]) {
          self._tutorial.temporaryNote("Oh come on! We are celebrating the birth of Jesus for christ sake!",100);
        }
        else {
          self._tutorial.toStep(5);
        }
      }
      else if( type === 'branch2') {
        self._tutorial.toStep(6,true);
      }
    }

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

    if( this._state === STATE_EDIT_SNOWMAN && this._lookAtPosition ) {

      //this.camera.position.y += ((this._lookAtPosition.y + 10 + currentEditBall.ballRadius*2)- this.camera.position.y)*0.1;
      this.camera.position.y += ((this._lookAtPosition.y + this._snowmanBalls[2].mesh.position.y + this._snowmanBalls[2].ballRadius + this._normalizedMouse2D.y*-30)- this.camera.position.y)*0.1;
      //this.camera.position.z += ((currentEditBall.ballRadius*3 + 60 + this._normalizedMouse2D.y*10)- this.camera.position.z )*0.1;
      this.camera.lookAtTarget.lerp(this._lookAtPosition,0.1);
      this.camera.lookAt(this.camera.lookAtTarget);

    }
    else if( this._state === STATE_CREATING_BALLS ) {

      if( this._balls.length ) {
        var selectedBall = this._balls[this._currentBallSelected];

        if( this._mouseIsDown ) {
          selectedBall.steerWithMouse(this._normalizedMouse2D);

          if( this._cursor !== CURSOR_CLOSED_HAND ) {
            this._cursor = CURSOR_CLOSED_HAND;
            this._$stage.removeClass('cursor-openhand').removeClass('cursor-pointer').addClass('cursor-closedhand');
          }
        }
        else if( this._steerIsActive) {
          selectedBall.steerWithKeyboard(this._keyStatus);
        }

        this._sounds.setRollVolume(selectedBall.velocity.clone().lengthSq());

        this.camera.position.lerp(selectedBall.mesh.position.clone().add(this._cameraOffset),0.1);
        var ball;
        for (var i = this._balls.length - 1; i >= 0; i--) {
          ball = this._balls[i];
          ball.updateCollision( this._balls);
          ball.update();
        }
      }

      this.camera.position.x += Math.cos(time*0.1)*0.3;
      this.camera.position.y += Math.cos(time*0.02)*0.1;
      this.camera.position.z += Math.cos(time*0.05)*0.1;
    }
    else if( this._state === STATE_COMPLETE ) {
      var extraOffset = this._snowmanBalls[2].mesh.position.y

      this.camera.position.y += (100+extraOffset*2 - this.camera.position.y)*0.06;
      this.camera.position.z += (200+extraOffset - this.camera.position.z )*0.06;
      this.camera.lookAtTarget.lerp(this._greetingCameraCenter,0.1);
      this.camera.lookAt(this.camera.lookAtTarget);

      this.camera.position.x += Math.cos(time*0.1)*0.3;
      this.camera.position.y += Math.cos(time*0.02)*0.1;
      this.camera.position.z += Math.cos(time*0.05)*0.1;

    }

    if( this.usePostProcessing && this.postProcessingActivated ) {
      this.depthPassPlugin.enabled = true;
      this.ground.visible = true;

      this.renderer.render( this.scene, this.camera, this.composer.renderTarget2, true );

      this.depthPassPlugin.enabled = false;

      this.ground.visible = true;

      this.composer.render();
    } else {
      this.renderer.clear();
      this.renderer.render( this.scene, this.camera );
    }

    raf( this._draw );
  },

  _updateMousePicker: function(){
    var vector = new THREE.Vector3(this._normalizedMouse2D.x,this._normalizedMouse2D.y*-1,0.5);
    this.projector.unprojectVector( vector,this.camera);

    var raycaster = new THREE.Raycaster(this.camera.position,vector.sub(this.camera.position).normalize() );
    var intersects = raycaster.intersectObjects( this._collisionList );

    if ( intersects.length > 0 ) {
      var intersect = intersects[0];

      if( this._state === STATE_CREATING_BALLS ) {

        if( intersect.object === this.groundPicker ) {

          this._currentBallHover = -1;

          if( this._cursor !== CURSOR_POINTER && !this._mouseIsDown) {
            this._cursor = CURSOR_POINTER;
            this._$stage.removeClass('cursor-openhand').removeClass('cursor-closedhand').addClass('cursor-pointer');
          }

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
        else {

          if( this._cursor !== CURSOR_OPEN_HAND && !this._mouseIsDown) {
            this._cursor = CURSOR_OPEN_HAND;
            this._$stage.removeClass('cursor-pointer').removeClass('cursor-closedhand').addClass('cursor-openhand');
          }

          for (var i = this._balls.length - 1; i >= 0; i--) {
            if( this._balls[i].mesh === intersect.object ) {
              this._currentBallHover = i;
            }
          };
        }
      }
      else if( this._state === STATE_EDIT_SNOWMAN && intersect.object.id.length > 0 && intersect.object.id.indexOf("ball") !== -1  ) {
        if( this._decorationEditor ) {
          this._decorationEditor.activeBall( intersect.object.parentObject);
          this._decorationEditor.set3DCursor(intersect.point, intersect.face.normal);
          this._lookAtPosition = this._snowmanBalls[1].mesh.position.clone()//intersect.object.position.clone();
        }
      }
      else {
        if( this._decorationEditor ) {
          this._decorationEditor.hideObject();
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

    if( this.$fallback ) {

      var w = winW-40;
      var h = w/1280*720;

      if( h > winH ) {
        h = winH-40;
        w = h/720*1280;
      }

      if( w > winW ) {
        w = winW-40;
        h = w/1280*720;
      }


      this.$fallback.width(w);
      this.$fallback.height(h);

      return;
    }

    this.camera.aspect = winW / winH;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize( winW/this.sizeRatio, winH/this.sizeRatio);

    if( this.usePostProcessing ) {

      this.depthTarget = new THREE.WebGLRenderTarget(  winW/this.sizeRatio,  winH/this.sizeRatio, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat } );

      this.fxaa.uniforms[ 'resolution' ].value.set( 1 / winW, 1 / winH );
      this.ssao.uniforms[ 'size' ].value.set( winW, winH );

      this.depthPassPlugin.renderTarget = this.depthTarget;
      this.ssao.uniforms[ 'tDepth' ].value = this.depthTarget;

      this.composer.reset();

    }

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
