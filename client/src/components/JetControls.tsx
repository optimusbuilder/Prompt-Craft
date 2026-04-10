import { useRef, useEffect } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { Trail } from "@react-three/drei";
import { getTerrainHeight } from "../utils/terrain";

const MAX_SPEED = 180;
const MIN_SPEED = 50;

export function JetControls({
  locked,
  cameraMode,
  onPositionChange,
  health,
  onFire,
  onCrash,
}: {
  locked: boolean;
  cameraMode: "first_person" | "third_person";
  onPositionChange: any;
  health: number;
  onFire: (pos: THREE.Vector3, vel: THREE.Vector3) => void;
  onCrash: () => void;
}) {
  const { camera } = useThree();
  const velocity = useRef(new THREE.Vector3());
  const position = useRef(new THREE.Vector3((Math.random() - 0.5) * 400, 500, (Math.random() - 0.5) * 400));
  const quaternion = useRef(new THREE.Quaternion());
  const speed = useRef(100);
  const localJetRef = useRef<THREE.Group>(null);
  
  const input = useRef({ pitch: 0, yaw: 0, roll: 0 });
  const keys = useRef(new Set<string>());
  const lastFire = useRef(0);

  useEffect(() => {
    const handleMouse = (e: MouseEvent) => {
      if (!locked) return;
      input.current.yaw -= e.movementX * 0.0012;
      input.current.pitch -= e.movementY * 0.0012;
    };
    document.addEventListener("mousemove", handleMouse);
    return () => document.removeEventListener("mousemove", handleMouse);
  }, [locked]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => keys.current.add(e.code);
    const handleKeyUp = (e: KeyboardEvent) => keys.current.delete(e.code);
    const handleMouseDown = (e: MouseEvent) => {
      if (locked && e.button === 0) keys.current.add("Mouse0");
    };
    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0) keys.current.delete("Mouse0");
    };
    
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("keyup", handleKeyUp);
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [locked]);

  useFrame((state, delta) => {
    if (health <= 0) return;
    const dt = Math.min(delta, 0.1);

    if (locked) {
      if (keys.current.has("KeyA")) input.current.roll += 2 * dt;
      if (keys.current.has("KeyD")) input.current.roll -= 2 * dt;
      if (keys.current.has("ShiftLeft")) speed.current = THREE.MathUtils.lerp(speed.current, MAX_SPEED, dt);
      else if (keys.current.has("ShiftRight") || keys.current.has("ControlLeft")) speed.current = THREE.MathUtils.lerp(speed.current, MIN_SPEED, dt * 2);
      else speed.current = THREE.MathUtils.lerp(speed.current, 100, dt);
    }

    const pitchQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), input.current.pitch * dt * 3);
    const yawQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), input.current.yaw * dt * 3);
    const rollQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), input.current.roll * dt * 3);

    quaternion.current.multiply(yawQuat).multiply(pitchQuat).multiply(rollQuat);
    quaternion.current.normalize();

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(quaternion.current);
    velocity.current.copy(forward).multiplyScalar(speed.current);
    position.current.addScaledVector(velocity.current, dt);

    const groundHeight = getTerrainHeight(position.current.x, position.current.z);
    // Add 2 to the height due to the jet's physical size
    if (position.current.y <= groundHeight + 2) {
      if (speed.current > MIN_SPEED + 10) {
         // Crash
         position.current.y = groundHeight + 2;
         onCrash();
      } else {
         // Bumping the ground safely at low speed (or spawn)
         position.current.y = groundHeight + 2;
         velocity.current.y = Math.max(0, velocity.current.y);
         const up = new THREE.Vector3(0, 1, 0);
         quaternion.current.setFromUnitVectors(new THREE.Vector3(0,0,-1), forward.projectOnPlane(up).normalize());
      }
    }

    if (cameraMode === "third_person") {
      const desiredPos = position.current
        .clone()
        .add(forward.clone().multiplyScalar(-16))
        .add(new THREE.Vector3(0, 5.5, 0));
      camera.position.lerp(desiredPos, 1 - Math.exp(-dt * 10));
      camera.lookAt(position.current.clone().add(forward.clone().multiplyScalar(25)));
    } else {
      camera.position.copy(position.current);
      camera.quaternion.copy(quaternion.current);
    }

    if (localJetRef.current) {
      localJetRef.current.position.copy(position.current);
      localJetRef.current.quaternion.copy(quaternion.current);
    }

    input.current.pitch = THREE.MathUtils.lerp(input.current.pitch, 0, dt * 5);
    input.current.yaw = THREE.MathUtils.lerp(input.current.yaw, 0, dt * 5);
    input.current.roll = THREE.MathUtils.lerp(input.current.roll, 0, dt * 5);

    onPositionChange?.({
      position: position.current.clone(),
      quaternion: quaternion.current.clone(),
      velocity: velocity.current.clone()
    });

    if (locked && keys.current.has("Mouse0") && state.clock.elapsedTime - lastFire.current > 0.1) {
      lastFire.current = state.clock.elapsedTime;
      const bulletVel = forward.clone().multiplyScalar(1000).add(velocity.current);
      onFire(position.current.clone(), bulletVel);
    }
  });

  return (
    <group ref={localJetRef}>
      <Trail width={0.3} length={12} color="#ffffff" attenuation={(t) => t * t}>
        <mesh position={[-3.3, -0.1, 0.3]} visible={false}>
          <boxGeometry args={[0.1, 0.1, 0.1]} />
        </mesh>
      </Trail>
      <Trail width={0.3} length={12} color="#ffffff" attenuation={(t) => t * t}>
        <mesh position={[3.3, -0.1, 0.3]} visible={false}>
          <boxGeometry args={[0.1, 0.1, 0.1]} />
        </mesh>
      </Trail>
    </group>
  );
}
