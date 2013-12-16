varying vec3 mPosition;
varying vec3 mNormal;
varying vec3 vViewPosition;
varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec2 vUv;
uniform vec4 offsetRepeat;

#ifdef VERTEX_TEXTURES
    uniform sampler2D bumpMap;
    uniform float uDisplacementScale;
#endif

#ifdef USE_SHADOWMAP

    varying vec4 vShadowCoord[ MAX_SHADOWS ];
    uniform mat4 shadowMatrix[ MAX_SHADOWS ];

#endif

void main() {

    vUv = uv;
    vec4 mPosition = modelMatrix * vec4( position, 1.0 );
    vec4 mvPosition = viewMatrix * mPosition;
    vec4 worldPosition = vec4(1.0);

    vViewPosition = -mvPosition.xyz;

    vec3 transformedNormal = normalMatrix * normal;
    vNormal = transformedNormal;
    mNormal = normal;

    #ifdef VERTEX_TEXTURES
        vec3 dv = texture2D( bumpMap, vUv ).xyz;
        float df = uDisplacementScale * (1.0-dv.x);
        vec4 displacedPosition = mvPosition;
        displacedPosition.y -= df;
        clamp(displacedPosition.y,10.0,-20.0); 

        vWorldPosition = displacedPosition.xyz;

        gl_Position = projectionMatrix * displacedPosition;
    #else
        vWorldPosition = mvPosition.xyz;
        gl_Position = projectionMatrix * mvPosition;
    #endif

    #ifdef USE_SHADOWMAP
        for( int i = 0; i < MAX_SHADOWS; i ++ ) {
            vShadowCoord[ i ] = shadowMatrix[ i ] * mPosition;
        }
    #endif

}