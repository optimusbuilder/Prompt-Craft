import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";

const DAY_LENGTH_SECONDS = 1200;
const SKY_RADIUS = 380;

const SKY_STOPS = [
  {
    t: 0,
    top: "#31406f",
    middle: "#ef8b52",
    horizon: "#ffd59a",
    sun: "#ffd38a",
    fog: "#cf9777",
    ambient: "#ffd2a1",
    hemiSky: "#f2c28d",
    hemiGround: "#5d5b4d",
  },
  {
    t: 0.25,
    top: "#63b9ff",
    middle: "#9edcff",
    horizon: "#e7f6ff",
    sun: "#fff2c1",
    fog: "#b8d5ea",
    ambient: "#ffffff",
    hemiSky: "#97d9ff",
    hemiGround: "#5f8750",
  },
  {
    t: 0.5,
    top: "#5d3a78",
    middle: "#ca5c69",
    horizon: "#ffb06e",
    sun: "#ffb668",
    fog: "#b9796a",
    ambient: "#ffc694",
    hemiSky: "#ff9772",
    hemiGround: "#5c4a45",
  },
  {
    t: 0.75,
    top: "#08111f",
    middle: "#102347",
    horizon: "#233d66",
    sun: "#9db7ff",
    fog: "#10203b",
    ambient: "#8fb4ff",
    hemiSky: "#203b6a",
    hemiGround: "#1a2332",
  },
  {
    t: 1,
    top: "#31406f",
    middle: "#ef8b52",
    horizon: "#ffd59a",
    sun: "#ffd38a",
    fog: "#cf9777",
    ambient: "#ffd2a1",
    hemiSky: "#f2c28d",
    hemiGround: "#5d5b4d",
  },
] as const;

function sampleStop(progress: number) {
  for (let i = 0; i < SKY_STOPS.length - 1; i++) {
    const start = SKY_STOPS[i];
    const end = SKY_STOPS[i + 1];
    if (progress >= start.t && progress <= end.t) {
      const localT = (progress - start.t) / (end.t - start.t);
      return {
        top: new THREE.Color(start.top).lerp(new THREE.Color(end.top), localT),
        middle: new THREE.Color(start.middle).lerp(new THREE.Color(end.middle), localT),
        horizon: new THREE.Color(start.horizon).lerp(new THREE.Color(end.horizon), localT),
        sun: new THREE.Color(start.sun).lerp(new THREE.Color(end.sun), localT),
        fog: new THREE.Color(start.fog).lerp(new THREE.Color(end.fog), localT),
        ambient: new THREE.Color(start.ambient).lerp(new THREE.Color(end.ambient), localT),
        hemiSky: new THREE.Color(start.hemiSky).lerp(new THREE.Color(end.hemiSky), localT),
        hemiGround: new THREE.Color(start.hemiGround).lerp(new THREE.Color(end.hemiGround), localT),
      };
    }
  }

  return {
    top: new THREE.Color(SKY_STOPS[0].top),
    middle: new THREE.Color(SKY_STOPS[0].middle),
    horizon: new THREE.Color(SKY_STOPS[0].horizon),
    sun: new THREE.Color(SKY_STOPS[0].sun),
    fog: new THREE.Color(SKY_STOPS[0].fog),
    ambient: new THREE.Color(SKY_STOPS[0].ambient),
    hemiSky: new THREE.Color(SKY_STOPS[0].hemiSky),
    hemiGround: new THREE.Color(SKY_STOPS[0].hemiGround),
  };
}

function createStarPositions() {
  const positions = new Float32Array(600 * 3);
  for (let i = 0; i < 600; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(THREE.MathUtils.lerp(0.15, 1, Math.random()));
    const radius = 260 + Math.random() * 80;
    const x = Math.sin(phi) * Math.cos(theta) * radius;
    const y = Math.abs(Math.cos(phi)) * radius + 40;
    const z = Math.sin(phi) * Math.sin(theta) * radius;

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
  }
  return positions;
}

function SkyDome({ material }: { material: THREE.ShaderMaterial }) {
  return (
    <mesh material={material}>
      <sphereGeometry args={[SKY_RADIUS, 48, 48]} />
    </mesh>
  );
}

function Clouds({ daylightRef }: { daylightRef: React.MutableRefObject<number> }) {
  const groupRef = useRef<THREE.Group>(null);
  const materialRefs = useRef<THREE.MeshBasicMaterial[]>([]);

  const clouds = useMemo(() => {
    const result: { x: number; y: number; z: number; scale: number; opacity: number }[] = [];
    for (let i = 0; i < 26; i++) {
      const angle = (i / 26) * Math.PI * 2 + Math.random() * 0.6;
      const radius = 70 + Math.random() * 115;
      result.push({
        x: Math.cos(angle) * radius,
        y: 42 + Math.random() * 20,
        z: Math.sin(angle) * radius,
        scale: 10 + Math.random() * 18,
        opacity: 0.16 + Math.random() * 0.18,
      });
    }
    return result;
  }, []);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.004;
    }

    for (const material of materialRefs.current) {
      if (!material) continue;
      material.opacity = THREE.MathUtils.lerp(0.04, 0.26, daylightRef.current);
      material.color.setRGB(
        THREE.MathUtils.lerp(0.58, 1, daylightRef.current),
        THREE.MathUtils.lerp(0.64, 1, daylightRef.current),
        THREE.MathUtils.lerp(0.8, 1, daylightRef.current)
      );
    }
  });

  return (
    <group ref={groupRef}>
      {clouds.map((cloud, i) => (
        <mesh key={i} position={[cloud.x, cloud.y, cloud.z]} rotation={[-0.15, Math.random(), 0]}>
          <planeGeometry args={[cloud.scale, cloud.scale * 0.42]} />
          <meshBasicMaterial
            ref={(material) => {
              if (material) materialRefs.current[i] = material;
            }}
            color="#ffffff"
            transparent
            opacity={cloud.opacity}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

export function Sky() {
  const { scene, gl } = useThree();
  const daylightRef = useRef(1);
  const skyMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTopColor: { value: new THREE.Color("#63b9ff") },
          uMiddleColor: { value: new THREE.Color("#9edcff") },
          uHorizonColor: { value: new THREE.Color("#e7f6ff") },
          uSunColor: { value: new THREE.Color("#fff2c1") },
          uMoonColor: { value: new THREE.Color("#d8e4ff") },
          uSunDir: { value: new THREE.Vector3(0.8, 0.4, -0.3).normalize() },
          uMoonDir: { value: new THREE.Vector3(-0.8, -0.4, 0.3).normalize() },
          uNightFactor: { value: 0 },
        },
        vertexShader: `
          varying vec3 vWorldPosition;
          void main() {
            vec4 worldPos = modelMatrix * vec4(position, 1.0);
            vWorldPosition = worldPos.xyz;
            gl_Position = projectionMatrix * viewMatrix * worldPos;
          }
        `,
        fragmentShader: `
          uniform vec3 uTopColor;
          uniform vec3 uMiddleColor;
          uniform vec3 uHorizonColor;
          uniform vec3 uSunColor;
          uniform vec3 uMoonColor;
          uniform vec3 uSunDir;
          uniform vec3 uMoonDir;
          uniform float uNightFactor;
          varying vec3 vWorldPosition;

          void main() {
            vec3 dir = normalize(vWorldPosition);
            float height = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);

            vec3 color = mix(uHorizonColor, uMiddleColor, smoothstep(0.0, 0.45, height));
            color = mix(color, uTopColor, smoothstep(0.3, 1.0, height));

            float sunDot = max(0.0, dot(dir, uSunDir));
            float sunGlow = pow(sunDot, 42.0) * 1.7 + pow(sunDot, 6.0) * 0.22;
            color += uSunColor * sunGlow;

            float moonDot = max(0.0, dot(dir, uMoonDir));
            float moonGlow = pow(moonDot, 54.0) * 0.8 + pow(moonDot, 10.0) * 0.12;
            color += uMoonColor * moonGlow * uNightFactor;

            float horizonBand = exp(-abs(dir.y) * 10.0) * 0.12;
            color += uHorizonColor * horizonBand;

            gl_FragColor = vec4(color, 1.0);
          }
        `,
        side: THREE.BackSide,
        depthWrite: false,
      }),
    []
  );

  const sunRef = useRef<THREE.Group>(null);
  const moonRef = useRef<THREE.Group>(null);
  const starsRef = useRef<THREE.Points>(null);
  const starsMaterialRef = useRef<THREE.PointsMaterial>(null);
  const sunLightRef = useRef<THREE.DirectionalLight>(null);
  const moonLightRef = useRef<THREE.DirectionalLight>(null);
  const ambientLightRef = useRef<THREE.AmbientLight>(null);
  const hemiLightRef = useRef<THREE.HemisphereLight>(null);

  const starPositions = useMemo(() => createStarPositions(), []);

  useEffect(() => {
    return () => {
      skyMaterial.dispose();
    };
  }, [skyMaterial]);

  useFrame((state) => {
    const progress = (state.clock.elapsedTime % DAY_LENGTH_SECONDS) / DAY_LENGTH_SECONDS;
    const sunAngle = progress * Math.PI * 2;
    const sunDir = new THREE.Vector3(
      Math.cos(sunAngle),
      Math.sin(sunAngle),
      -0.28
    ).normalize();
    const moonDir = sunDir.clone().multiplyScalar(-1);
    const sunHeight = sunDir.y;
    const daylight = THREE.MathUtils.clamp((sunHeight + 0.12) / 0.48, 0, 1);
    const sunset = 1 - THREE.MathUtils.clamp(Math.abs(sunHeight) / 0.32, 0, 1);
    const night = THREE.MathUtils.clamp((-sunHeight - 0.02) / 0.42, 0, 1);
    const colors = sampleStop(progress);

    daylightRef.current = daylight;

    skyMaterial.uniforms.uTopColor.value.copy(colors.top);
    skyMaterial.uniforms.uMiddleColor.value.copy(colors.middle);
    skyMaterial.uniforms.uHorizonColor.value.copy(colors.horizon);
    skyMaterial.uniforms.uSunColor.value.copy(colors.sun);
    skyMaterial.uniforms.uMoonColor.value.set("#d7e2ff");
    skyMaterial.uniforms.uSunDir.value.copy(sunDir);
    skyMaterial.uniforms.uMoonDir.value.copy(moonDir);
    skyMaterial.uniforms.uNightFactor.value = night;

    const sunPosition = sunDir.clone().multiplyScalar(160);
    const moonPosition = moonDir.clone().multiplyScalar(150);

    sunRef.current?.position.copy(sunPosition);
    moonRef.current?.position.copy(moonPosition);

    if (starsRef.current) {
      starsRef.current.rotation.y = state.clock.elapsedTime * 0.01;
    }
    if (starsMaterialRef.current) {
      starsMaterialRef.current.opacity = THREE.MathUtils.lerp(0, 0.95, night);
    }

    if (sunLightRef.current) {
      sunLightRef.current.position.copy(sunPosition);
      sunLightRef.current.intensity = 0.15 + daylight * 1.7 + sunset * 0.2;
      sunLightRef.current.color.copy(colors.sun);
    }

    if (moonLightRef.current) {
      moonLightRef.current.position.copy(moonPosition);
      moonLightRef.current.intensity = 0.08 + night * 0.45;
      moonLightRef.current.color.set("#9ab3ff");
    }

    if (ambientLightRef.current) {
      ambientLightRef.current.intensity = 0.18 + daylight * 0.35 + night * 0.06;
      ambientLightRef.current.color.copy(colors.ambient);
    }

    if (hemiLightRef.current) {
      hemiLightRef.current.intensity = 0.18 + daylight * 0.3 + night * 0.12;
      hemiLightRef.current.color.copy(colors.hemiSky);
      hemiLightRef.current.groundColor.copy(colors.hemiGround);
    }

    if (scene.fog instanceof THREE.Fog) {
      scene.fog.color.copy(colors.fog);
    }
    scene.background = colors.fog.clone();
    gl.setClearColor(colors.fog, 1);
  });

  return (
    <group>
      <SkyDome material={skyMaterial} />

      <ambientLight ref={ambientLightRef} intensity={0.55} color="#f4e4c4" />
      <hemisphereLight ref={hemiLightRef} intensity={0.35} color="#97d9ff" groundColor="#5f8750" />
      <directionalLight
        ref={sunLightRef}
        castShadow
        intensity={2}
        position={[120, 90, -80]}
        color="#fff1cc"
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.5}
        shadow-camera-far={260}
        shadow-camera-left={-75}
        shadow-camera-right={75}
        shadow-camera-top={75}
        shadow-camera-bottom={-75}
      />
      <directionalLight ref={moonLightRef} intensity={0.25} position={[-120, 80, 80]} color="#a8b8ff" />

      <Clouds daylightRef={daylightRef} />

      <points ref={starsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[starPositions, 3]}
            count={starPositions.length / 3}
          />
        </bufferGeometry>
        <pointsMaterial
          ref={starsMaterialRef}
          color="#eef4ff"
          size={1.8}
          sizeAttenuation
          transparent
          opacity={0}
          depthWrite={false}
        />
      </points>

      <group ref={sunRef} position={[130, 95, -140]}>
        <mesh>
          <sphereGeometry args={[8, 20, 20]} />
          <meshBasicMaterial color="#fff0bb" />
        </mesh>
        <mesh>
          <sphereGeometry args={[16, 20, 20]} />
          <meshBasicMaterial color="#ffd37f" transparent opacity={0.22} />
        </mesh>
      </group>

      <group ref={moonRef} position={[-130, 80, 140]}>
        <mesh>
          <sphereGeometry args={[5.5, 18, 18]} />
          <meshBasicMaterial color="#dfe8ff" transparent opacity={0.95} />
        </mesh>
        <mesh position={[0.6, 0.3, 0.1]}>
          <sphereGeometry args={[1.2, 8, 8]} />
          <meshBasicMaterial color="#c7d5f2" transparent opacity={0.55} />
        </mesh>
      </group>
    </group>
  );
}
