import './App.css'
import {IThreeExample} from "./example/base.ts";
import {useLayoutEffect, useRef} from "react";
import {EXPBirdsGlTF} from "./example/webgl_gpgpu_birds_gltf.ts";

function App() {
  const examples:IThreeExample[] = [new EXPBirdsGlTF()];

  const selectOptions = examples.map((item, index) =>
    <option key={index} value={index}>{item.name}</option>)
  const canvasRef = useRef(null)
  const runOnceRef = useRef(false)

  useLayoutEffect(() => {
    if (!runOnceRef.current) {
      runOnceRef.current = true
      runExample(0)
    }
  }, [runOnceRef])

  const runExample = (index: number) => {
    const canvas = canvasRef.current!
    const example = examples[index]
    example.run(canvas)
  }

  return (
    <div className='flex flex-col justify-center items-center'>
      <section className='flex-1'>
        <canvas id='main' ref={canvasRef}></canvas>
      </section>
      <section className='flex flex-row justify-center align-middle items-center my-8'>
        <label htmlFor='template-choose' className='block text-sm font-medium text-white whitespace-nowrap select-none'>Choose the example</label>
        <select id='template-choose' className='border w-96
        text-sm rounded-lg block w-full p-2.5 bg-gray-700 border-gray-600
        placeholder-gray-400 text-white focus:ring-blue-500 focus:border-blue-500 ml-8'
        onChange={option => {
          runExample(parseInt(option.target.value))
        }}>
          { selectOptions }
        </select>
      </section>
    </div>
  )
}

export default App
