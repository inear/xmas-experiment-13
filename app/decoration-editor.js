module.exports = DecorationEditor;

var Emitter = require('emitter');

var StonePool = require('./utils/object-pool');

function DecorationEditor( scene, camera ) {
  this.scene = scene;
  this.camera = camera;
  this._attachedStones = [];
  this._target = null;
  this._currentBall = null;
  this._projector = new THREE.Projector();

  this._carrot = new THREE.Mesh( new THREE.CylinderGeometry(3,0.2,20,7,4),new THREE.MeshPhongMaterial({color:0xc45840, ambient:0x333333}) );
  this._carrot.geometry.applyMatrix( new THREE.Matrix4().makeRotationX( - Math.PI / 2 ));
  this._carrot.geometry.applyMatrix( new THREE.Matrix4().makeRotationZ( - Math.PI));

  var vertices = this._carrot.geometry.vertices;
    var vertex;
    for (var i = vertices.length - 1; i >= 0; i--) {
      vertex = vertices[i];
      //vertex.y += Math.random()*0.3-0.15;
      vertex.x += (Math.random()*0.3-0.15)*(20-vertex.z)/20;
      //vertex.z += Math.random()*0.3-0.15;
    }

  this._stonePool = new StonePool();
  this._stonePool.createObject = function(){

    var stoneGeo = new THREE.OctahedronGeometry(5,1);

    var mesh = new THREE.Mesh( stoneGeo, new THREE.MeshLambertMaterial({shading:THREE.SmoothShading, color:0x333333, ambient:0x333333}) );
    mesh.castShadows = true;
    mesh.scale.set(
      Math.random()*0.2+0.2,
      Math.random()*0.2+0.2,
      Math.random()*0.2+0.2
    )
    return mesh;
  }
}

var p = DecorationEditor.prototype;
Emitter(p);

p.getCurrentBall = function(){
  return this._currentBall;
}

p.addCarrot = function( ball ){
  this._currentObject = this._carrot;
  this._target.add(this._currentObject);
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
    this._currentObject.position = this._target.worldToLocal(position.clone());
    this._currentObject.lookAt( this._currentObject.position.clone().multiplyScalar(10) );
    //this._currentObject.position.copy(position.sub( this._target.position));//.multiplyScalar(1.2);
  }
}

p.addStone = function() {
  this._currentObject = this._stonePool.getObject();
  this._target.add(this._currentObject);
}

p.attachObject = function(){
  this._currentObject.isAttached = true;
  this._attachedStones.push(this._currentObject);

  this.addStone();
}