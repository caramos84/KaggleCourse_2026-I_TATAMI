/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { Complex, Gate, BlochVector, BasisState, SimulationResponse } from './src/types.js';

const app = express();
const PORT = 3000;

app.use(express.json());

// Helper functions for Complex number arithmetic
const ComplexMath = {
  zero: (): Complex => ({ r: 0, i: 0 }),
  one: (): Complex => ({ r: 1, i: 0 }),
  add: (a: Complex, b: Complex): Complex => ({ r: a.r + b.r, i: a.i + b.i }),
  sub: (a: Complex, b: Complex): Complex => ({ r: a.r - b.r, i: a.i - b.i }),
  mul: (a: Complex, b: Complex): Complex => ({
    r: a.r * b.r - a.i * b.i,
    i: a.r * b.i + a.i * b.r,
  }),
  conjugate: (a: Complex): Complex => ({ r: a.r, i: -a.i }),
  magnitudeSq: (a: Complex): number => a.r * a.r + a.i * a.i,
  scale: (a: Complex, s: number): Complex => ({ r: a.r * s, i: a.i * s }),
};

// Programmatic Quantum Simulator
function simulateQuantumCircuit(numQubits: number, gates: Gate[]): SimulationResponse {
  if (numQubits < 1 || numQubits > 3) {
    return {
      success: false,
      numQubits,
      stateVector: [],
      blochVectors: [],
      basisStates: [],
      asciiDiagram: '',
      error: 'Simulator only supports 1 to 3 qubits.',
    };
  }

  const stateSize = 1 << numQubits;
  let psi: Complex[] = Array.from({ length: stateSize }, () => ComplexMath.zero());
  psi[0] = ComplexMath.one(); // Initialize to ground state |00...0>

  try {
    for (const gate of gates) {
      const { type, target, control, param } = gate;

      // Bounds checking
      if (target < 0 || target >= numQubits) {
        throw new Error(`Gate target index ${target} sits out of bounds for ${numQubits} qubits.`);
      }
      if (control !== undefined && (control < 0 || control >= numQubits)) {
        throw new Error(`Gate control index ${control} sits out of bounds.`);
      }
      if (control !== undefined && control === target) {
        throw new Error(`Target and Control qubits cannot be the same (${target}).`);
      }

      // 2x2 Gate Matrix components
      let m00 = ComplexMath.one();
      let m01 = ComplexMath.zero();
      let m10 = ComplexMath.zero();
      let m11 = ComplexMath.one();

      const theta = param || 0;

      // Define gate unitary matrix
      switch (type) {
        case 'I':
          // Identity
          break;
        case 'X':
          m00 = ComplexMath.zero();
          m01 = ComplexMath.one();
          m10 = ComplexMath.one();
          m11 = ComplexMath.zero();
          break;
        case 'Y':
          m00 = ComplexMath.zero();
          m01 = { r: 0, i: -1 };
          m10 = { r: 0, i: 1 };
          m11 = ComplexMath.zero();
          break;
        case 'Z':
          m00 = ComplexMath.one();
          m01 = ComplexMath.zero();
          m10 = ComplexMath.zero();
          m11 = { r: -1, i: 0 };
          break;
        case 'H':
          const invSqrt2 = 1 / Math.sqrt(2);
          m00 = { r: invSqrt2, i: 0 };
          m01 = { r: invSqrt2, i: 0 };
          m10 = { r: invSqrt2, i: 0 };
          m11 = { r: -invSqrt2, i: 0 };
          break;
        case 'S':
          m11 = { r: 0, i: 1 };
          break;
        case 'Sdg':
          m11 = { r: 0, i: -1 };
          break;
        case 'T':
          m11 = { r: Math.cos(Math.PI / 4), i: Math.sin(Math.PI / 4) };
          break;
        case 'Tdg':
          m11 = { r: Math.cos(Math.PI / 4), i: -Math.sin(Math.PI / 4) };
          break;
        case 'Rx':
          m00 = { r: Math.cos(theta / 2), i: 0 };
          m01 = { r: 0, i: -Math.sin(theta / 2) };
          m10 = { r: 0, i: -Math.sin(theta / 2) };
          m11 = { r: Math.cos(theta / 2), i: 0 };
          break;
        case 'Ry':
          m00 = { r: Math.cos(theta / 2), i: 0 };
          m01 = { r: -Math.sin(theta / 2), i: 0 };
          m10 = { r: Math.sin(theta / 2), i: 0 };
          m11 = { r: Math.cos(theta / 2), i: 0 };
          break;
        case 'Rz':
          m00 = { r: Math.cos(theta / 2), i: -Math.sin(theta / 2) };
          m11 = { r: Math.cos(theta / 2), i: Math.sin(theta / 2) };
          break;
        case 'CX':
        case 'CZ':
          // Handled separately below as conditional 2-qubit targets
          break;
        case 'SWAP':
          // SWAP handled is in single sweep below
          break;
        default:
          throw new Error(`Unsupported gate type: ${type}`);
      }

      // Apply operation
      if (type === 'SWAP') {
        const a = target;
        const b = control!;
        const swappedArray = [...psi];
        for (let i = 0; i < stateSize; i++) {
          const bitA = (i >> a) & 1;
          const bitB = (i >> b) & 1;
          if (bitA === 1 && bitB === 0) {
            const j = i - (1 << a) + (1 << b);
            swappedArray[i] = psi[j];
            swappedArray[j] = psi[i];
          }
        }
        psi = swappedArray;
      } else if (type === 'CX' || type === 'CZ') {
        // Controlled gates
        const c = control!;
        const t = target;
        const nextPsi = [...psi];

        // Loop over pairs corresponding to target qubit
        const numPairs = stateSize >> 1;
        for (let p = 0; p < numPairs; p++) {
          const idx0 = ((p >> t) << (t + 1)) | (p & ((1 << t) - 1));
          const idx1 = idx0 | (1 << t);

          // Check if control qubit is 1
          const isControlSet = ((idx0 >> c) & 1) === 1;

          if (isControlSet) {
            if (type === 'CX') {
              // Apply X (Swap)
              const tmp = nextPsi[idx0];
              nextPsi[idx0] = nextPsi[idx1];
              nextPsi[idx1] = tmp;
            } else if (type === 'CZ') {
              // Apply Z (Negative phase to bit=1)
              nextPsi[idx1] = ComplexMath.scale(nextPsi[idx1], -1);
            }
          }
        }
        psi = nextPsi;
      } else {
        // Standard single-qubit gate
        const t = target;
        const nextPsi = [...psi];
        const numPairs = stateSize >> 1;
        for (let p = 0; p < numPairs; p++) {
          const idx0 = ((p >> t) << (t + 1)) | (p & ((1 << t) - 1));
          const idx1 = idx0 | (1 << t);

          const val0 = psi[idx0];
          const val1 = psi[idx1];

          // idx0' = m00*val0 + m01*val1
          // idx1' = m10*val0 + m11*val1
          nextPsi[idx0] = ComplexMath.add(ComplexMath.mul(m00, val0), ComplexMath.mul(m01, val1));
          nextPsi[idx1] = ComplexMath.add(ComplexMath.mul(m10, val0), ComplexMath.mul(m11, val1));
        }
        psi = nextPsi;
      }
    }

    // Now, let's trace out and calculate Bloch vectors for each qubit
    const blochVectors: BlochVector[] = [];
    for (let k = 0; k < numQubits; k++) {
      let rho00 = 0;
      let rho11 = 0;
      let rho01 = ComplexMath.zero();

      const numPairs = stateSize >> 1;
      for (let p = 0; p < numPairs; p++) {
        const idx0 = ((p >> k) << (k + 1)) | (p & ((1 << k) - 1));
        const idx1 = idx0 | (1 << k);

        const val0 = psi[idx0];
        const val1 = psi[idx1];

        rho00 += ComplexMath.magnitudeSq(val0);
        rho11 += ComplexMath.magnitudeSq(val1);

        // rho01 += val0 * conjugate(val1)
        const term = ComplexMath.mul(val0, ComplexMath.conjugate(val1));
        rho01 = ComplexMath.add(rho01, term);
      }

      const x = 2 * rho01.r;
      const y = -2 * rho01.i;
      const z = rho00 - rho11;
      const r = Math.sqrt(x * x + y * y + z * z);

      // Clean up floating point tiny numbers
      const clean = (val: number) => (Math.abs(val) < 1e-10 ? 0 : val);

      blochVectors.push({
        x: clean(x),
        y: clean(y),
        z: clean(z),
        r: clean(r),
      });
    }

    // Create list of basis states and their info
    const basisStates: BasisState[] = [];
    for (let i = 0; i < stateSize; i++) {
      const binary = i.toString(2).padStart(numQubits, '0');
      const amplitude = psi[i];
      const probability = ComplexMath.magnitudeSq(amplitude);
      basisStates.push({
        index: i,
        binary,
        amplitude,
        probability: Math.abs(probability) < 1e-10 ? 0 : probability,
      });
    }

    // Generate accurate ASCII diagram of the circuit
    const asciiDiagram = generateAsciiDiagram(numQubits, gates);

    return {
      success: true,
      numQubits,
      stateVector: psi,
      blochVectors,
      basisStates,
      asciiDiagram,
    };
  } catch (err: any) {
    return {
      success: false,
      numQubits,
      stateVector: [],
      blochVectors: [],
      basisStates: [],
      asciiDiagram: '',
      error: err.message || 'An unknown error occurred during simulation.',
    };
  }
}

// Draw professional circuit diagram as ASCII text
function generateAsciiDiagram(numQubits: number, gates: Gate[]): string {
  // We represent the timeline in steps
  // Each step represents a column of width 5 (aligned at center index 2)
  const columns: string[][] = [];

  for (const gate of gates) {
    const column: string[] = Array(numQubits).fill('─────');
    const { type, target, control, param } = gate;

    const formattedParam = param !== undefined ? `(${param.toFixed(1)})` : '';
    let gateLabel: string = type;
    if (type === 'Rx' || type === 'Ry' || type === 'Rz') {
      gateLabel = `${type}${formattedParam}`;
    }

    // Single character labels or formatted boxes
    if (type === 'CX') {
      column[control!] = '──■──';
      column[target] = '──⊕──';
    } else if (type === 'CZ') {
      column[control!] = '──■──';
      column[target] = '──■──';
    } else if (type === 'SWAP') {
      column[control!] = '──✖──';
      column[target] = '──✖──';
    } else {
      // Single qubit gate box, e.g. "─[H]─", "─[Rx(1.6)]─"
      const inner = `[${gateLabel}]`;
      const isEven = inner.length % 2 === 1;
      const leftPadCount = Math.floor((5 - inner.length) / 2);
      const rightPadCount = 5 - inner.length - leftPadCount;

      const leftPad = '─'.repeat(Math.max(0, leftPadCount));
      const rightPad = '─'.repeat(Math.max(0, rightPadCount));
      column[target] = `${leftPad}${inner}${rightPad}`;
    }

    columns.push(column);
  }

  // Always end the lines with a finishing terminal wire ──
  const finishWire = '──';

  // Build the block lines
  const lines: string[] = [];
  for (let q = numQubits - 1; q >= 0; q--) {
    let wireLine = `q_${q}: ──`;
    let gapLine = '      '; // matches "q_0: ──" length of 6

    for (let c = 0; c < columns.length; c++) {
      const colEntry = columns[c][q];
      wireLine += colEntry;

      // Draw vertical alignment hooks
      const gate = gates[c];
      if (gate.type === 'CX' || gate.type === 'CZ' || gate.type === 'SWAP') {
        const low = Math.min(gate.target, gate.control!);
        const high = Math.max(gate.target, gate.control!);

        // Determine if connector hits level between q and q-1
        if (q > 0 && q <= high && q - 1 >= low) {
          gapLine += '  │  ';
        } else {
          gapLine += '     ';
        }
      } else {
        gapLine += '     ';
      }
    }
    wireLine += finishWire;
    gapLine += '  ';

    lines.push(wireLine);
    if (q > 0) {
      lines.push(gapLine);
    }
  }

  return lines.join('\n');
}

// API Routes
app.post('/api/simulate', (req, res) => {
  const { numQubits, gates } = req.body;
  if (numQubits === undefined || !Array.isArray(gates)) {
    return res.status(400).json({
      success: false,
      numQubits: numQubits || 1,
      stateVector: [],
      blochVectors: [],
      basisStates: [],
      asciiDiagram: '',
      error: 'Missing required fields: numQubits (number) or gates (array).',
    });
  }

  const result = simulateQuantumCircuit(numQubits, gates);
  res.json(result);
});

// Serve frontend assets and listen
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Quantum simulation engine running on port ${PORT}`);
  });
}

startServer();
