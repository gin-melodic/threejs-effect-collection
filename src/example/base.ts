import * as THREE from 'three'
import {GUI} from "three/addons/libs/lil-gui.module.min.js";

export interface IThreeExample {
  run: (canvas: HTMLCanvasElement) => void;
  destroy: () => void;
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
  private parentElement: HTMLElement | null = null

  protected animationId?: number
  gui?: GUI

  constructor() {
    this.scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
    camera.position.set(0, 0, 100)
    camera.lookAt(0, 0, 0)
    this.camera = camera
  }

  run(canvas: HTMLCanvasElement) {
    window.addEventListener( 'resize', () => {
      this.onWindowResize()
    }, false );
    this.parentElement = canvas.parentElement
    const renderParams: {canvas: HTMLCanvasElement} = {canvas}
    this.renderer = new THREE.WebGLRenderer(renderParams)
    this.resetRenderer()
  }

  destroy() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId)
    }
    if (this.gui) {
      this.gui.destroy();
    }
    this.renderer?.clear();
    this.scene.clear();
    if (this.parentElement) {
      // delete <div> child
      for (const child of this.parentElement.children) {
        if (child.tagName === 'DIV') {
          this.parentElement.removeChild(child)
        }
      }
      // remove all event listeners
      const html = this.parentElement.innerHTML
      this.parentElement.innerHTML = html
      window.removeEventListener('resize', () => {
        this.onWindowResize()
      }, false );
    }
  }

  resetRenderer() {
    if (!this.renderer) { return }
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(CanvasSize().width, CanvasSize().height)
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer!.setSize( CanvasSize().width, CanvasSize().height );
  }
}
