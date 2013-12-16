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

  this._stonePool = new StonePool();
  this._stonePool.createObject = function(){

    var stoneGeo = new THREE.OctahedronGeometry(2,1);
    
    var vertices = stoneGeo.vertices;
    var vertex;

    for (var i = vertices.length - 1; i >= 0; i--) {
      vertex = vertices[i];
      vertex.offset = new THREE.Vector3();
      vertex.offset.y = Math.random()*4-2;
      vertex.offset.x = Math.random()*4-2;
      vertex.offset.z = Math.random()*4-12;
    }

    var mesh = new THREE.Mesh( stoneGeo, new THREE.MeshLambertMaterial({shading:THREE.FlatShading, color:0x333333, ambient:0x333333}) );
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
    this._currentObject.position = this._target.worldToLocal(position.clone());

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