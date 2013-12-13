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
var detector = require('./utils/detector');
var ObjectPool = require('./utils/object-pool');
var SnowChunk = require('./snow-chunk');

var SHADOW_MAP_WIDTH = 1024*2;
var SHADOW_MAP_HEIGHT = 1024*2;

function Builder() {

  this.groundSize = {width:2000,height:2000};

  this.size = {};
  this._mouse2D = new THREE.Vector2();
  this._normalizedMouse2D = new THREE.Vector2();
  this._prevSnowBallPos = new THREE.Vector3();
  this._cameraOffset = new THREE.Vector3(0,300,300);
  this._mouseMoved = false;
  this._steerIsActive = false;
  this._keyStatus = Object.call(this);
  //bind scope
  this._draw = this._draw.bind(this);
  this._onMouseMove = this._onMouseMove.bind(this);
  this._onMouseDown = this._onMouseDown.bind(this);
  this._onMouseUp = this._onMouseUp.bind(this);
  
  this.sizeRatio = 1;

  this._balls = [];
  this._currentBallSelected = 0;

  this.trailCanvas = new Trail();

  this._initSnowChunks();

  this.settingsUI = new SettingsUI();

 // this._spawnSnowChunk = this._spawnSnowChunk.bind(this);
}

DomEventMap(Builder.prototype);

mixin(Builder.prototype, {

  init: function() {

    this._stage = document.getElementById('stage');

    this._clock = new THREE.Clock();

    this.momentumX = 0;
    this.momentumZ = 0;

    this.up = new THREE.Vector3(0,1,0);
    this.moveDir = new THREE.Vector3();

    this._init3D();
    this._initLights();
    this._createSceneObjects();
    
    this._onResize();
    this._draw();

    this._addEventListeners();
    
  },

  _initSnowChunks: function(){

    this._snowChunks = [];

    ObjectPool.prototype.createObject = function(){
      var chunk = new SnowChunk();
      return chunk;
    }

    this._snowChunksPool = new ObjectPool();
  },

  _spawnSnowChunk: function(){

    /*var newChunk = this._snowChunksPool.getObject();
    newChunk.add(this.scene);
    newChunk.mesh.position.copy(this.snowBall.position ).sub(new THREE.Vector3(Math.random()*10,settings.ballRadius*0.5,0)).add(this.moveDir.negate().multiplyScalar(44));

    this._snowChunks.push(newChunk);*/
  },

  _addEventListeners: function(){
    
    var self = this;

    this.mapListener(this._stage, 'mouseup', this._onMouseUp);
    this.mapListener(this._stage, 'mousedown', this._onMouseDown);
    this.mapListener(this._stage, 'mousemove', this._onMouseMove);

    var list = ['left','right','up','down'];

    forEach(list,function(dir){

      Mousetrap.bind(dir, keyDown, 'keydown');
      Mousetrap.bind(dir, keyUp, 'keyup');   

      function keyDown() {
        self._keyStatus[dir] = true;
        self._steerIsActive = true;

        if( this._balls.length === 0 ) {
          this._createNewBall();
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

    this._mouseMoved = true;
  },

  _onMouseDown: function( evt ){
    this._mouseIsDown = true;

    if( this._balls.length === 0 ) {
      this._createNewBall();
    }
  },

  _onMouseUp: function( evt ){
    this._mouseIsDown = false;
  },

  _init3D: function(){

    this.camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 1, 6000 );
    this.scene = new THREE.Scene();

    this.camera.position.copy( this._cameraOffset );
    this.camera.lookAt( this.scene.position );
    //this.scene.overrideMaterial = new THREE.MeshBasicMaterial({wireframe:true,color:0x333333});

    if( detector.isTouchDevice && detector.isMobile ) {
      this.sizeRatio = 2.5;
    }

    this.renderer = new THREE.WebGLRenderer({canvas: document.getElementById('builderCanvas'),antialias:false});
    this.renderer.sortElements = false;
    this.renderer.setClearColor(0xffffff);

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

    //this.scene.fog = new THREE.Fog( this.properties.fogColor, this.properties.fogNear, this.properties.fogFar );

    if (this.sizeRatio > 1) {
      this.renderer.domElement.style.webkitTransform = "scale3d("+this.sizeRatio+", "+this.sizeRatio+", 1)";
      this.renderer.domElement.style.webkitTransformOrigin = "0 0 0";
    }

  },

  _initLights: function(){

    this.ambientLight = new THREE.AmbientLight( 0x666666, 0.1 );
    this.scene.add(this.ambientLight);

    //this.pointLight = new THREE.PointLight( 0xffffff, 0.8,1000);
    //this.pointLight.position.set(0,1025,-1000);
    //this.scene.add(this.pointLight);

    this.dirLight = new THREE.DirectionalLight( 0xffffff, 1);
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

    /*this.dirLight.shadowCascadeNearZ = [ -1.000, 0.9, 0.975 ];
    this.dirLight.shadowCascadeFarZ  = [  0.9, 0.975, 1.000 ];
    this.dirLight.shadowCascadeWidth = [ 2048, 2048, 2048 ];
    this.dirLight.shadowCascadeHeight = [ 2048, 2048, 2048 ];
    this.dirLight.shadowCascadeBias = [ 0.00005, 0.000065, 0.000065 ];

    this.dirLight.shadowCascadeOffset.set( 0, 0, -10 );
*/
    this.dirLight.castShadow = true;

    this.scene.add(this.dirLight);

  },


  _createSceneObjects: function(){

    this.snowBallGeo = new THREE.IcosahedronGeometry(settings.ballRadius,3);
    //geo = new THREE.SphereGeometry(settings.ballRadius,30,30)
    this.snowBallGeo.isDynamic = true;
    var vertices = this.snowBallGeo.vertices;
    var vertex;

    for (var i = vertices.length - 1; i >= 0; i--) {
      vertex = vertices[i];
      vertex.offset = new THREE.Vector3();
      vertex.offset.y = Math.random()*4-2;
      vertex.offset.x = Math.random()*4-2;
      vertex.offset.z = Math.random()*4-2;
    };

    var reflectionMap = THREE.ImageUtils.loadTexture('assets/images/snow-reflection2.jpg');
    reflectionMap.repeat.x = reflectionMap.repeat.y = 4
    reflectionMap.wrapT = reflectionMap.wrapS = THREE.RepeatWrapping;


    var ballMap = THREE.ImageUtils.loadTexture('assets/images/snow-diffuse-spherical.jpg');
    ballMap.magFilter = ballMap.minFilter = THREE.LinearFilter;

    var ballBumpMap = THREE.ImageUtils.loadTexture('assets/images/ball-bump-spherical.jpg');
    ballBumpMap.repeat.x = ballBumpMap.repeat.y = 1;
    ballBumpMap.magFilter = ballBumpMap.minFilter = THREE.LinearFilter;
    ballBumpMap.wrapT = ballBumpMap.wrapS = THREE.RepeatWrapping;

    this.snowballMaterial = new THREE.MeshPhongMaterial({ map:ballMap,perPixel:true, color: 0xffffff, ambient:0xffffff, bumpMap: ballBumpMap, bumpScale:3, specularMap: reflectionMap, specular:0xffffff,shininess:5 });


    this.trailTexture = new THREE.Texture(this.trailCanvas.el);

    this.trailCanvas.setTrailRadius(0)
    this.trailCanvas.update(512,512);
    this.trailTexture.needsUpdate = true;
    //this.trailTexture.mapping = THREE.UVMapping;

    /*
*/
    var diffuseMap = THREE.ImageUtils.loadTexture('assets/images/snow-diffuse2.jpg');
    diffuseMap.wrapT = diffuseMap.wrapS = THREE.RepeatWrapping;


    var groundGeo = new THREE.PlaneGeometry(this.groundSize.width,this.groundSize.height,150,150);

    var snowUniforms = {
      uDisplacementScale: { type: "f", value: 67.1 }
    };

    var finalSnowUniform = THREE.UniformsUtils.merge( [THREE.ShaderLib["phong"].uniforms, snowUniforms] );
    finalSnowUniform.map.value = diffuseMap;
    finalSnowUniform.shininess.value = 10;
    finalSnowUniform.bumpMap.value = this.trailTexture;
    finalSnowUniform.bumpScale.value = 3;

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

    this.ground = new THREE.Mesh( groundGeo, snowMaterial)
    this.ground.receiveShadow = true;
    this.ground.castShadow = false;
    this.ground.rotation.x = - 90 * Math.PI / 180;
    this.ground.position.y = 0;

    var vertices = groundGeo.vertices;
    var vertex;
    /*for (var i = vertices.length - 1; i >= 0; i--) {
      vertex = vertices[i];
      vertex.offset = new THREE.Vector3();
      vertex.offset.y += Math.random()*15-7.5;
      vertex.offset.x += Math.random()*15-7.5;
      vertex.offset.z += Math.random()*15-7.5;
    };
*/
   // groundGeo.computeFaceNormals();
   // groundGeo.computeVertexNormals();


    this.scene.add(this.ground);
  },

  _createNewBall: function(){
    
    var snowBall = new THREE.Mesh( this.snowBallGeo, this.snowballMaterial);
    snowBall.castShadow = true;
    snowBall.receiveShadow = false;
    snowBall.position.y = 75;

    this.scene.add(snowBall);

    this._balls.push(snowBall);
    this._currentBallSelected = this._balls.length-1;

    TweenMax.to( settings,0.7,{ballRadius:20});

  },

  _updateBall: function( index ){

    var snowBall = this._balls[index];

    var rotateAmountFactor = 0.05*(80-settings.ballRadius)/40;

    if( this._mouseIsDown ) {
      var rotateSpeedFactor = 70/100*(100-settings.ballRadius);
      this.momentumX += (this._normalizedMouse2D.x*2.5 - this.momentumX)/rotateSpeedFactor;
      this.momentumZ += (this._normalizedMouse2D.y*2.5 - this.momentumZ)/rotateSpeedFactor;
    }
    else if( this._steerIsActive ) {

      if( this._keyStatus['left'] ) {
        this.momentumX -= 0.1;
      }
      
      if( this._keyStatus['right'] ) {
        this.momentumX += 0.1;
      }
      
      if( this._keyStatus['up'] ) {
        this.momentumZ -= 0.1;
      }
      
      if( this._keyStatus['down'] ) {
        this.momentumZ += 0.1;
      }
      
      this.momentumZ = Math.max(-2,Math.min(2,this.momentumZ));
      this.momentumX = Math.max(-2,Math.min(2,this.momentumX));
      
    }
    else {
      this.momentumX *= 0.9
      this.momentumZ *= 0.9
    }

    this.moveDir.set(-this.momentumX, 0, -this.momentumZ);

    var rotationDir = new THREE.Vector3().crossVectors(this.moveDir, this.up);
    var amount = Math.sqrt( this.momentumX*rotateAmountFactor * this.momentumX*rotateAmountFactor + this.momentumZ*rotateAmountFactor * this.momentumZ*rotateAmountFactor);

    this._rotateAroundWorldAxis( snowBall, rotationDir,amount)

    
    snowBall.position.x += this.momentumX;
    snowBall.position.z += this.momentumZ;


    if( snowBall.position.distanceTo(this._prevSnowBallPos ) > 0.3 ) {

      //this._spawnSnowChunk();

      if( settings.ballRadius < 65 ) {
        settings.ballRadius += 0.01;
      }
      this.trailCanvas.setTrailRadius( (settings.ballRadius*0.75)/2000*1024);
      this.trailCanvas.update((snowBall.position.x/this.groundSize.width)*1024+512,(snowBall.position.z/this.groundSize.height)*1024 + 512)
      this.trailTexture.needsUpdate = true;
    }

    this._prevSnowBallPos.copy(snowBall.position);

    //snowBall.scale.set( settings.ballScale,settings.ballScale,settings.ballScale);
    
    var vertices = snowBall.geometry.vertices;
    var vertex, worldVector;
    for (var i = vertices.length - 1; i >= 0; i--) {
      vertex = vertices[i];

      worldVector = snowBall.localToWorld( vertex.clone() );

      //if( this.up.negate().dot( snowBall.position.clone().sub(worldVector).normalize()) < 0.2 ) {
      //if( (worldVector.y < snowBall.position.y - settings.ballRadius + 10) || (vertex.length() < settings.ballRadius-3) ) {

        vertex.hasUpdated = true;
        //vertex.setLength(settings.ballRadius + Math.random()*2.3);
        vertex.setLength(settings.ballRadius+vertex.offset.y*settings.ballRadius/60);
        
      /*}
      else if( vertex.hasUpdated && worldVector.y > 5 ) {
        vertex.hasUpdated = false;
      }*/
     /* vertex.y += Math.random()*15-7.5;
      vertex.x += Math.random()*15-7.5;
      vertex.z += Math.random()*15-7.5;*/
    };
    snowBall.geometry.verticesNeedUpdate = true;
    //snowBall.geometry.computeFaceNormals();
    //snowBall.geometry.computeVertexNormals();

    snowBall.position.y = settings.ballRadius*2 - 20-40*settings.ballRadius/40;
    //highlight faces

    this.snowballMaterial.bumpScale = 5*settings.ballRadius/40;

    this.camera.position.lerp(snowBall.position.clone().add( this._cameraOffset ),0.1);
  },

  _draw: function(){
    var delta = this._clock.getDelta();
    var time = this._clock.getElapsedTime() * 10;
    
    
    if (isNaN(delta) || delta > 1000 || delta === 0 ) {
      delta = 1000/60;
    }
    this.delta = delta;

    //this.camera.rotation.y += 0.1;

    if( this._balls.length  ) {
      this._updateBall( this._currentBallSelected );
    }

    //this.camera.lookAt(this.scene.position)
    this.renderer.render( this.scene, this.camera );


    raf( this._draw );
  },

  _rotateAroundWorldAxis: function(object, axis, radians) {
    var rotWorldMatrix = new THREE.Matrix4();
    var euler = new THREE.Euler();
    rotWorldMatrix.makeRotationAxis(axis.normalize(), radians);
    rotWorldMatrix.multiply(object.matrix);
    object.matrix = rotWorldMatrix;

    object.rotation = euler.setFromRotationMatrix(object.matrix);
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
