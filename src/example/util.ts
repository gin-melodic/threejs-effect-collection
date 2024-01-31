import * as THREE from 'three'

export const Utils = {
  nextPowerOf2: (n: number) => {
    return Math.pow( 2, Math.ceil( Math.log( n ) / Math.log( 2 ) ) );
  },
  lerp: (value1: number, value2: number, amount: number) => {
    const amountNor = Math.max( Math.min( amount, 1 ), 0 );
    return value1 + ( value2 - value1 ) * amountNor;
  },
  fillTexture: (texture: THREE.DataTexture, randVal: () => number = () => Math.random()) => {
    const theArray = texture.image.data;
    for ( let k = 0, kl = theArray.length; k < kl; k += 4 ) {
      theArray[ k + 0 ] = randVal();
      theArray[ k + 1 ] = randVal();
      theArray[ k + 2 ] = randVal();
      theArray[ k + 3 ] = 1;
    }
  },
}
