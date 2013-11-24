module.exports = Builder;

var raf = require('raf');
var mixin = require('mixin');
var debug = require('debug');
var detector = require('./utils/detector');

function Builder() {

  this.size = {};
  this._draw = this._draw.bind(this);
  this.sizeRatio = 1;
}

mixin(Builder.prototype, {

  init: function() {

    this._clock = new THREE.Clock();

    //physics
    Physijs.scripts.worker = '/vendors/physijs_worker.js';
    Physijs.scripts.ammo = '/vendors/ammo.js';

    this._init3D();
    this._initLights();
    this._createSceneObjects();
    //this._initUI();

    this._onResize();
    this._draw();

    console.log(this.scene);

    //this._cameraUpdated();
    //this._colorsUpdated();
    //this._lightsUpdated();
  },

  _init3D: function(){

    this.camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 0.5, 4000 );
    this.scene = new Physijs.Scene();

    this.camera.position.set(0,700,700);
    this.camera.lookAt( this.scene.position );
    //this.scene.overrideMaterial = new THREE.MeshBasicMaterial({wireframe:true,color:0x333333});

    this.scene.setGravity(new THREE.Vector3( 0, -60, 0 ));

    if( detector.isTouchDevice && detector.isMobile ) {
      this.sizeRatio = 2.5;
    }

    this.renderer = new THREE.WebGLRenderer({canvas: document.getElementById('builderCanvas'),antialias:false});
    this.renderer.sortElements = false;
    this.renderer.setClearColor(0x0000);

    this.renderer.gammaInput = true;
    this.renderer.gammaOutput = true;
    this.renderer.physicallyBasedShading = true;

    //this.scene.fog = new THREE.Fog( this.properties.fogColor, this.properties.fogNear, this.properties.fogFar );

    if (this.sizeRatio > 1) {
      this.renderer.domElement.style.webkitTransform = "scale3d("+this.sizeRatio+", "+this.sizeRatio+", 1)";
      this.renderer.domElement.style.webkitTransformOrigin = "0 0 0";
    }

  },

  _initLights: function(){

    this.ambientLight = new THREE.AmbientLight( 0x333333, 0.2 );
    this.scene.add(this.ambientLight);

    this.pointLight = new THREE.PointLight( 0xffffff, 0.8,1000);
    this.pointLight.position.set(0,1025,-1000);
    this.scene.add(this.pointLight);

    this.dirLight = new THREE.DirectionalLight( 0xffffff,0.8);
    this.dirLight.position.set( 0, 500, -100  );
    //this.dirLight.position.normalize();
    this.scene.add(this.dirLight);

  },


  _createSceneObjects: function(){
    var solidMaterial = Physijs.createMaterial(new THREE.MeshBasicMaterial({ color: 0x888888 }),
      1, // medium friction
      0 // low restitution
    );

    var collider = new Physijs.BoxMesh(
      new THREE.CubeGeometry( 1000,  1000,1 ),
      solidMaterial,
      0 //mass
    );
    collider.rotation.x = Math.PI*0.5;
    collider.position.set(0,0,0);
    collider.visible = true;

    this.floorCollider = collider;

    this.scene.add(collider);

    var snowBall = new THREE.Mesh( new THREE.SphereGeometry(100,10,10), new THREE.MeshBasicMaterial({wireframe:true,color:0xff0000}))
    this.scene.add(snowBall);
  },

  _draw: function(){
    var delta = this._clock.getDelta();
    var time = this._clock.getElapsedTime() * 10;

    if (isNaN(delta) || delta > 1000 || delta === 0 ) {
      delta = 1000/60;
    }
    this.delta = delta;

    //this.camera.rotation.y += 0.1;

    this.scene.simulate(); // run physics
    
    this.renderer.render( this.scene, this.camera );


    raf( this._draw );
  },

  _onResize: function() {

    var winW = window.innerWidth;
    var winH = window.innerHeight;
    /*
    this.size.width = winW;
    this.size.height = winH;
    this.size.sizeRatio = this.sizeRatio;*/

    this.camera.aspect = winW / winH;
    this.camera.updateProjectionMatrix();
    
    this.renderer.setSize( winW/this.sizeRatio, winH/this.sizeRatio);

    //this._$stage.css({width:winW +"px",height:visibleHeight+"px"});

  }
});
