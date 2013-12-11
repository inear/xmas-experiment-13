module.exports = Builder;

var DomEventMap = require('dom-event-map');
var raf = require('raf');
var mixin = require('mixin');
var debug = require('debug');
var settings = require('./settings');
var SettingsUI = require('./settings-ui');
var Trail = require('./trail');
var detector = require('./utils/detector');

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
  //bind scope
  this._draw = this._draw.bind(this);
  this._onMouseMove = this._onMouseMove.bind(this);
  this._onMouseDown = this._onMouseDown.bind(this);
  this._onMouseUp = this._onMouseUp.bind(this);

  this.sizeRatio = 1;

  this.trailCanvas = new Trail();


  this.settingsUI = new SettingsUI();
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
    //this._initUI();

    this._onResize();
    this._draw();

    this._addEventListeners();
    //this._cameraUpdated();
    //this._colorsUpdated();
    //this._lightsUpdated();
  },

  _addEventListeners: function(){
    this.mapListener(this._stage, 'mouseup', this._onMouseUp);
    this.mapListener(this._stage, 'mousedown', this._onMouseDown);
    this.mapListener(this._stage, 'mousemove', this._onMouseMove);
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
  },

  _onMouseUp: function( evt ){
    this._mouseIsDown = false;
  },

  _init3D: function(){

    this.camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 1, 6000 );
    this.scene = new THREE.Scene();

    this.camera.position.set(0,1700,1700);
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

    var geo = new THREE.IcosahedronGeometry(50,3);
    geo.isDynamic = true;
    var vertices = geo.vertices;
    var vertex;
    for (var i = vertices.length - 1; i >= 0; i--) {
      vertex = vertices[i];
      vertex.y += Math.random()*5-2.5;
      vertex.x += Math.random()*5-2.5;
      vertex.z += Math.random()*5-2.5;
    };

    this.snowBall = new THREE.Mesh( geo, new THREE.MeshPhongMaterial({ perPixel:true, color: 0xffffff, ambient:0xffffff }));
    this.snowBall.castShadow = true;
    this.snowBall.receiveShadow = false;
    this.snowBall.position.y = 75;

    this.scene.add(this.snowBall);

    this.trailTexture = new THREE.Texture(this.trailCanvas.el);
    //this.trailTexture.mapping = THREE.UVMapping;

    /*var reflectionMap = THREE.ImageUtils.loadTexture('assets/images/snow-reflection.jpg');
    reflectionMap.repeat.x = reflectionMap.repeat.y = 1
    reflectionMap.wrapT = reflectionMap.wrapS = THREE.RepeatWrapping;
    reflectionMap.needsUpdate = true;
*/
    var diffuseMap = THREE.ImageUtils.loadTexture('assets/images/snow-diffuse.jpg');
    diffuseMap.wrapT = diffuseMap.wrapS = THREE.RepeatWrapping;


    var groundGeo = new THREE.PlaneGeometry(this.groundSize.width,this.groundSize.height,150,150);

    var snowUniforms = {
      uDisplacementScale: { type: "f", value: 47.1 }
    };

    var finalSnowUniform = THREE.UniformsUtils.merge( [THREE.ShaderLib["phong"].uniforms, snowUniforms] );
    finalSnowUniform.map.value = diffuseMap;
    finalSnowUniform.shininess.value = 100;
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
    this.ground.castShadow = true;
    this.ground.rotation.x = - 90 * Math.PI / 180;
    this.ground.position.y = 0;

    var vertices = groundGeo.vertices;
    var vertex;
    for (var i = vertices.length - 1; i >= 0; i--) {
      vertex = vertices[i];
     /* vertex.y += Math.random()*15-7.5;
      vertex.x += Math.random()*15-7.5;
      vertex.z += Math.random()*15-7.5;*/
    };

   // groundGeo.computeFaceNormals();
   // groundGeo.computeVertexNormals();


    this.scene.add(this.ground);
  },

  _draw: function(){
    var delta = this._clock.getDelta();
    var time = this._clock.getElapsedTime() * 10;

    if (isNaN(delta) || delta > 1000 || delta === 0 ) {
      delta = 1000/60;
    }
    this.delta = delta;

    //this.camera.rotation.y += 0.1;

    var rotateAmountFactor = 0.05*(80-settings.ballRadius)/40;

    if( this._mouseIsDown ) {
      var rotateSpeedFactor = 70/100*(100-settings.ballRadius);
      this.momentumX += (this._normalizedMouse2D.x*2.5 - this.momentumX)/rotateSpeedFactor;
      this.momentumZ += (this._normalizedMouse2D.y*2.5 - this.momentumZ)/rotateSpeedFactor;
    }
    else {
      this.momentumX *= 0.9
      this.momentumZ *= 0.9
    }

    this.moveDir.set(-this.momentumX, 0, -this.momentumZ);

    var rotationDir = new THREE.Vector3().crossVectors(this.moveDir, this.up);
    var amount = Math.sqrt( this.momentumX*rotateAmountFactor * this.momentumX*rotateAmountFactor + this.momentumZ*rotateAmountFactor * this.momentumZ*rotateAmountFactor);

    this._rotateAroundWorldAxis( this.snowBall, rotationDir,amount)

    this.snowBall.position.x += this.momentumX;
    this.snowBall.position.z += this.momentumZ;


    if( this.snowBall.position.distanceTo(this._prevSnowBallPos ) > 0.3 ) {
      this.trailCanvas.setTrailRadius( (settings.ballRadius*0.75)/2000*1024);
      this.trailCanvas.update((this.snowBall.position.x/this.groundSize.width)*1024+512,(this.snowBall.position.z/this.groundSize.height)*1024 + 512)
      this.trailTexture.needsUpdate = true;
    }

    this._prevSnowBallPos.copy(this.snowBall.position);

    //this.snowBall.scale.set( settings.ballScale,settings.ballScale,settings.ballScale);

    var vertices = this.snowBall.geometry.vertices;
    var vertex;
    for (var i = vertices.length - 1; i >= 0; i--) {
      vertex = vertices[i];
      vertex.setLength(settings.ballRadius);
     /* vertex.y += Math.random()*15-7.5;
      vertex.x += Math.random()*15-7.5;
      vertex.z += Math.random()*15-7.5;*/
    };
    this.snowBall.geometry.verticesNeedUpdate = true;

    this.snowBall.position.y = settings.ballRadius*2 - 20-40*settings.ballRadius/40;
    //highlight faces

    this.camera.position.lerp(this.snowBall.position.clone().add( this._cameraOffset ),0.1);
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
  }
});
