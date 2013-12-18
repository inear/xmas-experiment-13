module.exports = DecorationEditor;

var Emitter = require('emitter');

var StonePool = require('./utils/object-pool');
var carrotGeometries = require('./geometries/package.js');
var loader = new THREE.JSONLoader( true );

function DecorationEditor( scene, camera ) {
  this.scene = scene;
  this.camera = camera;
  this.currentType = "";
  this._attachedStones = [];
  this._target = null;
  this._currentBall = null;
  this._projector = new THREE.Projector();

  //this._carrot = new THREE.Mesh( new THREE.CylinderGeometry(3,0.2,20,7,4),new THREE.MeshPhongMaterial({color:0xc45840, ambient:0x333333, side:THREE.DoubleSide}) );
  var carrotGeo = loader.parse( JSON.parse(carrotGeometries.carrot_01) ).geometry
  var carrotMap = THREE.ImageUtils.loadTexture('assets/images/carrot-small.jpg');
  carrotMap.wrapT = carrotMap.wrapS = THREE.RepeatWrapping;
  this._carrot = new THREE.Mesh( carrotGeo,new THREE.MeshPhongMaterial({ map: carrotMap}) );
  this._carrot.scale.set(0.1,0.1,0.1);

  var branch1Geo = loader.parse( JSON.parse(carrotGeometries.branch_01) ).geometry;
  branch1Geo.applyMatrix( new THREE.Matrix4().makeRotationZ(Math.PI*-0.5));
  branch1Geo.applyMatrix( new THREE.Matrix4().makeRotationY(Math.PI*-0.5));

  var branchMap = THREE.ImageUtils.loadTexture('assets/images/branches_01.jpg');
  var branchMat = new THREE.MeshLambertMaterial({ map: branchMap, ambient:0x333333});
  branchMap.wrapT = branchMap.wrapS = THREE.RepeatWrapping;
  this._branch1 = new THREE.Mesh( branch1Geo,branchMat );
  this._branch1.scale.set(0.8,0.8,0.8);
  this._branch1.castShadows = true;

  var branch2Geo = loader.parse( JSON.parse(carrotGeometries.branch_02) ).geometry;
  branch2Geo.applyMatrix( new THREE.Matrix4().makeRotationZ(Math.PI*-0.5));
  branch2Geo.applyMatrix( new THREE.Matrix4().makeRotationY(Math.PI*-0.5));

  this._branch2 = new THREE.Mesh( branch2Geo,branchMat);
  this._branch2.scale.set(0.8,0.8,0.8);
  this._branch2.castShadows = true;

  this._stonePool = new StonePool();

  var stoneMat = new THREE.MeshLambertMaterial({shading:THREE.SmoothShading, color:0x444444, ambient:0x333333});
  var stoneGeo = new THREE.OctahedronGeometry(5,1);

  this._stonePool.createObject = function(){

    var mesh = new THREE.Mesh( stoneGeo, stoneMat );

    var s = Math.random()*0.1;
    mesh.scale.set(
      s+0.2,
      s+0.2,
      s+0.2
    )

    mesh.id = 'stone';

    return mesh;
  }
}

var p = DecorationEditor.prototype;
Emitter(p);

p.getCurrentBall = function(){
  return this._currentBall;
}


p.activeBall = function( ball ){

  this._currentBall = ball;
  this._target = ball.mesh;

  if( this._currentObject ) {

    if( this._currentObject.parent !== this._target ) {
      this._currentObject.parent.remove(this._currentObject);
    }

    if( ball ) {
      this._target.add(this._currentObject);
    }
    else {
      this._currentBall = null;
      this._target = null;
    }
  }

}

p.set3DCursor = function( position , normal ) {
  if( this._currentObject ){
    this._currentObject.visible = true;
    this._currentObject.position = this._target.worldToLocal(position.clone());
    this._currentObject.lookAt( this._currentObject.position.clone().multiplyScalar(10) );
    //this._currentObject.position.copy(position.sub( this._target.position));//.multiplyScalar(1.2);
  }
}


p.addCarrot = function( ball ){
  this.currentType = "carrot";
  this._currentObject = this._carrot;
  this._target.add(this._currentObject);
  var scale = 0.1*this._currentBall.ballRadius/30*2;
  this._currentObject.scale.set(scale,scale,scale)
}


p.addBranch1 = function( ball ){
  this.currentType = "branch1";
  this._currentObject = this._branch1;
  this._target.add(this._currentObject);
}

p.addBranch2 = function( ball ){
  this.currentType = "branch2";
  this._currentObject = this._branch2;
  this._target.add(this._currentObject);
}

p.addStone = function() {
  this.currentType = "stone";
  this._currentObject = this._stonePool.getObject();
  this._target.add(this._currentObject);
}

p.attachObject = function(){
  this._currentObject.isAttached = true;
  this._attachedStones.push(this._currentObject);

  this.emit("attachedObject", this.currentType, this._currentBall);

  if( this.currentType === "carrot") {
    this.addBranch1();
  }
  else if( this.currentType === "branch1") {
    this.addBranch2();
  }
  else {
    this.addStone();
  }
}

p.hideObject = function(){
  if( this._currentObject ){
    this._currentObject.visible = false;
  }
}