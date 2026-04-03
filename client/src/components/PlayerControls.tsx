import { useRef, useEffect, useCallback } from "react";
import { createPortal, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { getTerrainHeight } from "./Terrain";

const MOVE_SPEED = 12;
const SPRINT_MULTIPLIER = 1.8;
const JUMP_FORCE = 8;
const GRAVITY = -22;
const PLAYER_EYE_HEIGHT = 1.62;
const ARM_BASE_POSITION = new THREE.Vector3(0.62, -0.68, -0.92);
const ARM_BASE_ROTATION = new THREE.Euler(-0.45, -0.28, 0.12);

type PlayerControlsProps = {
  onPositionChange?: (
    position: { x: number; y: number; z: number },
    rotation: { x: number; y: number }
  ) => void;
  locked: boolean;
  armColor: string;
  buildPulse: number;
  onLockChange: (locked: boolean) => void;
};

export function PlayerControls({
  onPositionChange,
  locked,
  armColor,
  buildPulse,
  onLockChange,
}: PlayerControlsProps) {
  const { camera, gl, scene } = useThree();

  const keys = useRef<Set<string>>(new Set());
  const velocity = useRef(new THREE.Vector3());
  const euler = useRef(new THREE.Euler(0, 0, 0, "YXZ"));
  const isGrounded = useRef(true);
  const positionRef = useRef(new THREE.Vector3(0, 20, 0));
  const armGroupRef = useRef<THREE.Group>(null);
  const walkPhase = useRef(0);
  const moveBlend = useRef(0);
  const swingStart = useRef<number | null>(null);
  const lastBuildPulse = useRef(buildPulse);

  useEffect(() => {
    const groundY = getTerrainHeight(0, 0);
    positionRef.current.set(0, groundY + PLAYER_EYE_HEIGHT + 2, 0);
    camera.position.copy(positionRef.current);
    euler.current.set(0, 0, 0);
    scene.add(camera);
  }, [camera, scene]);

  const requestLock = useCallback(() => {
    document.body.requestPointerLock();
  }, []);

  useEffect(() => {
    const handleLockChange = () => {
      const isLocked = document.pointerLockElement === document.body || document.pointerLockElement === gl.domElement;
      onLockChange(isLocked);
    };

    document.addEventListener("pointerlockchange", handleLockChange);
    return () => document.removeEventListener("pointerlockchange", handleLockChange);
  }, [gl, onLockChange]);

  useEffect(() => {
    if (!locked) return;

    const handleMouse = (e: MouseEvent) => {
      euler.current.y -= e.movementX * 0.002;
      euler.current.x -= e.movementY * 0.002;
      euler.current.x = Math.max(-Math.PI / 2.1, Math.min(Math.PI / 2.1, euler.current.x));
    };

    document.addEventListener("mousemove", handleMouse);
    return () => document.removeEventListener("mousemove", handleMouse);
  }, [locked]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keys.current.add(e.code);
      if (e.code === "Space" && isGrounded.current && locked) {
        velocity.current.y = JUMP_FORCE;
        isGrounded.current = false;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keys.current.delete(e.code);
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("keyup", handleKeyUp);
    };
  }, [locked]);

  useEffect(() => {
    const handleClick = () => {
      if (!locked) requestLock();
    };

    gl.domElement.addEventListener("click", handleClick);
    return () => gl.domElement.removeEventListener("click", handleClick);
  }, [gl, locked, requestLock]);

  useEffect(() => {
    if (lastBuildPulse.current !== buildPulse) {
      lastBuildPulse.current = buildPulse;
      swingStart.current = -1;
    }
  }, [buildPulse]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1);

    if (locked) {
      const speed = keys.current.has("ShiftLeft") ? MOVE_SPEED * SPRINT_MULTIPLIER : MOVE_SPEED;
      const forward = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(0, euler.current.y, 0));
      const right = new THREE.Vector3(1, 0, 0).applyEuler(new THREE.Euler(0, euler.current.y, 0));
      const moveDir = new THREE.Vector3();

      if (keys.current.has("KeyW") || keys.current.has("ArrowUp")) moveDir.add(forward);
      if (keys.current.has("KeyS") || keys.current.has("ArrowDown")) moveDir.sub(forward);
      if (keys.current.has("KeyD") || keys.current.has("ArrowRight")) moveDir.add(right);
      if (keys.current.has("KeyA") || keys.current.has("ArrowLeft")) moveDir.sub(right);

      const isMoving = moveDir.lengthSq() > 0;
      if (isMoving) {
        moveDir.normalize().multiplyScalar(speed * dt);
        walkPhase.current += dt * (keys.current.has("ShiftLeft") ? 12 : 8);
      }

      moveBlend.current = THREE.MathUtils.damp(moveBlend.current, isMoving ? 1 : 0, 8, dt);
      velocity.current.y += GRAVITY * dt;

      positionRef.current.x += moveDir.x;
      positionRef.current.z += moveDir.z;
      positionRef.current.y += velocity.current.y * dt;

      const groundY = getTerrainHeight(
        Math.round(positionRef.current.x),
        Math.round(positionRef.current.z)
      );
      const feetY = groundY + PLAYER_EYE_HEIGHT;

      if (positionRef.current.y <= feetY) {
        positionRef.current.y = feetY;
        velocity.current.y = 0;
        isGrounded.current = true;
      }

      onPositionChange?.(
        {
          x: Math.round(positionRef.current.x * 10) / 10,
          y: Math.round(positionRef.current.y * 10) / 10,
          z: Math.round(positionRef.current.z * 10) / 10,
        },
        {
          x: Math.round(euler.current.x * 100) / 100,
          y: Math.round(euler.current.y * 100) / 100,
        }
      );
    } else {
      moveBlend.current = THREE.MathUtils.damp(moveBlend.current, 0, 8, dt);
    }

    camera.position.copy(positionRef.current);
    camera.quaternion.setFromEuler(euler.current);

    if (armGroupRef.current) {
      const idle = state.clock.elapsedTime;
      const walk = walkPhase.current;
      const bob = Math.abs(Math.sin(walk)) * 0.055 * moveBlend.current;
      const sway = Math.sin(walk) * 0.06 * moveBlend.current;
      const idleShift = Math.sin(idle * 1.4) * 0.012;
      const idleLift = Math.cos(idle * 1.8) * 0.01;

      let swingX = 0;
      let swingZ = 0;
      let swingY = 0;
      if (swingStart.current !== null) {
        if (swingStart.current < 0) {
          swingStart.current = state.clock.elapsedTime;
        }
        const elapsed = state.clock.elapsedTime - swingStart.current;
        if (elapsed >= 0 && elapsed <= 0.38) {
          const progress = elapsed / 0.38;
          const arc = Math.sin(progress * Math.PI);
          swingX = arc * 1.15;
          swingZ = arc * -0.35;
          swingY = Math.sin(progress * Math.PI * 2) * 0.12;
        } else if (elapsed > 0.38) {
          swingStart.current = null;
        }
      }

      armGroupRef.current.position.set(
        ARM_BASE_POSITION.x + sway + idleShift,
        ARM_BASE_POSITION.y - bob + idleLift + swingY,
        ARM_BASE_POSITION.z + bob * 0.2 + swingZ
      );
      armGroupRef.current.rotation.set(
        ARM_BASE_ROTATION.x + bob * 0.55 + swingX,
        ARM_BASE_ROTATION.y,
        ARM_BASE_ROTATION.z + sway * 0.4
      );
    }
  });

  return createPortal(
    <group
      ref={armGroupRef}
      position={[ARM_BASE_POSITION.x, ARM_BASE_POSITION.y, ARM_BASE_POSITION.z]}
      rotation={[ARM_BASE_ROTATION.x, ARM_BASE_ROTATION.y, ARM_BASE_ROTATION.z]}
    >
      <mesh position={[0, -0.12, 0]}>
        <boxGeometry args={[0.34, 0.8, 0.34]} />
        <meshStandardMaterial
          color={armColor}
          roughness={0.72}
          metalness={0.04}
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0, -0.63, 0.02]}>
        <boxGeometry args={[0.28, 0.3, 0.28]} />
        <meshStandardMaterial
          color="#efc39c"
          roughness={0.85}
          metalness={0.02}
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0, 0.18, 0]}>
        <boxGeometry args={[0.38, 0.16, 0.38]} />
        <meshStandardMaterial
          color={new THREE.Color(armColor).offsetHSL(0, -0.05, 0.08)}
          roughness={0.65}
          metalness={0.06}
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
    </group>,
    camera
  );
}
