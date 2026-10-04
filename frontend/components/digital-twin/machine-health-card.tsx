import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment, ContactShadows, Float } from "@react-three/drei";
import * as THREE from "three";

interface MachineHealthCardProps {
  telemetry: any;
}

// The actual 3D Motor component
function Motor3D({ telemetry }: { telemetry: any }) {
  const groupRef = useRef<THREE.Group>(null);
  
  // Calculate health state using real telemetry scores
  const isAnomalous = telemetry && telemetry.fused_score > 0.7;
  const isCritical = telemetry && telemetry.fused_score > 0.85;
  const vibScore = telemetry?.vibration_score ?? 0.08;
  const vibration = vibScore * 4.5 + 0.02; // 0.02g - 4.5g
  const temp = telemetry?.env_temp ?? 22;

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    
    // Normal rotation of the motor shaft (faster when anomalous)
    groupRef.current.rotation.x += delta * (isAnomalous ? 4 : 2);
    
    // Physical vibration effect: violent shudder when bearing is failing
    if (vibScore > 0.3) {
      groupRef.current.position.x = (Math.random() - 0.5) * vibration * 0.06;
      groupRef.current.position.y = (Math.random() - 0.5) * vibration * 0.06;
    } else {
      groupRef.current.position.set(0, 0, 0);
    }
  });

  // Dynamic thermal color mapping: cool cyan -> warning amber -> glowing crimson
  let materialColor = "#06b6d4"; // nominal cyan
  let emissiveColor = "#083344";
  if (temp > 30 || (telemetry && telemetry.env_score > 0.4)) {
    materialColor = "#f59e0b"; // warning amber
    emissiveColor = "#78350f";
  }
  if (temp > 45 || isCritical || vibScore > 0.6) {
    materialColor = "#ef4444"; // critical red
    emissiveColor = "#991b1b";
  }

  return (
    <group ref={groupRef}>
      {/* Motor Body (Cylinder) */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[1, 1, 2, 32]} />
        <meshStandardMaterial 
          color={materialColor} 
          metalness={0.8} 
          roughness={0.2}
          emissive={emissiveColor}
          emissiveIntensity={isAnomalous ? 0.8 : 0.15}
        />
      </mesh>
      
      {/* Bearing Housing Ring */}
      <mesh position={[0, 0, 0.9]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.95, 0.08, 16, 32]} />
        <meshStandardMaterial 
          color={vibScore > 0.5 ? "#ef4444" : "#334155"} 
          emissive={vibScore > 0.5 ? "#dc2626" : "#0f172a"}
          emissiveIntensity={vibScore > 0.5 ? 1 : 0}
        />
      </mesh>

      {/* Front Plate */}
      <mesh position={[0, 0, 1.1]}>
        <cylinderGeometry args={[0.8, 0.8, 0.2, 32]} />
        <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.1} />
      </mesh>
      
      {/* Shaft */}
      <mesh position={[0, 0, 1.5]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 1, 16]} />
        <meshStandardMaterial color="#94a3b8" metalness={1} roughness={0} />
      </mesh>
    </group>
  );
}

export function MachineHealthCard({ telemetry }: MachineHealthCardProps) {
  const isAnomalous = telemetry && telemetry.fused_score > 0.7;
  const isCritical = telemetry && telemetry.fused_score > 0.85;
  const vibScore = telemetry?.vibration_score ?? 0.08;
  const vibrationG = vibScore * 4.5 + 0.02;
  const acousticDb = (telemetry?.audio_score ?? 0.09) * 60 + 35;
  const temp = telemetry?.env_temp ?? 22.1;

  return (
    <div className={`w-full h-[380px] bg-[#050505] rounded-3xl border transition-all duration-500 relative overflow-hidden group ${
      isCritical ? 'border-danger/80 shadow-[0_0_40px_rgba(239,68,68,0.25)]' :
      isAnomalous ? 'border-warning/80 shadow-[0_0_30px_rgba(245,158,11,0.2)]' :
      'border-border/50'
    }`}>
      
      {/* UI Overlay */}
      <div className="absolute top-6 left-6 z-10 pointer-events-none">
        <h3 className="text-lg font-bold text-white uppercase tracking-widest flex items-center gap-2">
          Interactive 3D Twin
        </h3>
        <p className="text-xs text-text-3 font-mono">REZON-01 · 2,400 RPM Induction Drive</p>
      </div>
      
      {/* Bottom HUD */}
      <div className="absolute bottom-6 left-6 z-10 flex flex-wrap gap-3 pointer-events-none">
        <div className="bg-surface/90 backdrop-blur border border-white/10 px-3 py-2 rounded-xl">
          <div className="text-[9px] uppercase text-text-3 font-bold mb-0.5">Casing Temp</div>
          <div className={`text-sm font-mono font-bold ${temp > 35 ? 'text-danger' : 'text-white'}`}>
            {temp.toFixed(1)}°C
          </div>
        </div>

        <div className="bg-surface/90 backdrop-blur border border-white/10 px-3 py-2 rounded-xl">
          <div className="text-[9px] uppercase text-text-3 font-bold mb-0.5">Vibration G-Force</div>
          <div className={`text-sm font-mono font-bold ${vibScore > 0.5 ? 'text-danger animate-pulse' : 'text-white'}`}>
            {vibrationG.toFixed(3)}g
          </div>
        </div>

        <div className="bg-surface/90 backdrop-blur border border-white/10 px-3 py-2 rounded-xl">
          <div className="text-[9px] uppercase text-text-3 font-bold mb-0.5">Acoustic Floor</div>
          <div className={`text-sm font-mono font-bold ${telemetry?.audio_score > 0.5 ? 'text-warning' : 'text-white'}`}>
            {acousticDb.toFixed(1)} dB
          </div>
        </div>
      </div>

      {/* Top Right Status Badge */}
      <div className="absolute top-6 right-6 z-10 flex flex-col items-end gap-2">
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-mono font-bold uppercase tracking-wider ${
          isCritical ? 'bg-danger/20 border-danger text-danger animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.5)]' :
          isAnomalous ? 'bg-warning/20 border-warning text-warning' :
          'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
        }`}>
          <span className={`w-2 h-2 rounded-full ${
            isCritical ? 'bg-danger' : isAnomalous ? 'bg-warning' : 'bg-emerald-400'
          }`} />
          {isCritical ? "CRITICAL ACTUATION" : isAnomalous ? "ANOMALY DETECTED" : "NOMINAL KINEMATICS"}
        </div>
      </div>

      {/* 3D Canvas */}
      <div className="w-full h-full cursor-grab active:cursor-grabbing">
        <Canvas camera={{ position: [0, 2, 5], fov: 45 }}>
          <ambientLight intensity={0.7} />
          <pointLight position={[10, 10, 10]} intensity={1.5} />
          <pointLight position={[-10, -10, -10]} intensity={0.5} />
          
          {/* Anomaly warning point light radiating onto the 3D twin */}
          {isAnomalous && (
            <pointLight position={[0, 0, 2]} intensity={3} color={isCritical ? "#ef4444" : "#f59e0b"} />
          )}

          <Float speed={2} rotationIntensity={0.2} floatIntensity={0.2}>
            <Motor3D telemetry={telemetry} />
          </Float>
          
          <ContactShadows position={[0, -1.5, 0]} opacity={0.6} scale={10} blur={2} far={4} />
          <OrbitControls enableZoom={false} enablePan={false} maxPolarAngle={Math.PI / 2} minPolarAngle={Math.PI / 4} />
          <Environment preset="city" />
        </Canvas>
      </div>

    </div>
  );
}
