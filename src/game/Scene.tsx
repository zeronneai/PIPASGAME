import { Canvas } from '@react-three/fiber'

export function Scene() {
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [8, 8, 10], fov: 60 }}
      gl={{ powerPreference: 'high-performance' }}
    >
      <color attach="background" args={['#5c6b7a']} />
      <directionalLight position={[10, 15, 5]} intensity={2.2} />
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#7a7a7a" />
      </mesh>
    </Canvas>
  )
}
