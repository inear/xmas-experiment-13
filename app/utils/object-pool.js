'use strict';

module.exports = ObjectPool;

function ObjectPool() {

  this.pool = [];
  this.avail = [];
}

/**
 * Should be overridden, creates a new object and returns it
 */
ObjectPool.prototype.createObject = function() {
  return new Object();
}

/**
 * Grabs a new object from the pool
 */
ObjectPool.prototype.getObject = function() {
  // see if we have any objects in the avail array
  if (this.avail.length === 0) {
    var o = this.createObject();
    o.poolId = this.pool.length;
    this.pool.push(o);
    this.avail.push(o.poolId);

  }

  var poolId = this.avail.pop();

  return this.pool[poolId];
}

/**
 * returns an object to the pool
 */
ObjectPool.prototype.returnObject = function(poolId) {
  this.avail.push(poolId);
}

/**
 * returns an object to the pool
 */
ObjectPool.prototype.dispose = function() {

  for (var i = this.pool.length - 1; i >= 0; i--) {
    if( this.pool[i].dispose ) {
      this.pool[i].dispose();
    }
  }

  this.pool.length = 0;
  this.avail.length = 0;
}
