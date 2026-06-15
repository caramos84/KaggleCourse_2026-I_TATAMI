/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Complex {
  r: number; // Real part
  i: number; // Imaginary part
}

export type GateType = 
  | 'I' 
  | 'X' 
  | 'Y' 
  | 'Z' 
  | 'H' 
  | 'S' 
  | 'T' 
  | 'Sdg' 
  | 'Tdg' 
  | 'Rx' 
  | 'Ry' 
  | 'Rz' 
  | 'CX' 
  | 'CZ' 
  | 'SWAP';

export interface Gate {
  id: string;
  type: GateType;
  target: number; // Qubit index (0 to numQubits-1)
  control?: number; // Optional control qubit index for double-qubit gates
  param?: number; // Optional rotation angle theta in radians
}

export interface BlochVector {
  x: number;
  y: number;
  z: number;
  r: number; // length / purity
}

export interface BasisState {
  index: number;
  binary: string; // e.g. "01"
  amplitude: Complex;
  probability: number;
}

export interface SimulationResponse {
  success: boolean;
  numQubits: number;
  stateVector: Complex[];
  blochVectors: BlochVector[];
  basisStates: BasisState[];
  asciiDiagram: string;
  error?: string;
}
