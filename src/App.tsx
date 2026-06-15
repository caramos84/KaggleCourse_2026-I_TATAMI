/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { 
  Cpu, 
  Layers, 
  RotateCcw, 
  Plus, 
  Trash2, 
  Info, 
  Sparkles, 
  Activity, 
  BookOpen,
  ArrowRight,
  HelpCircle,
  Play
} from 'lucide-react';
import { Gate, GateType, SimulationResponse, BlochVector } from './types.js';
import BlochSphere from './components/BlochSphere.tsx';

// Preset configurations
interface Preset {
  name: string;
  description: string;
  numQubits: number;
  gates: Omit<Gate, 'id'>[];
}

const PRESETS: Record<string, Preset> = {
  superposition: {
    name: 'Single Qubit Superposition',
    description: 'Applies a Hadamard (H) gate to rotate |0⟩ to the equator, placing it in a 50/50 state of $|00\\dots\\rangle$ and $|01\\dots\\rangle$.',
    numQubits: 1,
    gates: [{ type: 'H', target: 0 }],
  },
  bellState: {
    name: '2-Qubit Bell State (Entanglement)',
    description: 'Entangles q_0 and q_1 using a Hadamard followed by a CNOT (CX). Notice how the Bloch vector collapses inside the sphere (length = 0), a hallmark of full entanglement.',
    numQubits: 2,
    gates: [
      { type: 'H', target: 0 },
      { type: 'CX', target: 1, control: 0 }
    ],
  },
  ghzState: {
    name: '3-Qubit GHZ State',
    description: 'An entangled state of 3 qubits: (|000⟩ + |111⟩)/√2. The Bloch vectors of all qubits collapse completely as they are fully correlated.',
    numQubits: 3,
    gates: [
      { type: 'H', target: 0 },
      { type: 'CX', target: 1, control: 0 },
      { type: 'CX', target: 2, control: 1 }
    ],
  },
  tRotation: {
    name: 'Z-Axis Rotation (H + T Gate)',
    description: 'Rotates the qubit to the equator with H, then rotates it around the Z-axis by 45° (π/4 rad) using the T gate. Watch the vector move along the equator.',
    numQubits: 1,
    gates: [
      { type: 'H', target: 0 },
      { type: 'T', target: 0 }
    ],
  },
  phaseKickback: {
    name: 'Quantum Phase Kickback',
    description: 'Demonstrates phase properties where a target in the |−⟩ state "kicks back" a phase of −1 to the control qubit upon a controlled operation.',
    numQubits: 2,
    gates: [
      { type: 'X', target: 1 },
      { type: 'H', target: 0 },
      { type: 'H', target: 1 },
      { type: 'CX', target: 1, control: 0 }
    ],
  },
};

export default function App() {
  // App Core State
  const [numQubits, setNumQubits] = useState<number>(2);
  const [gates, setGates] = useState<Gate[]>([
    { id: 'g-1', type: 'H', target: 0 },
    { id: 'g-2', type: 'CX', target: 1, control: 0 },
  ]);
  const [selectedQubit, setSelectedQubit] = useState<number>(0);
  const [simResult, setSimResult] = useState<SimulationResponse | null>(null);
  const [simLoading, setSimLoading] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Gate Builder Form State
  const [formGateType, setFormGateType] = useState<GateType>('H');
  const [formTarget, setFormTarget] = useState<number>(0);
  const [formControl, setFormControl] = useState<number>(1);
  const [formParam, setFormParam] = useState<number>(Math.PI / 2); // default rotation to 90 deg (pi/2)

  // Educational Concept State
  const [activeConcept, setActiveConcept] = useState<'basics' | 'gates' | 'bloch' | 'entanglement'>('basics');

  // Load Preset Circuit
  const applyPreset = (key: keyof typeof PRESETS) => {
    const preset = PRESETS[key];
    setNumQubits(preset.numQubits);
    setSelectedQubit(0);
    // Add unique IDs
    const instantiatedGates = preset.gates.map((g, idx) => ({
      ...g,
      id: `preset-${key}-${Date.now()}-${idx}`
    }));
    setGates(instantiatedGates);
  };

  // Trigger quantum simulation on the backend Express server
  const runSimulation = async () => {
    setSimLoading(true);
    setApiError(null);
    try {
      const response = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numQubits, gates }),
      });
      const data: SimulationResponse = await response.json();
      if (data.success) {
        setSimResult(data);
      } else {
        setApiError(data.error || 'The backend simulation encountered an error.');
      }
    } catch (err: any) {
      setApiError(err.message || 'Failed connecting to server simulation endpoint.');
    } finally {
      setSimLoading(false);
    }
  };

  // Execute simulation whenever circuit parameters shift
  useEffect(() => {
    runSimulation();
  }, [numQubits, gates]);

  // Adjust selections on number of qubits shift
  useEffect(() => {
    if (selectedQubit >= numQubits) {
      setSelectedQubit(0);
    }
    // Update target/control form limits safely
    if (formTarget >= numQubits) {
      setFormTarget(0);
    }
    if (formControl >= numQubits) {
      setFormControl(Math.max(0, numQubits - 1));
    }
  }, [numQubits]);

  // Add customized gate to sequence
  const handleAddGate = () => {
    const requiresControl = ['CX', 'CZ', 'SWAP'].includes(formGateType);
    const requiresParam = ['Rx', 'Ry', 'Rz'].includes(formGateType);

    if (requiresControl && formTarget === formControl) {
      alert('Target and Control qubits must be different for multi-qubit operations.');
      return;
    }

    const newGate: Gate = {
      id: `gate-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      type: formGateType,
      target: formTarget,
      control: requiresControl ? formControl : undefined,
      param: requiresParam ? formParam : undefined,
    };

    setGates([...gates, newGate]);
  };

  // Clear entire circuit list
  const handleClearCircuit = () => {
    setGates([]);
  };

  // Delete single gate in circuit list
  const handleDeleteGate = (id: string) => {
    setGates(gates.filter(g => g.id !== id));
  };

  // Shift selected Qubit Bloch vector view
  const currentBlochVector: BlochVector = simResult?.blochVectors?.[selectedQubit] || { x: 0, y: 0, z: 1, r: 1 };

  return (
    <div className="min-h-screen text-slate-300 bg-[#0B0F19] font-sans flex flex-col selection:bg-cyan-500/20 selection:text-cyan-300 relative">
      
      {/* 🚀 Top Navigation / Header */}
      <header id="app-header" className="h-14 border-b border-slate-800 bg-[#0F172A] flex items-center justify-between px-6 shrink-0 sticky top-0 z-40 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-indigo-600 rounded flex items-center justify-center shadow-lg shadow-cyan-900/25">
            <Cpu className="w-5 h-5 text-white" />
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold tracking-tight text-white font-display">
              Quantum<span className="text-cyan-400">Sim</span>
            </h1>
            <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700/50 leading-none">
              v2.4.1
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-slate-800/50 border border-slate-700 rounded-full text-[10px] font-mono">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            <span className="text-slate-400 uppercase tracking-widest font-bold">Simulator Online</span>
          </div>
          <button 
            onClick={runSimulation} 
            className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-semibold text-xs transition duration-150 shadow-md uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
          >
            <Play className="w-3 h-3" /> Execute Circuit
          </button>
        </div>
      </header>

      {/* 🔮 Workspace Panels */}
      <main className="flex-1 flex flex-col gap-6 p-4 lg:p-6 max-w-7xl w-full mx-auto overflow-x-hidden relative">
        {/* Subtle radial patterns on background */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#64748b 1px, transparent 1px)', backgroundSize: '32px 32px' }}></div>
        
        {/* 1. Presets Header Section */}
        <section className="bg-[#0F172A] border border-slate-800/85 rounded-xl p-5 shadow-xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 relative z-10">
          <div className="flex flex-col gap-1">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> Presets Control Deck
            </h2>
            <p className="text-[11px] text-slate-500 font-sans">Select a classical quantum state formulation to inspect traces on the Bloch sphere.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => applyPreset('superposition')}
              className="px-3 py-1.5 rounded-lg bg-slate-800/50 hover:bg-slate-700/80 border border-slate-700/40 text-xs font-medium text-slate-200 transition duration-150 cursor-pointer"
            >
              Hadamard Superposition
            </button>
            <button
              onClick={() => applyPreset('bellState')}
              className="px-3 py-1.5 rounded-lg bg-indigo-950/40 hover:bg-indigo-900/60 border border-indigo-900 text-xs font-medium text-indigo-200 transition duration-150 cursor-pointer"
            >
              Bell Entanglement
            </button>
            <button
              onClick={() => applyPreset('ghzState')}
              className="px-3 py-1.5 rounded-lg bg-slate-800/50 hover:bg-slate-700/80 border border-slate-700/40 text-xs font-medium text-slate-200 transition duration-150 cursor-pointer"
            >
              3-Qubit GHZ State
            </button>
            <button
              onClick={() => applyPreset('tRotation')}
              className="px-3 py-1.5 rounded-lg bg-slate-800/50 hover:bg-slate-700/80 border border-slate-700/40 text-xs font-medium text-slate-200 transition duration-150 cursor-pointer"
            >
              H + T Rotation
            </button>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10 w-full flex-grow items-start">
          
          {/* ================= LEFT SIDE WORKSPACE (CONFIG & CONTROLS) ================= */}
          <div className="col-span-1 lg:col-span-5 flex flex-col gap-6">

            {/* Qubit Density Setup */}
            <section id="qubit-setup" className="bg-[#0F172A] border border-slate-800/85 rounded-xl p-5 flex flex-col gap-4 shadow-xl">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <span className="w-1.5 h-3 rounded-sm bg-cyan-500 inline-block" />
                1. Qubit Registry Setup
              </h2>
              <div className="flex items-center justify-between border-t border-slate-800/40 pt-3">
                <span className="text-xs text-slate-400">Total Simulated Qubits:</span>
                <div className="flex gap-1 bg-[#0B0F19] p-1 rounded-lg border border-slate-800/80">
                  {[1, 2, 3].map((num) => (
                    <button
                      key={num}
                      onClick={() => setNumQubits(num)}
                      className={`px-3 py-1.5 rounded-md text-xs font-mono transition-all font-bold cursor-pointer ${
                        numQubits === num
                          ? 'bg-slate-800 border border-slate-700 text-cyan-300 shadow-md'
                          : 'text-slate-400 hover:text-slate-205 hover:bg-[#0B0F19]'
                      }`}
                    >
                      {num} Qubit{num > 1 ? 's' : ''}
                    </button>
                  ))}
                </div>
              </div>
              <div className="text-[11px] text-slate-500 leading-normal font-mono">
                The backend framework mounts {numQubits} qubits, producing a computational Hilbert space of size 2<sup>{numQubits}</sup> = {1 << numQubits} basis vectors.
              </div>
            </section>

            {/* Gate Addition Tool */}
            <section id="gate-add" className="bg-[#0F172A] border border-slate-800/85 rounded-xl p-5 flex flex-col gap-4 shadow-xl">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <span className="w-1.5 h-3 rounded-sm bg-cyan-500 inline-block" />
                2. Inject Quantum Gate
              </h2>

              {/* Select Gate Type Grid */}
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 border-t border-slate-800/40 pt-3">
                <div className="col-span-full mb-1 text-[10px] text-slate-500 font-bold uppercase tracking-wider">Single-Qubit Gate Box</div>
                {(['I', 'X', 'Y', 'Z', 'H', 'S', 'T', 'Sdg', 'Tdg', 'Rx', 'Ry', 'Rz'] as GateType[]).map((gate) => (
                  <button
                    key={gate}
                    onClick={() => setFormGateType(gate)}
                    className={`py-2 rounded font-mono border transition duration-150 flex flex-col items-center justify-center cursor-pointer ${
                      formGateType === gate
                        ? 'bg-slate-800 border-cyan-500/80 text-cyan-300 font-bold shadow-[0_0_12px_rgba(6,182,212,0.15)] animate-[pulse_2s_infinite]'
                        : 'bg-[#0B0F19]/60 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    <span className="text-xs">{gate}</span>
                  </button>
                ))}

                <div className="col-span-full my-2 border-t border-slate-800/30" />

                <div className="col-span-full mb-1 text-[10px] text-slate-500 font-bold uppercase tracking-wider">Controlled Operands</div>
                {(['CX', 'CZ', 'SWAP'] as GateType[]).map((gate) => (
                  <button
                    key={gate}
                    onClick={() => setFormGateType(gate)}
                    className={`col-span-2 py-2 rounded font-mono border transition duration-150 flex flex-col items-center justify-center cursor-pointer ${
                      formGateType === gate
                        ? 'bg-slate-800 border-indigo-500/80 text-indigo-300 font-bold shadow-[0_0_12px_rgba(99,102,241,0.15)]'
                        : 'bg-[#0B0F19]/60 border-slate-800/80 text-slate-400 hover:text-slate-205 hover:border-slate-700'
                    }`}
                  >
                    <span className="text-xs">{gate === 'CX' ? 'CNOT (CX)' : gate}</span>
                  </button>
                ))}
              </div>

              {/* Config Gate Options (Target, Control, Param) */}
              <div className="mt-1 bg-[#0B0F19]/40 p-4 rounded-xl border border-slate-800/70 flex flex-col gap-3.5">
                
                {/* Target Qubit Select */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                    Target Qubit:
                    <span className="text-[10px] text-slate-500 font-mono">(active point)</span>
                  </span>
                  <div className="flex gap-1 bg-[#0B0F19] p-0.5 rounded border border-slate-800">
                    {Array.from({ length: numQubits }).map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setFormTarget(idx)}
                        className={`px-2.5 py-1 text-xs font-mono rounded cursor-pointer transition ${
                          formTarget === idx
                            ? 'bg-slate-80s bg-slate-850 border border-slate-700 text-cyan-300 font-bold'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        q_{idx}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Show Control option if multi-qubit gate */}
                {['CX', 'CZ', 'SWAP'].includes(formGateType) && (
                  <div className="flex items-center justify-between border-t border-slate-800/30 pt-2">
                    <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                      {formGateType === 'SWAP' ? 'Partner Qubit:' : 'Control Qubit:'}
                      <span className="text-[10px] text-slate-500 font-mono">(trigger source)</span>
                    </span>
                    <div className="flex gap-1 bg-[#0B0F19] p-0.5 rounded border border-slate-805">
                      {Array.from({ length: numQubits }).map((_, idx) => (
                        <button
                          key={idx}
                          disabled={idx === formTarget}
                          onClick={() => setFormControl(idx)}
                          className={`px-2.5 py-1 text-xs font-mono rounded select-none cursor-pointer transition ${
                            idx === formTarget
                              ? 'opacity-25 bg-transparent text-slate-600 line-through cursor-not-allowed'
                              : formControl === idx
                              ? 'bg-slate-850 border border-slate-700 text-indigo-300 font-bold'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          q_{idx}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Angle parameter slides if rotated Rx/Ry/Rz */}
                {['Rx', 'Ry', 'Rz'].includes(formGateType) && (
                  <div className="flex flex-col gap-2 border-t border-slate-800/30 pt-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-slate-400">Phase Angle (θ):</span>
                      <span className="font-mono text-cyan-300 text-[10px] bg-[#0B0F19] px-2 py-0.5 rounded border border-slate-800">
                        {(formParam / Math.PI).toFixed(2)}π rad ({Math.round(formParam * (180 / Math.PI))}°)
                      </span>
                    </div>
                    <input
                      type="range"
                      min={-2 * Math.PI}
                      max={2 * Math.PI}
                      step={Math.PI / 12}
                      value={formParam}
                      onChange={(e) => setFormParam(parseFloat(e.target.value))}
                      className="w-full accent-cyan-400 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                      <span>-2π (-360°)</span>
                      <span>0</span>
                      <span>2π (360°)</span>
                    </div>
                    <div className="grid grid-cols-4 gap-1 mt-1">
                      {[Math.PI / 4, Math.PI / 2, Math.PI, 2 * Math.PI].map((p, pIdx) => {
                        const labels = ['π/4', 'π/2', 'π', '2π'];
                        return (
                          <button
                            key={pIdx}
                            onClick={() => setFormParam(p)}
                            className="py-1 text-[10px] font-mono rounded bg-[#0B0F19] border border-slate-800 text-slate-400 hover:text-slate-205 cursor-pointer transition"
                          >
                            {labels[pIdx]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Trigger Inject Button */}
              <button
                onClick={handleAddGate}
                className="w-full mt-1 bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2.5 px-4 rounded-lg text-xs shadow-md shadow-cyan-950/20 flex items-center justify-center gap-2 hover:scale-[1.01] transition duration-150 uppercase tracking-wider cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Inject Qubit Gate
              </button>
            </section>

            {/* Circuit Gates Sequence List */}
            <section id="gate-sequence" className="bg-[#0F172A] border border-slate-800/85 rounded-xl p-5 flex flex-col gap-4 flex-grow min-h-[250px] shadow-xl">
              <div className="flex justify-between items-center">
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <span className="w-1.5 h-3 rounded-sm bg-cyan-500 inline-block" />
                  3. Circuit Gates Sequence ({gates.length})
                </h2>
                {gates.length > 0 && (
                  <button
                    onClick={handleClearCircuit}
                    className="text-[10px] font-bold text-rose-400 hover:text-rose-300 border border-rose-500/20 hover:border-rose-500/40 bg-rose-500/5 px-2 py-1 rounded flex items-center gap-1 transition cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" /> Clear Register
                  </button>
                )}
              </div>

              {/* List container */}
              <div className="flex-grow overflow-y-auto max-h-[350px] pr-1 flex flex-col gap-1.5">
                {gates.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center border border-dashed border-slate-800/80 rounded-lg p-6 text-center text-slate-400">
                    <Layers className="w-7 h-7 text-slate-600 mb-2.5 stroke-[1.5]" />
                    <span className="text-xs font-bold">Assemble Sequence</span>
                    <p className="text-[11px] text-slate-500 mt-1 max-w-[200px]">Perform operations or choose a ready pattern above to observe results.</p>
                  </div>
                ) : (
                  gates.map((gate, index) => {
                    const isControlled = ['CX', 'CZ', 'SWAP'].includes(gate.type);
                    return (
                      <div 
                        key={gate.id}
                        className="bg-[#0B0F19]/85 border border-slate-800/85 hover:border-slate-700/80 p-2.5 rounded-lg flex items-center justify-between group transition duration-150"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-mono text-slate-500 bg-[#0B0F19] w-4.5 h-4.5 rounded-full flex items-center justify-center border border-slate-800 font-bold">
                            {index + 1}
                          </span>
                          
                          {/* Gate Visual Icon Badge */}
                          <div className={`w-8 h-8 rounded flex flex-col items-center justify-center font-mono text-xs font-extrabold ${
                            isControlled 
                              ? 'bg-indigo-950/40 text-indigo-300 border border-indigo-900/50' 
                              : 'bg-cyan-950/40 text-cyan-200 border border-cyan-900/50'
                          }`}>
                            {gate.type}
                          </div>

                          {/* Description */}
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-205 font-mono">
                              {gate.type === 'CX' ? 'CNOT' : gate.type} {gate.param !== undefined ? `(${(gate.param/Math.PI).toFixed(2)}π)` : ''}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              target: <strong className="text-cyan-400 font-semibold">q_{gate.target}</strong>
                              {isControlled && (
                                <> • {gate.type === 'SWAP' ? 'partner' : 'control'}: <strong className="text-indigo-400 font-semibold">q_{gate.control}</strong></>
                              )}
                            </span>
                          </div>
                        </div>

                        {/* Delete node trigger */}
                        <button
                          onClick={() => handleDeleteGate(gate.id)}
                          className="p-1.5 rounded bg-[#0B0F19] hover:bg-rose-500/10 group-hover:opacity-100 text-slate-500 hover:text-rose-400 border border-slate-800/80 hover:border-rose-500/20 transition cursor-pointer"
                          title="Subtract logic"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </section>

          </div>

          {/* ================= RIGHT SIDE WORKSPACE (3D VIZ & SCHEMATIC MATHS) ================= */}
          <div className="col-span-1 lg:col-span-7 flex flex-col gap-6">
            
            {/* Active Error Alerts */}
            {apiError && (
              <div className="bg-rose-955 bg-rose-950/40 border border-rose-500/30 rounded-xl p-4 text-rose-200 text-xs flex items-start gap-3 shadow-lg relative z-20">
                <span className="bg-rose-500/20 p-1.5 rounded-lg text-rose-400">⚠</span>
                <div className="flex-grow">
                  <h4 className="font-bold text-rose-300 uppercase tracking-wide text-[10px] mb-0.5">Execution Error</h4>
                  <p>{apiError}</p>
                  <button 
                    onClick={runSimulation}
                    className="mt-2 text-rose-400 hover:text-rose-300 font-bold underline text-[10.5px] uppercase font-mono cursor-pointer"
                  >
                    Recalculate
                  </button>
                </div>
              </div>
            )}

            {/* 3D Render Canvas Section */}
            <section id="visualizer-container" className="flex flex-col gap-3 relative z-10 w-full">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Activity className="w-4 h-4 text-cyan-400 animate-pulse" />
                    Live Qubit Bloch Spheres
                  </h3>
                  <p className="text-[11px] text-slate-500">Continuous trace values calculated programmatic server module.</p>
                </div>

                {/* Tab selectors for multi qubits */}
                {numQubits > 1 && (
                  <div className="flex gap-1 bg-[#0F172A] p-1 rounded-lg border border-slate-800/85 shadow-md">
                    {Array.from({ length: numQubits }).map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedQubit(idx)}
                        className={`px-3 py-1 text-xs font-mono rounded font-bold transition-all cursor-pointer ${
                          selectedQubit === idx
                            ? 'bg-slate-800 border border-slate-700 text-cyan-300 shadow-sm'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Active View: q_{idx}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Container for Bloch Sphere */}
              <div className="h-[430px] w-full shadow-2xl rounded-xl overflow-hidden border border-slate-800/80 bg-[#0B0F19]">
                <BlochSphere vector={currentBlochVector} qubitIndex={selectedQubit} />
              </div>
            </section>

            {/* ASCII Wire Schema Diagram */}
            <section id="ascii-section" className="bg-[#0F172A] border border-slate-800/85 rounded-xl p-5 flex flex-col gap-3.5 shadow-xl">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <span className="w-1.5 h-3 rounded-sm bg-indigo-500 inline-block" />
                Qiskit-Style Wire Diagram (ASCII)
              </h3>
              
              <div className="bg-[#0B0F19] p-4 rounded-lg border border-slate-800/60 font-mono text-xs overflow-x-auto text-[#10B981]/90 leading-relaxed shadow-inner">
                {simResult?.asciiDiagram ? (
                  <pre className="whitespace-pre min-w-max select-all font-bold tracking-widest">{simResult.asciiDiagram}</pre>
                ) : (
                  <div className="text-slate-550 italic py-2 text-center text-xs">No active schema state available.</div>
                )}
              </div>
            </section>

            {/* State Vector & Probabilities Mathematical Table */}
            <section id="state-amplitudes" className="bg-[#0F172A] border border-slate-800/85 rounded-xl p-5 flex flex-col gap-4 shadow-xl">
              <h3 className="text-xs font-bold text-slate-405 uppercase tracking-widest flex items-center gap-2">
                <span className="w-1.5 h-3 rounded-sm bg-cyan-500 inline-block" />
                State Vector & Measurement Probabilities
              </h3>

              {/* List Table */}
              <div className="border border-slate-800/60 rounded-xl overflow-hidden bg-[#0B0F19]/40">
                <div className="grid grid-cols-12 gap-2 bg-[#0B0F19] px-4 py-3 text-[10px] font-mono tracking-wider font-bold text-slate-500 uppercase border-b border-slate-800/50">
                  <div className="col-span-3">Basis Coordinate</div>
                  <div className="col-span-4">Complex Value (α / β)</div>
                  <div className="col-span-5">Measurement Probability</div>
                </div>

                <div className="divide-y divide-slate-800/30 font-mono text-xs">
                  {simResult?.basisStates?.map((basis) => {
                    const probPercent = (basis.probability * 100).toFixed(2);
                    const isNonZero = basis.probability > 0.005;

                    // Format number safely
                    const fmtComplex = (c: { r: number; i: number }) => {
                      const r = c.r.toFixed(4);
                      const i = c.i.toFixed(4);
                      if (Math.abs(c.r) < 0.0001 && Math.abs(c.i) < 0.0001) return '0.0000';
                      if (Math.abs(c.i) < 0.0001) return `${r}`;
                      if (Math.abs(c.r) < 0.0001) return `${i}i`;
                      return `${r} ${c.i >= 0 ? '+' : '-'} ${Math.abs(c.i).toFixed(4)}i`;
                    };

                    return (
                      <div 
                        key={basis.index}
                        className={`grid grid-cols-12 gap-2 px-4 py-3 items-center transition duration-100 ${
                          isNonZero ? 'bg-[#0B0F19]/30 text-white font-semibold' : 'text-slate-650 text-slate-550'
                        }`}
                      >
                        {/* State Symbol */}
                        <div className="col-span-3 font-bold flex items-center gap-2">
                          <span className={`text-[13px] ${isNonZero ? 'text-cyan-400' : 'text-slate-600'}`}>
                            |{basis.binary}⟩
                          </span>
                          {basis.binary === '0'.repeat(numQubits) && (
                            <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-normal font-sans tracking-tight">Ground</span>
                          )}
                        </div>

                        {/* Amplitude Value */}
                        <div className="col-span-4 text-slate-300 break-all p-0.5 select-all text-xs font-mono">
                          {fmtComplex(basis.amplitude)}
                        </div>

                        {/* Probability Meter Bar */}
                        <div className="col-span-5 flex items-center gap-3">
                          <div className="flex-grow bg-[#0B0F19] h-2.5 rounded-full overflow-hidden border border-slate-800/80 flex">
                            <div 
                              style={{ width: `${basis.probability * 100}%` }}
                              className={`h-full transition-all duration-300 bg-gradient-to-r ${
                                basis.probability > 0.8 
                                  ? 'from-cyan-500 to-indigo-500' 
                                  : basis.probability > 0.2
                                  ? 'from-cyan-600 to-cyan-400'
                                  : 'from-indigo-800 to-indigo-650'
                              }`}
                            />
                          </div>
                          <span className={`w-14 text-right font-extrabold transition font-mono ${isNonZero ? 'text-slate-100' : 'text-slate-600'}`}>
                            {probPercent}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              <div className="text-[11px] text-slate-500 leading-normal flex items-start gap-1.5 border-t border-slate-800/30 pt-3 font-sans">
                <Info className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                <span>
                  By Born's Rule, amplitudes square to state measurement weights: <code className="bg-[#0B0F19] px-1 py-0.5 rounded text-indigo-300 border border-slate-800 text-[10px]">P(x) = |⟨x|ψ⟩|²</code>. System sums exactly to 1.000 (100%).
                </span>
              </div>
            </section>

            {/* Quick Quantum Theory Help Box */}
            <section id="theory-section" className="bg-[#0F172A] border border-slate-800/85 rounded-xl p-5 flex flex-col gap-4 shadow-xl mb-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-cyan-400" />
                Simulation Technical reference
              </h3>

              <div className="flex bg-[#0B0F19] p-0.5 rounded-lg border border-slate-800 text-xs font-medium w-full max-w-md">
                {(['basics', 'gates', 'bloch', 'entanglement'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveConcept(tab)}
                    className={`flex-1 py-1.5 rounded transition capitalize cursor-pointer font-bold ${
                      activeConcept === tab 
                        ? 'bg-slate-800 text-cyan-300 border border-slate-700/60 shadow' 
                        : 'text-slate-450 text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <div className="text-slate-350 text-xs leading-relaxed space-y-2">
                {activeConcept === 'basics' && (
                  <>
                    <p>
                      A classical bit is discrete. A qubit exists in structural superposition: <code className="bg-[#0B0F19] px-1 text-indigo-300 font-mono">|ψ⟩ = α|0⟩ + β|1⟩</code>, where <code className="bg-[#0B0F19] px-1 font-mono">α</code> and <code className="bg-[#0B0F19] px-1 font-mono">β</code> are complex state amplitudes.
                    </p>
                    <p>
                      Measurement collapses superposition state instantly to <code className="bg-[#0B0F19] px-1">|0⟩</code> or <code className="bg-[#0B0F19] px-1">|1⟩</code> with probability weights defined exactly by Born's calculations.
                    </p>
                  </>
                )}
                {activeConcept === 'gates' && (
                  <>
                    <p>
                      Reversible gate matrices rotate coordinates around direct axes of the Bloch Sphere space representation:
                    </p>
                    <ul className="list-disc pl-5 space-y-1 text-slate-450">
                      <li><strong className="text-indigo-300 font-mono">Hadamard (H):</strong> Perfectly maps Z to X equator, generating instant 50/50 superposition weights.</li>
                      <li><strong className="text-indigo-300 font-mono">Pauli X / NOT:</strong> Revolves 180° around X axis, mapping $|0⟩ \leftrightarrow |1⟩$.</li>
                      <li><strong className="text-indigo-300 font-mono">Phase (S / T):</strong> Rotates current state coordinate around Z vertical axis, altering relative complex values while maintaining probability ratios.</li>
                      <li><strong className="text-indigo-300 font-mono">Controlled CNOT (CX):</strong> Rotates target only when control indices compute as active, generating quantum entanglements.</li>
                    </ul>
                  </>
                )}
                {activeConcept === 'bloch' && (
                  <>
                    <p>
                      The <strong>Bloch Sphere</strong> represents any pure qubit state as a vector pointing to a surface coordinate:
                    </p>
                    <ul className="list-disc pl-5 space-y-1 text-slate-450">
                      <li>Top-pole represents state <code className="bg-[#0B0F19] text-cyan-300 px-1 font-mono">|0⟩</code> ($x=0, y=0, z=1$).</li>
                      <li>Bottom-pole represents state <code className="bg-[#0B0F19] text-cyan-300 px-1 font-mono">|1⟩</code> ($x=0, y=0, z=-1$).</li>
                      <li>Equator coordinate indicates equal superposition weights with relative global complex phase angles.</li>
                    </ul>
                  </>
                )}
                {activeConcept === 'entanglement' && (
                  <>
                    <p>
                      <strong>Entanglement</strong> describes states where multi-qubit systems must be analyzed combined.
                    </p>
                    <p className="bg-indigo-950/20 p-3 rounded-lg border border-indigo-900/30 text-indigo-300 mt-2 font-medium">
                      💡 <strong>Mixed states trace:</strong> Highly entangled qubits collapse within the sphere center ($r \lt 1$). A vector at the center $(0,0,0)$ represents a mixed state, indicating perfect correlation with partners. Use <strong>Bell Preset</strong> to inspect mixed vectors!
                    </p>
                  </>
                )}
              </div>
            </section>

          </div>

        </div>

      </main>

      {/* 🚀 Footer Panel */}
      <footer id="app-footer" className="h-10 bg-[#090C14] border-t border-slate-800/80 flex items-center justify-between px-6 shrink-0 text-[10px] font-mono text-slate-500 uppercase tracking-widest relative z-10">
        <div>
          © 2026 Bloch sphere laboratory • deterministic simulation Engine
        </div>
        <div className="flex gap-4">
          <span className="hover:text-cyan-400 transition cursor-default">NodeJS Sandbox Backend</span>
          <span>•</span>
          <span className="hover:text-cyan-400 transition cursor-default">Three.js WebGL rendering</span>
        </div>
      </footer>

    </div>
  );
}
