// Copyright (C) 2026 Johandi Arifiansyach

import { Canvas, useThree } from "@react-three/fiber";
import { MeshTransmissionMaterial, RoundedBox } from "@react-three/drei";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { OrthographicCamera } from "three";

/**
 * Material values used by the Fluid Glass `bar` preset.  Keeping these in one
 * place makes the visual treatment of the mobile dock and desktop rail match
 * while the DOM content remains crisp and interactive above the canvas.
 */
export const FLUID_GLASS_BAR_MATERIAL = {
  mode: "bar" as const,
  ior: 1.15,
  chromaticAberration: 0.1,
  transmission: 1,
  scale: 0.15,
  thickness: 10,
  anisotropy: 0.01,
  roughness: 0,
};

export type FluidGlassSurfaceProps = {
  className?: string;
  style?: CSSProperties;
  radius?: number;
  mode?: "bar";
};

function canRenderFluidGlass() {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(prefers-reduced-transparency: reduce)")?.matches) {
    return false;
  }

  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

function FluidGlassMesh({ radius }: { radius: number }) {
  const { camera, size } = useThree();
  const width = Math.max(size.width, 1);
  const height = Math.max(size.height, 1);
  const scale = FLUID_GLASS_BAR_MATERIAL.scale;

  useEffect(() => {
    const ortho = camera as OrthographicCamera;
    ortho.left = -width / 2;
    ortho.right = width / 2;
    ortho.top = height / 2;
    ortho.bottom = -height / 2;
    ortho.near = 0.1;
    ortho.far = 100;
    ortho.updateProjectionMatrix();
  }, [camera, height, width]);

  return (
    <>
      <ambientLight intensity={0.75} />
      <directionalLight position={[2, 4, 4]} intensity={1.1} />
      <group scale={scale}>
        <RoundedBox
          args={[width / scale, height / scale, Math.max(8, Math.min(20, height / 5)) / scale]}
          radius={Math.min(radius, height / 2) / scale}
          smoothness={8}
          position={[0, 0, 0]}
        >
          <MeshTransmissionMaterial
            transmission={FLUID_GLASS_BAR_MATERIAL.transmission}
            ior={FLUID_GLASS_BAR_MATERIAL.ior}
            thickness={FLUID_GLASS_BAR_MATERIAL.thickness}
            anisotropy={FLUID_GLASS_BAR_MATERIAL.anisotropy}
            chromaticAberration={FLUID_GLASS_BAR_MATERIAL.chromaticAberration}
            roughness={FLUID_GLASS_BAR_MATERIAL.roughness}
            color="#ffffff"
            attenuationColor="#ffffff"
            attenuationDistance={0.25}
            transparent
          />
        </RoundedBox>
      </group>
    </>
  );
}

/**
 * A lightweight Fluid Glass surface. The CSS layer provides the dependable
 * backdrop-filter fallback (including Safari/Firefox), while the optional R3F
 * layer adds the transmission highlight and chromatic edge on WebGL devices.
 * It is intentionally pointer-events-none so navigation controls never lose
 * their normal hit targets.
 */
export default function FluidGlassSurface({
  className = "",
  style,
  radius = 24,
  mode = "bar",
}: FluidGlassSurfaceProps) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [webglEnabled, setWebglEnabled] = useState(false);

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;

    let lastVisible = false;
    const updateVisibility = () => {
      const rect = surface.getBoundingClientRect();
      const visible = rect.width > 0 && rect.height > 0;
      if (visible !== lastVisible) {
        lastVisible = visible;
        setWebglEnabled(visible && canRenderFluidGlass());
      }
    };

    updateVisibility();
    const observer = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(updateVisibility);
    observer?.observe(surface);
    window.addEventListener("resize", updateVisibility, { passive: true });
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateVisibility);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      ref={surfaceRef}
      className={`fluid-glass-surface pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      style={style}
      data-fluid-glass-mode={mode}
      data-fluid-glass-ior={FLUID_GLASS_BAR_MATERIAL.ior}
      data-fluid-glass-transmission={FLUID_GLASS_BAR_MATERIAL.transmission}
      data-fluid-glass-scale={FLUID_GLASS_BAR_MATERIAL.scale}
      data-fluid-glass-thickness={FLUID_GLASS_BAR_MATERIAL.thickness}
      data-fluid-glass-anisotropy={FLUID_GLASS_BAR_MATERIAL.anisotropy}
      data-fluid-glass-roughness={FLUID_GLASS_BAR_MATERIAL.roughness}
      data-fluid-glass-chromatic-aberration={FLUID_GLASS_BAR_MATERIAL.chromaticAberration}
    >
      <span className="fluid-glass-css-layer absolute inset-0 rounded-[inherit]" />
      <span className="fluid-glass-highlight absolute inset-px rounded-[inherit]" />
      {webglEnabled ? (
        <Canvas
          orthographic
          dpr={[1, 1.5]}
          frameloop="demand"
          gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
          camera={{ position: [0, 0, 10], zoom: 1 }}
          className="absolute inset-0 h-full w-full"
          style={{ pointerEvents: "none" }}
        >
          <FluidGlassMesh radius={radius} />
        </Canvas>
      ) : null}
    </div>
  );
}
