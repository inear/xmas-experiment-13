vec4 permute( vec4 x ) {

    return mod( ( ( x * 34.0 ) + 1.0 ) * x, 289.0 );
}

vec4 taylorInvSqrt( vec4 r ) {

    return 1.79284291400159 - 0.85373472095314 * r;

}

uniform vec3 ambientLightColor;

#if MAX_DIR_LIGHTS > 0

    uniform vec3 directionalLightColor[ MAX_DIR_LIGHTS ];
    uniform vec3 directionalLightDirection[ MAX_DIR_LIGHTS ];

#endif


#ifdef USE_SHADOWMAP

    uniform sampler2D shadowMap[ MAX_SHADOWS ];
    uniform vec2 shadowMapSize[ MAX_SHADOWS ];

    uniform float shadowDarkness[ MAX_SHADOWS ];
    uniform float shadowBias[ MAX_SHADOWS ];

    varying vec4 vShadowCoord[ MAX_SHADOWS ];

    float unpackDepth( const in vec4 rgba_depth ) {

        const vec4 bit_shift = vec4( 1.0 / ( 256.0 * 256.0 * 256.0 ), 1.0 / ( 256.0 * 256.0 ), 1.0 / 256.0, 1.0 );
        float depth = dot( rgba_depth, bit_shift );
        return depth;

    }
#endif

varying vec3 mPosition;
varying vec3 vWorldPosition;
varying vec3 vViewPosition;
varying vec3 vNormal;
varying vec3 mNormal;
varying vec2 vUv;

uniform float time;
uniform float shininess;
uniform vec3 specular;
uniform vec3 diffuse;
uniform vec3 ambient;

uniform sampler2D map;
uniform sampler2D bumpMap;

uniform vec3 fogColor;
uniform float fogNear;
uniform float fogFar;


uniform bool useRefract;
uniform float refractionRatio;
uniform float bumpScale;

// Derivative maps - bump mapping unparametrized surfaces by Morten Mikkelsen
//  http://mmikkelsen3d.blogspot.sk/2011/07/derivative-maps.html

// Evaluate the derivative of the height w.r.t. screen-space using forward differencing (listing 2)

vec2 dHdxy_fwd() {

    vec2 dSTdx = dFdx( vUv );
    vec2 dSTdy = dFdy( vUv );

    float Hll = bumpScale * texture2D( bumpMap, vUv ).x;
    float dBx = bumpScale * texture2D( bumpMap, vUv + dSTdx ).x - Hll;
    float dBy = bumpScale * texture2D( bumpMap, vUv + dSTdy ).x - Hll;

    return vec2( dBx, dBy );
}

vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy ) {

    vec3 vSigmaX = dFdx( surf_pos );
    vec3 vSigmaY = dFdy( surf_pos );
    vec3 vN = surf_norm;     // normalized

    vec3 R1 = cross( vSigmaY, vN );
    vec3 R2 = cross( vN, vSigmaX );

    float fDet = dot( vSigmaX, R1 );

    vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
    return normalize( abs( fDet ) * surf_norm - vGrad );
}


void main()
{

    vec3 normal = normalize( vNormal );

    normal = normal;

    //bump
    normal = perturbNormalArb( -vViewPosition, normal, dHdxy_fwd() );

    vec3 viewPosition = normalize( vViewPosition );

    #if MAX_DIR_LIGHTS > 0

        vec3 dirDiffuse  = vec3( 0.0 );
        vec3 dirSpecular = vec3( 0.0 );

        for( int i = 0; i < MAX_DIR_LIGHTS; i ++ ) {

            vec4 lDirection = viewMatrix * vec4( directionalLightDirection[ i ], 0.0 );

            vec3 dirVector = normalize( lDirection.xyz );
            float dirDiffuseWeight = max( dot( normal, dirVector ), 0.0 );

            dirDiffuse  += diffuse * directionalLightColor[ i ] * dirDiffuseWeight;

            // specular
            vec3 dirHalfVector = normalize( dirVector + viewPosition );
            float dirDotNormalHalf = max( dot( normal, dirHalfVector ), 0.0 );
            float dirSpecularWeight = max( pow( dirDotNormalHalf, shininess ), 0.0 );

            dirSpecular += specular * directionalLightColor[ i ] * dirSpecularWeight * dirDiffuseWeight;


        }

    #endif

    vec3 totalDiffuse = vec3( 0.0 );
    vec3 totalSpecular = vec3( 0.0 );

    #if MAX_DIR_LIGHTS > 0
        totalDiffuse += dirDiffuse;
        totalSpecular += dirSpecular;
    #endif

    //vec3 colorBase = mix(vec3(0.94,0.94,1.0),vec3(0.64,0.64,0.6),1.0-texture2D( bumpMap, vUv ).x);
    vec3 colorBase = mix(vec3(1.0,1.0,1.0),vec3(0.74,0.74,0.7),1.0-texture2D( bumpMap, vUv ).x);
    //vec3 colorBase = vec3(1.0,1.0,1.0);


    vec3 DiffuseColour = totalDiffuse*texture2D( map, vUv*3.0 ).xyz*colorBase;
    gl_FragColor = vec4(( totalDiffuse * DiffuseColour) + totalSpecular + ambientLightColor * ambient,1.0);

    float f = 1.0 * abs( dot( normal, normalize( vWorldPosition ) ) );
    f = 0.1 * ( 1. - smoothstep( 0.0, 1., f ) );

    gl_FragColor.rgb += vec3(f);

    #ifdef USE_SHADOWMAP

        #ifdef SHADOWMAP_DEBUG

            vec3 frustumColors[3];
            frustumColors[0] = vec3( 1.0, 0.5, 0.0 );
            frustumColors[1] = vec3( 0.0, 1.0, 0.8 );
            frustumColors[2] = vec3( 0.0, 0.5, 1.0 );

        #endif

        #ifdef SHADOWMAP_CASCADE

            int inFrustumCount = 0;

        #endif

        float fDepth;
        vec3 shadowColor = vec3( 1.0 );

        for( int i = 0; i < MAX_SHADOWS; i ++ ) {

            vec3 shadowCoord = vShadowCoord[ i ].xyz / vShadowCoord[ i ].w;

        //  if ( something && something )           breaks ATI OpenGL shader compiler
        //  if ( all( something, something ) )     using this instead

            bvec4 inFrustumVec = bvec4 ( shadowCoord.x >= 0.0, shadowCoord.x <= 1.0, shadowCoord.y >= 0.0, shadowCoord.y <= 1.0 );
            bool inFrustum = all( inFrustumVec );

        // don't shadow pixels outside of light frustum
        // use just first frustum (for cascades)
        // don't shadow pixels behind far plane of light frustum

            #ifdef SHADOWMAP_CASCADE

                inFrustumCount += int( inFrustum );
                bvec3 frustumTestVec = bvec3( inFrustum, inFrustumCount == 1, shadowCoord.z <= 1.0 );

            #else

                bvec2 frustumTestVec = bvec2( inFrustum, shadowCoord.z <= 1.0 );

            #endif

            bool frustumTest = all( frustumTestVec );

            if ( frustumTest ) {

                shadowCoord.z += shadowBias[ i ];

                #if defined( SHADOWMAP_TYPE_PCF )

                // Percentage-close filtering
                // (9 pixel kernel)
                // http://fabiensanglard.net/shadowmappingPCF/

                    float shadow = 0.0;

                /*
                // nested loops breaks shader compiler / validator on some ATI cards when using OpenGL
                // must enroll loop manually

                    for ( float y = -1.25; y <= 1.25; y += 1.25 )
                        for ( float x = -1.25; x <= 1.25; x += 1.25 ) {

                            vec4 rgbaDepth = texture2D( shadowMap[ i ], vec2( x * xPixelOffset, y * yPixelOffset ) + shadowCoord.xy );

                        // doesn't seem to produce any noticeable visual difference compared to simple  texture2D     lookup
                        //  vec4 rgbaDepth = texture2DProj( shadowMap[ i ], vec4( vShadowCoord[ i ].w * ( vec2( x * xPixelOffset, y * yPixelOffset ) + shadowCoord.xy ), 0.05, vShadowCoord[ i ].w ) );

                            float fDepth = unpackDepth( rgbaDepth );

                            if ( fDepth < shadowCoord.z )
                                shadow += 1.0;

                    }

                    shadow /= 9.0;

                */

                    const float shadowDelta = 1.0 / 9.0;

                    float xPixelOffset = 1.0 / shadowMapSize[ i ].x;
                    float yPixelOffset = 1.0 / shadowMapSize[ i ].y;

                    float dx0 = -1.25 * xPixelOffset;
                    float dy0 = -1.25 * yPixelOffset;
                    float dx1 = 1.25 * xPixelOffset;
                    float dy1 = 1.25 * yPixelOffset;

                    fDepth = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy + vec2( dx0, dy0 ) ) );
                    if ( fDepth < shadowCoord.z ) shadow += shadowDelta;

                    fDepth = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy + vec2( 0.0, dy0 ) ) );
                    if ( fDepth < shadowCoord.z ) shadow += shadowDelta;

                    fDepth = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy + vec2( dx1, dy0 ) ) );
                    if ( fDepth < shadowCoord.z ) shadow += shadowDelta;

                    fDepth = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy + vec2( dx0, 0.0 ) ) );
                    if ( fDepth < shadowCoord.z ) shadow += shadowDelta;

                    fDepth = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy ) );
                    if ( fDepth < shadowCoord.z ) shadow += shadowDelta;

                    fDepth = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy + vec2( dx1, 0.0 ) ) );
                    if ( fDepth < shadowCoord.z ) shadow += shadowDelta;

                    fDepth = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy + vec2( dx0, dy1 ) ) );
                    if ( fDepth < shadowCoord.z ) shadow += shadowDelta;

                    fDepth = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy + vec2( 0.0, dy1 ) ) );
                    if ( fDepth < shadowCoord.z ) shadow += shadowDelta;

                    fDepth = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy + vec2( dx1, dy1 ) ) );
                    if ( fDepth < shadowCoord.z ) shadow += shadowDelta;

                    shadowColor = shadowColor * vec3( ( 1.0 - shadowDarkness[ i ] * shadow ) );

                #elif defined( SHADOWMAP_TYPE_PCF_SOFT )

                // Percentage-close filtering
                // (9 pixel kernel)
                // http://fabiensanglard.net/shadowmappingPCF/

                    float shadow = 0.0;

                    float xPixelOffset = 1.0 / shadowMapSize[ i ].x;
                    float yPixelOffset = 1.0 / shadowMapSize[ i ].y;

                    float dx0 = -1.0 * xPixelOffset;
                    float dy0 = -1.0 * yPixelOffset;
                    float dx1 = 1.0 * xPixelOffset;
                    float dy1 = 1.0 * yPixelOffset;

                    mat3 shadowKernel;
                    mat3 depthKernel;

                    depthKernel[0][0] = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy + vec2( dx0, dy0 ) ) );
                    depthKernel[0][1] = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy + vec2( dx0, 0.0 ) ) );
                    depthKernel[0][2] = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy + vec2( dx0, dy1 ) ) );
                    depthKernel[1][0] = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy + vec2( 0.0, dy0 ) ) );
                    depthKernel[1][1] = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy ) );
                    depthKernel[1][2] = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy + vec2( 0.0, dy1 ) ) );
                    depthKernel[2][0] = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy + vec2( dx1, dy0 ) ) );
                    depthKernel[2][1] = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy + vec2( dx1, 0.0 ) ) );
                    depthKernel[2][2] = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy + vec2( dx1, dy1 ) ) );

                    vec3 shadowZ = vec3( shadowCoord.z );
                    shadowKernel[0] = vec3(lessThan(depthKernel[0], shadowZ ));
                    shadowKernel[0] *= vec3(0.25);

                    shadowKernel[1] = vec3(lessThan(depthKernel[1], shadowZ ));
                    shadowKernel[1] *= vec3(0.25);

                    shadowKernel[2] = vec3(lessThan(depthKernel[2], shadowZ ));
                    shadowKernel[2] *= vec3(0.25);

                    vec2 fractionalCoord = 1.0 - fract( shadowCoord.xy * shadowMapSize[i].xy );

                    shadowKernel[0] = mix( shadowKernel[1], shadowKernel[0], fractionalCoord.x );
                    shadowKernel[1] = mix( shadowKernel[2], shadowKernel[1], fractionalCoord.x );

                    vec4 shadowValues;
                    shadowValues.x = mix( shadowKernel[0][1], shadowKernel[0][0], fractionalCoord.y );
                    shadowValues.y = mix( shadowKernel[0][2], shadowKernel[0][1], fractionalCoord.y );
                    shadowValues.z = mix( shadowKernel[1][1], shadowKernel[1][0], fractionalCoord.y );
                    shadowValues.w = mix( shadowKernel[1][2], shadowKernel[1][1], fractionalCoord.y );

                    shadow = dot( shadowValues, vec4( 1.0 ) );

                    shadowColor = shadowColor * vec3( ( 1.0 - shadowDarkness[ i ] * shadow ) );

                #else

                    vec4 rgbaDepth = texture2D( shadowMap[ i ], shadowCoord.xy );
                    float fDepth = unpackDepth( rgbaDepth );

                    if ( fDepth < shadowCoord.z )

                    // spot with multiple shadows is darker

                        shadowColor = shadowColor * vec3( 1.0 - shadowDarkness[ i ] );

                    // spot with multiple shadows has the same color as single shadow spot

                    //  shadowColor = min( shadowColor, vec3( shadowDarkness[ i ] ) );

                #endif

            }


            #ifdef SHADOWMAP_DEBUG

                #ifdef SHADOWMAP_CASCADE

                    if ( inFrustum && inFrustumCount == 1 ) gl_FragColor.xyz *= frustumColors[ i ];

                #else

                    if ( inFrustum ) gl_FragColor.xyz *= frustumColors[ i ];

                #endif

            #endif

        }

        #ifdef GAMMA_OUTPUT

            shadowColor *= shadowColor;

        #endif

        gl_FragColor.xyz = gl_FragColor.xyz * shadowColor;

    #endif

    float depth = gl_FragCoord.z / gl_FragCoord.w;
    float fogFactor = smoothstep( 1000.0, 3000.0, depth );
    gl_FragColor = mix( gl_FragColor, vec4( fogColor, gl_FragColor.w ), fogFactor );

}
