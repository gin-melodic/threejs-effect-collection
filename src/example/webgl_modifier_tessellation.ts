import * as THREE from 'three'
import {ThreeScene} from "./base.ts";
import {FontLoader, TessellateModifier, TextGeometry, Font, TrackballControls} from "three/addons";
import {IUniform} from "three";
import Stats from 'three/addons/libs/stats.module.js';

export class EXPModifierTessellation extends ThreeScene {
  vert!: string;
  frag!: string;
  constructor() {
    super();
    this.glslInit()
  }

  run(canvas: HTMLCanvasElement) {
    super.run(canvas);
    const loader = new FontLoader();
    loader.load('/fonts/helvetiker_bold.typeface.json', (font) => {
      this.init(font);
      this.animate();
    })
  }

  uniforms!: { [uniform: string]: IUniform }
  mesh!: THREE.Mesh
  controls!: TrackballControls
  stats!: Stats

  init(font: Font) {
    this.scene.background = new THREE.Color(0x000000)
    let geometry = new TextGeometry('HELLO WORLD', {
      font: font,
      size: 56,
      height: 8,
      curveSegments: 3,
      bevelThickness: 2,
      bevelSize: 1,
      bevelEnabled: true
    })
    geometry.center();
    const tessellateModifier = new TessellateModifier(8, 3)
    geometry = tessellateModifier.modify(geometry)

    const numFaces = geometry.attributes.position.count / 3;
    const colors = new Float32Array( numFaces * 3 * 3 );
    const displacement = new Float32Array( numFaces * 3 * 3 );

    const color = new THREE.Color();

    for ( let f = 0; f < numFaces; f ++ ) {
      const index = 9 * f;
      const h = 0.5 * Math.random();
      const s = 1;
      const l = 0.8;
      color.setHSL( h, s, l );
      const d = 10 * ( 0.5 - Math.random() );
      for ( let i = 0; i < 3; i ++ ) {
        colors[ index + ( 3 * i ) ] = color.r;
        colors[ index + ( 3 * i ) + 1 ] = color.g;
        colors[ index + ( 3 * i ) + 2 ] = color.b;
        displacement[ index + ( 3 * i ) ] = d;
        displacement[ index + ( 3 * i ) + 1 ] = d;
        displacement[ index + ( 3 * i ) + 2 ] = d;
      }
    }

    geometry.setAttribute( 'customColor', new THREE.BufferAttribute( colors, 3 ) );
    geometry.setAttribute( 'displacement', new THREE.BufferAttribute( displacement, 3 ) );

    this.uniforms = {
      amplitude: { value: 0.0 }
    };

    const shaderMaterial = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: this.vert,
      fragmentShader: this.frag,
    });

    this.mesh = new THREE.Mesh(geometry, shaderMaterial);

    this.scene.add(this.mesh);

    this.controls = new TrackballControls(this.camera, this.renderer!.domElement);
    this.stats = new Stats();
    const p = this.renderer!.domElement.parentElement!
    p.appendChild(this.stats.dom);

    this.camera.position.set(0, 0, 200);
  }

  animate() {
    this.animationId = requestAnimationFrame(() => {
      this.animate()
    })
    this.render()
    this.stats.update()
  }

  render() {
    const time = Date.now() * 0.001;
    this.uniforms.amplitude.value = 1.0 + Math.sin( time * 3 );
    this.controls.update();
    this.renderer!.render(this.scene, this.camera);
  }

  glslInit() {
    this.vert = `
uniform float amplitude;

attribute vec3 customColor;
attribute vec3 displacement;

varying vec3 vNormal;
varying vec3 vColor;

void main() {

    vNormal = normal;
    vColor = customColor;

    vec3 newPosition = position + normal * amplitude * displacement;
    gl_Position = projectionMatrix * modelViewMatrix * vec4( newPosition, 1.0 );
}

        `;
    this.frag = `
varying vec3 vNormal;
varying vec3 vColor;

void main() {

    const float ambient = 0.4;

    vec3 light = vec3( 1.0 );
    light = normalize( light );

    float directional = max( dot( vNormal, light ), 0.0 );

    gl_FragColor = vec4( ( directional + ambient ) * vColor, 1.0 );
}
`;
  }
}
