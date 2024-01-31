import * as THREE from 'three'

export interface IThreeExample {
  name: string

  run: (canvas: HTMLCanvasElement) => void;
  destroy?: () => void;
}

export const CanvasSize = () => {
  return {
    width: window.innerWidth,
    height: window.innerHeight - 110
  }
}

export class ThreeScene implements IThreeExample {
  scene
  camera
  renderer?: THREE.WebGLRenderer
  name!: string
  constructor() {
    this.scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
    camera.position.set(0, 0, 100)
    camera.lookAt(0, 0, 0)
    this.camera = camera
  }

  run(canvas: HTMLCanvasElement) {
    const renderParams: {canvas: HTMLCanvasElement} = {canvas}
    this.renderer = new THREE.WebGLRenderer(renderParams)
    this.resetRenderer()
  }

  resetRenderer() {
    if (!this.renderer) { return }
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(CanvasSize().width, CanvasSize().height)
  }
}
