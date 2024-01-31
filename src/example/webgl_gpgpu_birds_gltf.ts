import {ThreeScene} from "./base.ts";
import * as THREE from 'three'
import Stats from 'three/addons/libs/stats.module.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GPUComputationRenderer } from 'three/addons/misc/GPUComputationRenderer.js';
import {Utils} from "./util.ts";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
import {Variable} from "three/examples/jsm/misc/GPUComputationRenderer";

/* TEXTURE WIDTH FOR SIMULATION */
const WIDTH = 64;
const BIRDS = WIDTH * WIDTH;

export class EXPBirdsGlTF extends ThreeScene {
    fragPos!: string;
    fragVelocity!: string;
    indicesPerBird = 0
    backgroundColor = 0x000000
    size = 0.1
    textureAnimation!: THREE.DataTexture
    birdGeometry!: THREE.BufferGeometry
    velocityUniforms!: {[p: string]: THREE.IUniform}
    positionUniforms!: {[p: string]: THREE.IUniform}
    positionVariable: Variable
    velocityVariable: Variable
    gpuCompute!: GPUComputationRenderer
    materialShader!: THREE.WebGLProgramParametersWithUniforms
    stats!: Stats

    // about points
    mouseX = 0
    mouseY = 0
    windowHalfX = window.innerWidth / 2
    windowHalfY = window.innerHeight / 2

    // animation
    last = performance.now()

    constructor(backgroundColor?: number) {
        super();
        if (backgroundColor) {
            this.backgroundColor = backgroundColor
        }
        this.initGLSL()
    }
    run(canvas: HTMLCanvasElement) {
        super.run(canvas);

        // BAKE ANIMATION INTO TEXTURE and CREATE GEOMETRY FROM BASE MODEL
        const birdGeometry = new THREE.BufferGeometry();
        const gltfs = ['/Parrot.glb', '/Flamingo.glb'];
        const selectModel = Math.floor( Math.random() * gltfs.length );
        const colors = [0xFFFFFF, 0xFFFFCC]
        const sizes = [ 0.2, 0.1 ]
        this.backgroundColor = colors[ selectModel ];
        this.size = sizes[ selectModel ];
        let durationAnimation, indicesPerBird, textureAnimation;
        new GLTFLoader().load( gltfs[ selectModel ],  ( gltf ) => {
            const animations = gltf.animations;
            durationAnimation = Math.round( animations[ 0 ].duration * 60 );
            const birdGeo = (gltf.scene.children[0] as THREE.Mesh).geometry;
            const morphAttributes = birdGeo.morphAttributes.position;
            const tHeight = Utils.nextPowerOf2( durationAnimation );
            const tWidth = Utils.nextPowerOf2( birdGeo.getAttribute( 'position' ).count );
            indicesPerBird = birdGeo.index?.count ?? 0;
            this.indicesPerBird = indicesPerBird;
            const tData = new Float32Array( 4 * tWidth * tHeight );
            for ( let i = 0; i < tWidth; i ++ ) {
                for ( let j = 0; j < tHeight; j ++ ) {
                    const offset = j * tWidth * 4;
                    const curMorph = Math.floor( j / durationAnimation * morphAttributes.length );
                    const nextMorph = ( Math.floor( j / durationAnimation * morphAttributes.length ) + 1 ) % morphAttributes.length;
                    const lerpAmount = j / durationAnimation * morphAttributes.length % 1;
                    if ( j < durationAnimation ) {
                        let d0, d1;
                        d0 = morphAttributes[ curMorph ].array[ i * 3 ];
                        d1 = morphAttributes[ nextMorph ].array[ i * 3 ];
                        if ( d0 !== undefined && d1 !== undefined ) tData[ offset + i * 4 ] = Utils.lerp( d0, d1, lerpAmount );
                        d0 = morphAttributes[ curMorph ].array[ i * 3 + 1 ];
                        d1 = morphAttributes[ nextMorph ].array[ i * 3 + 1 ];
                        if ( d0 !== undefined && d1 !== undefined ) tData[ offset + i * 4 + 1 ] = Utils.lerp( d0, d1, lerpAmount );
                        d0 = morphAttributes[ curMorph ].array[ i * 3 + 2 ];
                        d1 = morphAttributes[ nextMorph ].array[ i * 3 + 2 ];
                        if ( d0 !== undefined && d1 !== undefined ) tData[ offset + i * 4 + 2 ] = Utils.lerp( d0, d1, lerpAmount );
                        tData[ offset + i * 4 + 3 ] = 1;
                    }
                }
            }
            textureAnimation = new THREE.DataTexture( tData, tWidth, tHeight, THREE.RGBAFormat, THREE.FloatType );
            textureAnimation.needsUpdate = true;
            this.textureAnimation = textureAnimation

            const vertices = [], color = [], reference = [], seeds = [], indices = [];
            const totalVertices = birdGeo.getAttribute( 'position' ).count * 3 * BIRDS;
            for ( let i = 0; i < totalVertices; i ++ ) {
                const bIndex = i % ( birdGeo.getAttribute( 'position' ).count * 3 );
                vertices.push( birdGeo.getAttribute( 'position' ).array[ bIndex ] );
                color.push( birdGeo.getAttribute( 'color' ).array[ bIndex ] );
            }

            let r = Math.random();
            for ( let i = 0; i < birdGeo.getAttribute( 'position' ).count * BIRDS; i ++ ) {
                const bIndex = i % ( birdGeo.getAttribute( 'position' ).count );
                const bird = Math.floor( i / birdGeo.getAttribute( 'position' ).count );
                if ( bIndex == 0 ) r = Math.random();
                const j = ~ ~ bird;
                const x = ( j % WIDTH ) / WIDTH;
                const y = ~ ~ ( j / WIDTH ) / WIDTH;
                reference.push( x, y, bIndex / tWidth, durationAnimation / tHeight );
                seeds.push( bird, r, Math.random(), Math.random() );
            }

            const arr = birdGeo.index?.array ?? []
            for ( let i = 0; i < arr.length * BIRDS; i ++ ) {
                const offset = Math.floor( i / arr.length ) * ( birdGeo.getAttribute( 'position' ).count );
                indices.push( birdGeo.index!.array[ i % arr.length ] + offset );
            }

            birdGeometry.setAttribute( 'position', new THREE.BufferAttribute( new Float32Array( vertices ), 3 ) );
            birdGeometry.setAttribute( 'birdColor', new THREE.BufferAttribute( new Float32Array( color ), 3 ) );
            birdGeometry.setAttribute( 'color', new THREE.BufferAttribute( new Float32Array( color ), 3 ) );
            birdGeometry.setAttribute( 'reference', new THREE.BufferAttribute( new Float32Array( reference ), 4 ) );
            birdGeometry.setAttribute( 'seeds', new THREE.BufferAttribute( new Float32Array( seeds ), 4 ) );

            birdGeometry.setIndex( indices );
            this.birdGeometry = birdGeometry

            this.renderer = new THREE.WebGLRenderer( { canvas, antialias: true } );
            this.resetRenderer()
            this.init();
            this.animate();
        });
    }

    init() {
        this.camera.far = 3000;
        this.camera.position.z = 350;
        this.scene.background = new THREE.Color( this.backgroundColor );
        this.scene.fog = new THREE.Fog( this.backgroundColor, 100, 1000 );

        // Lights
        const hemiLight = new THREE.HemisphereLight( this.backgroundColor, 0xFFFFFF, 4.5 );
        hemiLight.color.setHSL(0.6, 1, 0.6, THREE.SRGBColorSpace);
        hemiLight.groundColor.setHSL(0.095, 1, 0.75, THREE.SRGBColorSpace);
        hemiLight.position.set(0, 50, 0);
        this.scene.add(hemiLight);

        const dirLight = new THREE.DirectionalLight( 0x00CED1, 2.0 );
        dirLight.color.setHSL( 0.1, 1, 0.95, THREE.SRGBColorSpace );
        dirLight.position.set( - 1, 1.75, 1 );
        dirLight.position.multiplyScalar( 30 );
        this.scene.add( dirLight );

        this.initComputeRenderer();

        const stats = new Stats();
        const canvas = this.renderer!.domElement;
        const container = canvas.parentElement!
        container.appendChild( stats.dom );
        this.stats = stats

        container.style.touchAction = 'none';
        container.addEventListener( 'pointermove', this.onPointerMove, false );

        const gui = new GUI();

        const effectController = {
            separation: 20.0,
            alignment: 20.0,
            cohesion: 20.0,
            freedom: 0.75,
            size: this.size,
            count: Math.floor(BIRDS / 4)
        };

        // if run on mobile, count will decrease
        if ( Utils.isMobile() ) {
            effectController.count = Math.floor(BIRDS / 32);
        }

        const valuesChanger = () => {
            this.velocityUniforms[ 'separationDistance' ].value = effectController.separation;
            this.velocityUniforms[ 'alignmentDistance' ].value = effectController.alignment;
            this.velocityUniforms[ 'cohesionDistance' ].value = effectController.cohesion;
            this.velocityUniforms[ 'freedomFactor' ].value = effectController.freedom;
            if ( this.materialShader ) this.materialShader.uniforms[ 'size' ].value = effectController.size;
            this.birdGeometry.setDrawRange( 0, this.indicesPerBird * effectController.count );
        };

        valuesChanger();

        gui.add(effectController, 'separation', 0.0, 100.0, 1.0 ).onChange( valuesChanger );
        gui.add(effectController, 'alignment', 0.0, 100, 0.001 ).onChange( valuesChanger );
        gui.add(effectController, 'cohesion', 0.0, 100, 0.025 ).onChange( valuesChanger );
        gui.add( effectController, 'size', 0, 1, 0.01 ).onChange( valuesChanger );
        gui.add( effectController, 'count', 0, BIRDS, 1 ).onChange( valuesChanger );
        gui.close();
        this.gui = gui;

        this.initBirds(effectController);
    }

    destroy() {
        window.removeEventListener( 'resize', this.onWindowResize, false );
        super.destroy()
    }

    initComputeRenderer() {
        if (!this.renderer) {
            console.error('Renderer not initialized');
            return
        }
        const gpuCompute = new GPUComputationRenderer( WIDTH, WIDTH, this.renderer );
        if ( !this.renderer.capabilities.isWebGL2 ) {
            gpuCompute.setDataType( THREE.HalfFloatType );
        }
        const dtPosition = gpuCompute.createTexture();
        const dtVelocity = gpuCompute.createTexture();
        const BOUNDS = 800, BOUNDS_HALF = BOUNDS / 2;

        Utils.fillTexture( dtPosition, () => Math.random() * BOUNDS - BOUNDS_HALF );
        Utils.fillTexture( dtVelocity, () => (Math.random() - 0.5) * 10);

        const velocityVariable = gpuCompute.addVariable( 'textureVelocity', this.fragVelocity, dtVelocity );
        const positionVariable = gpuCompute.addVariable( 'texturePosition', this.fragPos, dtPosition );

        gpuCompute.setVariableDependencies( velocityVariable, [ positionVariable, velocityVariable ] );
        gpuCompute.setVariableDependencies( positionVariable, [ positionVariable, velocityVariable ] );

        const positionUniforms = positionVariable.material.uniforms;
        const velocityUniforms = velocityVariable.material.uniforms;

        positionUniforms[ 'time' ] = { value: 0.0 };
        positionUniforms[ 'delta' ] = { value: 0.0 };
        velocityUniforms[ 'time' ] = { value: 1.0 };
        velocityUniforms[ 'delta' ] = { value: 0.0 };
        velocityUniforms[ 'testing' ] = { value: 1.0 };
        velocityUniforms[ 'separationDistance' ] = { value: 1.0 };
        velocityUniforms[ 'alignmentDistance' ] = { value: 1.0 };
        velocityUniforms[ 'cohesionDistance' ] = { value: 1.0 };
        velocityUniforms[ 'freedomFactor' ] = { value: 1.0 };
        velocityUniforms[ 'predator' ] = { value: new THREE.Vector3() };
        velocityVariable.material.defines.BOUNDS = BOUNDS.toFixed( 2 );

        velocityVariable.wrapS = THREE.RepeatWrapping;
        velocityVariable.wrapT = THREE.RepeatWrapping;
        positionVariable.wrapS = THREE.RepeatWrapping;
        positionVariable.wrapT = THREE.RepeatWrapping;

        const error = gpuCompute.init();
        if(error) {
           console.error(error);
        }

        this.gpuCompute = gpuCompute
        this.positionVariable = positionVariable
        this.velocityVariable = velocityVariable
        this.velocityUniforms = velocityUniforms;
        this.positionUniforms = positionUniforms;
    }

    initBirds(effectController: {separation: number, alignment: number, cohesion: number, freedom: number, size: number, count: number}) {
        const geometry = this.birdGeometry;
        const m = new THREE.MeshStandardMaterial( {
            vertexColors: true,
            flatShading: true,
            roughness: 1,
            metalness: 0
        } );
        m.onBeforeCompile =(shader) => {
            shader.uniforms.texturePosition = { value: null };
            shader.uniforms.textureVelocity = { value: null };
            shader.uniforms.textureAnimation = { value: this.textureAnimation };
            shader.uniforms.time = { value: 1.0 };
            shader.uniforms.size = { value: effectController.size };
            shader.uniforms.delta = { value: 0.0 };

            let token = '#define STANDARD';

            let insert = /* glsl */`
						attribute vec4 reference;
						attribute vec4 seeds;
						attribute vec3 birdColor;
						uniform sampler2D texturePosition;
						uniform sampler2D textureVelocity;
						uniform sampler2D textureAnimation;
						uniform float size;
						uniform float time;
					`;
            shader.vertexShader = shader.vertexShader.replace( token, token + insert );
            token = '#include <begin_vertex>';
            insert = /* glsl */`
						vec4 tmpPos = texture2D( texturePosition, reference.xy );

						vec3 pos = tmpPos.xyz;
						vec3 velocity = normalize(texture2D( textureVelocity, reference.xy ).xyz);
						vec3 aniPos = texture2D( textureAnimation, vec2( reference.z, mod( time + ( seeds.x ) * ( ( 0.0004 + seeds.y / 10000.0) + normalize( velocity ) / 20000.0 ), reference.w ) ) ).xyz;
						vec3 newPosition = position;

						newPosition = mat3( modelMatrix ) * ( newPosition + aniPos );
						newPosition *= size + seeds.y * size * 0.2;

						velocity.z *= -1.;
						float xz = length( velocity.xz );
						float xyz = 1.;
						float x = sqrt( 1. - velocity.y * velocity.y );

						float cosry = velocity.x / xz;
						float sinry = velocity.z / xz;

						float cosrz = x / xyz;
						float sinrz = velocity.y / xyz;

						mat3 maty =  mat3( cosry, 0, -sinry, 0    , 1, 0     , sinry, 0, cosry );
						mat3 matz =  mat3( cosrz , sinrz, 0, -sinrz, cosrz, 0, 0     , 0    , 1 );

						newPosition =  maty * matz * newPosition;
						newPosition += pos;

						vec3 transformed = vec3( newPosition );
					`;
            shader.vertexShader = shader.vertexShader.replace( token, insert );
            this.materialShader = shader;
        }

        const birdMesh = new THREE.Mesh( geometry, m );
        birdMesh.rotation.y = Math.PI / 2;

        birdMesh.castShadow = true;
        birdMesh.receiveShadow = true;

        this.scene.add( birdMesh );
    }

    onPointerMove(event: PointerEvent) {
        if (!event.isPrimary) { return }
        this.mouseX = event.clientX - this.windowHalfX;
        this.mouseY = event.clientY - this.windowHalfY;
    }

    onWindowResize() {
        super.onWindowResize()
        this.windowHalfX = window.innerWidth / 2;
        this.windowHalfY = window.innerHeight / 2;
    }

    animate() {
        this.animationId = requestAnimationFrame(() => {
            this.animate()
        })
        this.render()
        this.stats.update()
    }

    render() {
        const now = performance.now();
        let delta = ( now - this.last ) / 1000;

        if ( delta > 1 ) delta = 1; // safety cap on large deltas
        this.last = now;

        this.positionUniforms[ 'time' ].value = now;
        this.positionUniforms[ 'delta' ].value = delta;
        this.velocityUniforms[ 'time' ].value = now;
        this.velocityUniforms[ 'delta' ].value = delta;
        if ( this.materialShader ) this.materialShader.uniforms[ 'time' ].value = now / 1000;
        if ( this.materialShader ) this.materialShader.uniforms[ 'delta' ].value = delta;

        this.velocityUniforms[ 'predator' ].value.set( 0.5 * this.mouseX / this.windowHalfX, - 0.5 * this.mouseY / this.windowHalfY, 0 );

        this.mouseX = 10000;
        this.mouseY = 10000;

        this.gpuCompute.compute();

        if ( this.materialShader ) this.materialShader.uniforms[ 'texturePosition' ].value = this.gpuCompute.getCurrentRenderTarget( this.positionVariable ).texture;
        if ( this.materialShader ) this.materialShader.uniforms[ 'textureVelocity' ].value = this.gpuCompute.getCurrentRenderTarget( this.velocityVariable ).texture;

        this.renderer!.render( this.scene, this.camera );
    }

    initGLSL() {
        this.fragPos = `
uniform float time;
uniform float delta;

void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec4 tmpPos = texture2D( texturePosition, uv );
    vec3 position = tmpPos.xyz;
    vec3 velocity = texture2D( textureVelocity, uv ).xyz;
    float phase = tmpPos.w;
    phase = mod( ( phase + delta +
    length( velocity.xz ) * delta * 3. +
    max( velocity.y, 0.0 ) * delta * 6. ), 62.83 );
    gl_FragColor = vec4( position + velocity * delta * 15. , phase );
}`;
        this.fragVelocity = `uniform float time;
uniform float testing;
uniform float delta; // about 0.016
uniform float separationDistance; // 20
uniform float alignmentDistance; // 40
uniform float cohesionDistance; //
uniform float freedomFactor;
uniform vec3 predator;

const float width = resolution.x;
const float height = resolution.y;

const float PI = 3.141592653589793;
const float PI_2 = PI * 2.0;
// const float VISION = PI * 0.55;

float zoneRadius = 40.0;
float zoneRadiusSquared = 1600.0;

float separationThresh = 0.45;
float alignmentThresh = 0.65;

const float UPPER_BOUNDS = BOUNDS;
const float LOWER_BOUNDS = -UPPER_BOUNDS;

const float SPEED_LIMIT = 9.0;

float rand( vec2 co ){
    return fract( sin( dot( co.xy, vec2(12.9898,78.233) ) ) * 43758.5453 );
}

void main() {
    zoneRadius = separationDistance + alignmentDistance + cohesionDistance;
    separationThresh = separationDistance / zoneRadius;
    alignmentThresh = ( separationDistance + alignmentDistance ) / zoneRadius;
    zoneRadiusSquared = zoneRadius * zoneRadius;


    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec3 birdPosition, birdVelocity;

    vec3 selfPosition = texture2D( texturePosition, uv ).xyz;
    vec3 selfVelocity = texture2D( textureVelocity, uv ).xyz;

    float dist;
    vec3 dir; // direction
    float distSquared;

    float separationSquared = separationDistance * separationDistance;
    float cohesionSquared = cohesionDistance * cohesionDistance;

    float f;
    float percent;

    vec3 velocity = selfVelocity;

    float limit = SPEED_LIMIT;

    dir = predator * UPPER_BOUNDS - selfPosition;
    dir.z = 0.;
    // dir.z *= 0.6;
    dist = length( dir );
    distSquared = dist * dist;

    float preyRadius = 150.0;
    float preyRadiusSq = preyRadius * preyRadius;


    // move birds away from predator
    if ( dist < preyRadius ) {

    f = ( distSquared / preyRadiusSq - 1.0 ) * delta * 100.;
    velocity += normalize( dir ) * f;
    limit += 5.0;
    }


    // if (testing == 0.0) {}
    // if ( rand( uv + time ) < freedomFactor ) {}


    // Attract flocks to the center
    vec3 central = vec3( 0., 0., 0. );
    dir = selfPosition - central;
    dist = length( dir );

    dir.y *= 2.5;
    velocity -= normalize( dir ) * delta * 5.;

    for ( float y = 0.0; y < height; y++ ) {
    for ( float x = 0.0; x < width; x++ ) {

        vec2 ref = vec2( x + 0.5, y + 0.5 ) / resolution.xy;
        birdPosition = texture2D( texturePosition, ref ).xyz;
        
        dir = birdPosition - selfPosition;
        dist = length( dir );
        
        if ( dist < 0.0001 ) continue;
        
        distSquared = dist * dist;
        
        if ( distSquared > zoneRadiusSquared ) continue;
        
        percent = distSquared / zoneRadiusSquared;
        
        if ( percent < separationThresh ) { // low
        
            // Separation - Move apart for comfort
            f = ( separationThresh / percent - 1.0 ) * delta;
            velocity -= normalize( dir ) * f;
        
        } else if ( percent < alignmentThresh ) { // high
        
            // Alignment - fly the same direction
            float threshDelta = alignmentThresh - separationThresh;
            float adjustedPercent = ( percent - separationThresh ) / threshDelta;
        
            birdVelocity = texture2D( textureVelocity, ref ).xyz;
        
            f = ( 0.5 - cos( adjustedPercent * PI_2 ) * 0.5 + 0.5 ) * delta;
            velocity += normalize( birdVelocity ) * f;
        
        } else {
        
            // Attraction / Cohesion - move closer
            float threshDelta = 1.0 - alignmentThresh;
            float adjustedPercent;
            if( threshDelta == 0. ) adjustedPercent = 1.;
            else adjustedPercent = ( percent - alignmentThresh ) / threshDelta;
        
            f = ( 0.5 - ( cos( adjustedPercent * PI_2 ) * -0.5 + 0.5 ) ) * delta;
        
            velocity += normalize( dir ) * f;
        }
    }
    }

    // this make tends to fly around than down or up
    // if (velocity.y > 0.) velocity.y *= (1. - 0.2 * delta);

    // Speed Limits
    if ( length( velocity ) > limit ) {
    velocity = normalize( velocity ) * limit;
    }

    gl_FragColor = vec4( velocity, 1.0 );

}`;
    }
}
