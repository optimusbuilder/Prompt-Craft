import { Cloud, Clouds, Grid } from "@react-three/drei";
import * as THREE from "three";

export function SkyWorld() {
  return (
    <>
      <color attach="background" args={["#87CEEB"]} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[100, 200, 50]} intensity={1.5} castShadow />
      
      <Grid 
        position={[0, 0, 0]} 
        args={[10000, 10000]} 
        cellColor="#0055ff" 
        sectionColor="#00aaff" 
        fadeDistance={2000}
        cellThickness={1}
        sectionThickness={1.5}
      />
      
      <Clouds material={THREE.MeshBasicMaterial} limit={100}>
        {Array.from({ length: 40 }).map((_, i) => (
          <Cloud
            key={i}
            position={[
              (Math.random() - 0.5) * 4000,
              200 + Math.random() * 800,
              (Math.random() - 0.5) * 4000
            ]}
            speed={0.2}
            opacity={0.5}
            scale={5 + Math.random() * 5}
            color="#ffffff"
          />
        ))}
      </Clouds>
    </>
  );
}
