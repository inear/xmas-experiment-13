'use strict';

module.exports = SnowChunk;

function SnowChunk(){
  this.animating = false;
}

SnowChunk.prototype = {

  createMesh: function(){

    var geo = new THREE.SphereGeometry(10,4,4);
    this.mesh = new THREE.Mesh(geo, new THREE.MeshPhongMaterial({color:0xeeeeee}) );

  },

  add: function( parent ){

    var self = this;

    if( !this.mesh ) {
      this.createMesh();
    }
    parent.add(this.mesh);
    
    self.animating = true;

    TweenMax.set(this.mesh.position,{x:0,y:0,z:0});
    TweenMax.set(this.mesh.scale,{x:0.01,y:0.01,z:0.01});

    TweenMax.to(this.mesh.scale,1,{x:1,y:1,z:1, onComplete:function(){
      TweenMax.to(this.mesh.scale,5,{x:0.5,y:0.5,z:0.5});  
    }})

    TweenMax.to(this.mesh.position,5,{y:"-70", onComplete:function(){
      self.animating = false;
      self.idle = true;
      self.remove();
    }});

    return this;
  },

  update: function( power ){


  },

  reset: function(){

  },

  remove: function(){

    if( this.mesh.parent ) {
      this.mesh.parent.remove(this.mesh);
    }
  },

  dispose: function(){
    this.remove();
  }


};