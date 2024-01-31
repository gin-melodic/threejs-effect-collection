import './App.css'
import {IThreeExample} from "./example/base.ts";
import {useLayoutEffect, useRef, useState} from "react";
import {EXPBirdsGlTF} from "./example/webgl_gpgpu_birds_gltf.ts";
import {EXPModifierTessellation} from "./example/webgl_modifier_tessellation.ts";

type ExpCollection = {
  name: string,
  creator: () => IThreeExample
}

function App() {
  const examples:ExpCollection[] = [{
    name: 'WebGL Modifier Tessellation',
    creator: () => new EXPModifierTessellation()
  }, {
    name: 'WebGL Birds GLTF',
    creator: () => new EXPBirdsGlTF()
  }];

  const selectOptions = examples.map((item, index) =>
    <option key={index} value={index}>{item.name}</option>)
  const runOnceRef = useRef(false)

  useLayoutEffect(() => {
    if (!runOnceRef.current) {
      runOnceRef.current = true

      const canvas = document.getElementById("main") as HTMLCanvasElement
      canvas.addEventListener('webglcontextlost', (event) => {
        event.preventDefault();
        alert('Out of memory')
      })

      runExample(current)
    }
  }, [runOnceRef])

  const [current, setCurrent] = useState(examples[0].creator())

  const runExample = (exp: IThreeExample) => {
    const canvas = document.getElementById("main") as HTMLCanvasElement
    const example = exp
    example.run(canvas)
  }

  return (
    <div className='flex flex-col justify-center items-center'>
      <section className='flex-1'>
        <canvas id='main'></canvas>
      </section>
      <section className='flex flex-row justify-center align-middle items-center my-8'>
        <label htmlFor='template-choose' className='block text-sm font-medium text-white whitespace-nowrap select-none'>Choose the example</label>
        <select id='template-choose' className='border w-96
        text-sm rounded-lg block w-full p-2.5 bg-gray-700 border-gray-600
        placeholder-gray-400 text-white focus:ring-blue-500 focus:border-blue-500 ml-8'
        onChange={option => {
          current.destroy();
          const target = examples[parseInt(option.target.value)].creator()
          setCurrent(target)
          runExample(target)
        }}>
          { selectOptions }
        </select>
      </section>
    </div>
  )
}

export default App
