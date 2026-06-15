/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from 'react';
import { BlochVector } from '../types.js';

interface BlochSphereProps {
  vector: BlochVector;
  qubitIndex: number;
}

export default function BlochSphere({ vector, qubitIndex }: BlochSphereProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<any>(null);
  const requestRef = useRef<number | null>(null);
  const [controlsState, setControlsState] = useState({ rotating: true });
  const [hoveredState, setHoveredState] = useState<string | null>(null);

  // Maintain references to update the vector dynamically without rebuilding the entire scene
  const arrowRef = useRef<any>(null);
  const targetPointRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Retrieve Three.js from the window global loaded via CDN
    const THREE = (window as any).THREE;
    if (!THREE) {
      console.error('Three.js was not found on window global.');
      return;
    }

    const width = containerRef.current.clientWidth || 300;
    const height = containerRef.current.clientHeight || 300;

    // 1. Create Scene
    const scene = new THREE.Scene();
    // Soft space-dark background
    scene.background = new THREE.Color(0x0b0f19); 

    // 2. Camera setup
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(4, 3, 5);

    // 3. WebGL Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Orbit Controls (loaded from CDN script)
    let controls: any = null;
    if (THREE.OrbitControls) {
      controls = new THREE.OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.maxDistance = 10;
      controls.minDistance = 2.5;
      // When the user interacts, disable self-rotation
      controls.addEventListener('start', () => {
        setControlsState({ rotating: false });
      });
    }

    // 5. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight1.position.set(5, 10, 7);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x38bdf8, 0.6); // cyan tint
    dirLight2.position.set(-5, -5, -5);
    scene.add(dirLight2);

    // 6. Draw Sphere Core
    // Scale factor: Qubit coordinates lie in [-1, 1]. We scale our Three.js drawings by 2.0.
    const sphereRadius = 2.0;

    // Main translucent wireframe sphere
    const sphereGeo = new THREE.SphereGeometry(sphereRadius, 32, 24);
    const sphereMat = new THREE.MeshPhongMaterial({
      color: 0x334155,
      transparent: true,
      opacity: 0.1,
      wireframe: true,
      depthWrite: false,
    });
    const sphere = new THREE.Mesh(sphereGeo, sphereMat);
    scene.add(sphere);

    // Outer solid sphere border / skin glow helper
    const outerSphereGeo = new THREE.SphereGeometry(sphereRadius, 32, 24);
    const outerSphereMat = new THREE.MeshBasicMaterial({
      color: 0x1e293b,
      transparent: true,
      opacity: 0.05,
      depthWrite: false,
    });
    const outerSphere = new THREE.Mesh(outerSphereGeo, outerSphereMat);
    scene.add(outerSphere);

    // 7. Reference Circles (Equator & Meridians)
    const createRing = (color: number, rotation: [number, number, number]) => {
      // RingGeometry or TorusGeometry
      const ringGeo = new THREE.TorusGeometry(sphereRadius, 0.015, 8, 100);
      const ringMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5 });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.set(...rotation);
      scene.add(ring);
    };

    // Equator ring: X-Y plane (corresponds to Three.js X-Z plane because Zqb/Yqb is mapped to Three.js Y)
    // Actually, qubit Z is Three.js Y. So Equator (z_qb = 0) is Three.js Y = 0 (X-Z plane).
    createRing(0x64748b, [Math.PI / 2, 0, 0]); // Slate equator

    // Meridian X-Z plane (y_qb = 0, corresponds to Three.js Z=0/X-Y plane)
    createRing(0x475569, [0, 0, 0]); 

    // Meridian Y-Z plane (x_qb = 0, corresponds to Three.js X=0/Y-Z plane)
    createRing(0x475569, [0, Math.PI / 2, 0]);

    // 8. Draw Coordinate Axes (X, Y, Z)
    // We use line helpers or cylindrical rods
    const drawAxis = (start: any, end: any, color: number) => {
      const points = [start, end];
      const axisGeo = new THREE.BufferGeometry().setFromPoints(points);
      const axisMat = new THREE.LineDashedMaterial({
        color,
        dashSize: 0.15,
        gapSize: 0.1,
      });
      const line = new THREE.Line(axisGeo, axisMat);
      line.computeLineDistances(); // Required for dashed lines
      scene.add(line);
    };

    // Recall Qubit maps:
    // Qubit X -> Three.js X
    // Qubit Y -> Three.js Z
    // Qubit Z -> Three.js Y
    drawAxis(new THREE.Vector3(-2.4, 0, 0), new THREE.Vector3(2.4, 0, 0), 0xf43f5e); // X Axis (Rose)
    drawAxis(new THREE.Vector3(0, 0, -2.4), new THREE.Vector3(0, 0, 2.4), 0x10b981); // Y Axis (Emerald)
    drawAxis(new THREE.Vector3(0, -2.4, 0), new THREE.Vector3(0, 2.4, 0), 0x3b82f6); // Z Axis (Blue)

    // Axis Labels sprites / point decorators
    const createPoleMarker = (pos: any, color: number) => {
      const ptGeo = new THREE.SphereGeometry(0.06, 16, 16);
      const ptMat = new THREE.MeshBasicMaterial({ color });
      const pt = new THREE.Mesh(ptGeo, ptMat);
      pt.position.copy(pos);
      scene.add(pt);
    };
    createPoleMarker(new THREE.Vector3(0, 2, 0), 0x3b82f6); // |0> pole (+Z)
    createPoleMarker(new THREE.Vector3(0, -2, 0), 0x3b82f6); // |1> pole (-Z)
    createPoleMarker(new THREE.Vector3(2, 0, 0), 0xf43f5e);  // |+> pole (+X)
    createPoleMarker(new THREE.Vector3(-2, 0, 0), 0xf43f5e); // |-> pole (-X)
    createPoleMarker(new THREE.Vector3(0, 0, 2), 0x10b981);  // |i+> pole (+Y)
    createPoleMarker(new THREE.Vector3(0, 0, -2), 0x10b981); // |i-> pole (-Y)


    // 9. State Vector Arrow (Dynamic)
    // Coordinate conversion:
    // Qubit (x, y, z) maps to Three.js (x, z, y) where qubit z is vertical.
    // Wait, let's map: x3d = xqb, y3d = zqb, z3d = yqb
    const x3d = vector.x;
    const y3d = vector.z; // vertical
    const z3d = vector.y;

    const origin = new THREE.Vector3(0, 0, 0);
    const targetDir = new THREE.Vector3(x3d, y3d, z3d);
    const len = targetDir.length();
    
    // Normalize target direction for ArrowHelper, but if length is 0 (mixed state), use up direction
    const dir = len > 0.0001 ? targetDir.clone().normalize() : new THREE.Vector3(0, 0, 1);
    const arrowLen = len * sphereRadius; // scaled

    // Qiskit Bloch Vector color is typically pinkish-red or neon purple. Let's use a gorgeous bright neon cyan or fuchsia!
    // We can color based on vector length: pure states = neon cyan, mixed states = violet
    const arrowColor = len > 0.95 ? 0x00f2fe : 0xa18cd1; 

    const arrow = new THREE.ArrowHelper(dir, origin, arrowLen, arrowColor, 0.45, 0.28);
    // make line thicker by adjusting linewidth (limited in WebGL, so we can also add a tiny sphere at the tip!)
    scene.add(arrow);
    arrowRef.current = arrow;

    // Pulse/Target dot marker at the Tip of the vector
    const tipGeo = new THREE.SphereGeometry(0.08, 16, 16);
    const tipMat = new THREE.MeshBasicMaterial({ color: 0x00f2fe });
    const tipMesh = new THREE.Mesh(tipGeo, tipMat);
    tipMesh.position.set(x3d * sphereRadius, y3d * sphereRadius, z3d * sphereRadius);
    scene.add(tipMesh);
    targetPointRef.current = tipMesh;

    // 10. Animation and Resize Handlers
    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || !entries[0]) return;
      const { width: newW, height: newH } = entries[0].contentRect;
      
      const cleanW = Math.max(newW, 200);
      const cleanH = Math.max(newH, 200);
      
      if (rendererRef.current) {
        rendererRef.current.setSize(cleanW, cleanH);
      }
      camera.aspect = cleanW / cleanH;
      camera.updateProjectionMatrix();
    });
    resizeObserver.observe(containerRef.current);

    // Group for gentle aesthetic spin
    const groupToRotate = new THREE.Group();
    groupToRotate.add(sphere);
    groupToRotate.add(outerSphere);
    // Keep internal axes and vector stationary relative to world coordinate directions
    scene.add(groupToRotate);

    const animate = () => {
      if (controls) {
        controls.update();
      }

      // If idle and rotating enabled, gently revolve camera or sphere
      if (controlsState.rotating) {
        // Revolving the core mesh grid lines slightly
        sphere.rotation.y += 0.002;
        outerSphere.rotation.y += 0.002;
      }

      renderer.render(scene, camera);
      requestRef.current = requestAnimationFrame(animate);
    };

    animate();

    // Clean up
    return () => {
      resizeObserver.disconnect();
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
      if (controls) {
        controls.dispose();
      }
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
      // dispose geometries/materials
      sphereGeo.dispose();
      sphereMat.dispose();
      outerSphereGeo.dispose();
      outerSphereMat.dispose();
      tipGeo.dispose();
      tipMat.dispose();
      renderer.dispose();
    };
  }, [controlsState.rotating]);

  // Update vector coordinates dynamically when vector changes
  useEffect(() => {
    const THREE = (window as any).THREE;
    if (!THREE) return;

    const x3d = vector.x;
    const y3d = vector.z; // vertical mapping (qubit Z is vertical)
    const z3d = vector.y;

    const targetDir = new THREE.Vector3(x3d, y3d, z3d);
    const len = targetDir.length();
    const dir = len > 0.0001 ? targetDir.clone().normalize() : new THREE.Vector3(0, 0, 1);
    
    const sphereRadius = 2.0;
    const arrowLen = len * sphereRadius;

    // Update state vector arrow
    if (arrowRef.current) {
      arrowRef.current.setDirection(dir);
      arrowRef.current.setLength(arrowLen, 0.45, 0.28);
      // change color to demonstrate mixed state visually
      if (len < 0.95) {
        arrowRef.current.setColor(new THREE.Color(0xd4af37)); // gold for mixed states
      } else {
        arrowRef.current.setColor(new THREE.Color(0x00f2fe)); // cyan for pure state
      }
    }

    // Update terminal point dot
    if (targetPointRef.current) {
      targetPointRef.current.position.set(x3d * sphereRadius, y3d * sphereRadius, z3d * sphereRadius);
      if (len < 0.95) {
        targetPointRef.current.material.color.setHex(0xd4af37);
      } else {
        targetPointRef.current.material.color.setHex(0x00f2fe);
      }
    }
  }, [vector]);

  return (
    <div className="relative w-full h-full flex flex-col bg-[#0b0f19] rounded-xl overflow-hidden border border-slate-800">
      {/* 3D Container Canvas */}
      <div id="canvas-container" ref={containerRef} className="w-full flex-grow min-h-[300px] cursor-grab active:cursor-grabbing" />

      {/* Axis/State overlay tags on coordinate limits */}
      <div className="absolute inset-0 pointer-events-none select-none text-xs p-3 flex flex-col justify-between">
        <div className="flex justify-between items-start">
          <div className="bg-[#1e293b]/70 backdrop-blur-md px-2 py-1 rounded border border-slate-700/50 text-[10px] font-mono text-slate-400">
            QUBIT q_{qubitIndex}
          </div>
          <div className="bg-blue-900/40 text-blue-300 px-2.5 py-1 rounded-full text-[10px] font-mono flex items-center gap-1.5 border border-blue-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            Live 3D Renderer
          </div>
        </div>

        {/* Legend Overlay of major poles */}
        <div className="grid grid-cols-3 gap-1 bg-[#1e293b]/80 backdrop-blur-md p-2 rounded-lg border border-slate-700 text-[10px] font-mono leading-tight pointer-events-auto">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded bg-blue-500 inline-block" />
            <span className="text-slate-300">Z-Axis:</span>
            <span className="text-slate-400">|0⟩ up, |1⟩ down</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded bg-rose-500 inline-block" />
            <span className="text-slate-300">X-Axis:</span>
            <span className="text-slate-400">|+⟩ forward</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded bg-emerald-500 inline-block" />
            <span className="text-slate-300">Y-Axis:</span>
            <span className="text-slate-400">|r+⟩ right</span>
          </div>
        </div>
      </div>

      {/* Vector current values widget at the bottom right */}
      <div className="absolute top-12 left-3 bg-[#1e293b]/90 backdrop-blur-md p-3 rounded-lg border border-slate-700 pointer-events-auto flex flex-col gap-1 font-mono text-xs">
        <div className="text-slate-400 text-[10px] font-bold tracking-wider uppercase mb-1">State Coordinates</div>
        <div className="flex justify-between gap-4">
          <span className="text-rose-400">x = {vector.x.toFixed(4)}</span>
          <span className="text-emerald-400">y = {vector.y.toFixed(4)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-blue-400">z = {vector.z.toFixed(4)}</span>
          <span className="text-amber-400">Purity (r) = {vector.r.toFixed(4)}</span>
        </div>
        {vector.r < 0.99 && (
          <div className="text-[10px] text-amber-300/80 mt-1 max-w-[150px] leading-tight">
            ⚠ Mixed state (r &lt; 1) indicating quantum entanglement.
          </div>
        )}
      </div>

      {/* Interaction Help Overlay */}
      <div className="absolute bottom-16 right-3 pointer-events-none">
        <div className="bg-[#1e293b]/50 text-[10px] text-slate-400 px-2 py-1 rounded font-mono">
          Drag to Rotate • Zoom with Scroll
        </div>
      </div>

      {controlsState.rotating ? (
        <button
          onClick={() => setControlsState({ rotating: false })}
          className="absolute bottom-16 left-3 bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-500/30 text-[10px] text-indigo-200 px-2 py-1 rounded font-mono cursor-pointer transition"
        >
          Disable Auto-Rotation
        </button>
      ) : (
        <button
          onClick={() => setControlsState({ rotating: true })}
          className="absolute bottom-16 left-3 bg-slate-800/85 hover:bg-slate-700 border border-slate-600/30 text-[10px] text-slate-300 px-2 py-1 rounded font-mono cursor-pointer transition"
        >
          Enable Auto-Rotation
        </button>
      )}
    </div>
  );
}
