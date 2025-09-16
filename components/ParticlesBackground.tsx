"use client";

import Particles from "react-tsparticles";
import { loadSlim } from "tsparticles-slim";
import { useCallback, useMemo } from "react";

// Load your particle config file
// Make sure this path is correct
const particlesConfig = require("../public/particlesjs-config.json");

export default function ParticlesBackground() {
  const particlesInit = useCallback(async (engine: any) => {
    await loadSlim(engine);
  }, []);

  const options = useMemo(() => {
    return particlesConfig;
  }, []);

  return (
    <div className="absolute inset-0 -z-10">
      <Particles id="tsparticles" init={particlesInit} options={options} />
    </div>
  );
}