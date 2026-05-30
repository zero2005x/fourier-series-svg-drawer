/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Point {
  x: number;
  y: number;
}

export interface TracedPoint {
  x: number;
  y: number;
  isOriginal: boolean;
  addedAt: number;
}

export interface FourierCoefficient {
  re: number;
  im: number;
  freq: number;
  amp: number;
  phase: number;
}

export interface PresetPath {
  id: string;
  name: string;
  description: string;
  svgPath?: string; // Standard SVG single-path data
  mathType?: 'heart' | 'infinity' | 'rose' | 'butterfly' | 'spiral'; // Mathematically generated preset fallback
}
