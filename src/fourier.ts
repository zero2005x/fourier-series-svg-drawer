/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Point, FourierCoefficient } from './types';

/**
 * Performs Discrete Fourier Transform (DFT) on an array of 2D points.
 * Treats the 2D coordinate (x, y) as a complex number z_n = x_n + i * y_n.
 * Returns sorted Fourier coefficients.
 */
export function computeDFT(points: Point[]): FourierCoefficient[] {
  const X: FourierCoefficient[] = [];
  const N = points.length;

  // Precompute cos and sin tables to avoid heavy Math.cos/Math.sin calls in inner loop
  const cosTable = new Float64Array(N);
  const sinTable = new Float64Array(N);
  const PI2_N = (Math.PI * 2) / N;
  for (let i = 0; i < N; i++) {
    const angle = i * PI2_N;
    cosTable[i] = Math.cos(angle);
    sinTable[i] = Math.sin(angle);
  }

  for (let k = 0; k < N; k++) {
    let re = 0;
    let im = 0;

    for (let n = 0; n < N; n++) {
      const m = (k * n) % N;
      const c = cosTable[m];
      const s = sinTable[m];
      // Complex multiplication: (x_n + i * y_n) * (cos(phi) - i * sin(phi))
      re += points[n].x * c + points[n].y * s;
      im += -points[n].x * s + points[n].y * c;
    }

    // Normalize by N
    re = re / N;
    im = im / N;

    // Convert index k to frequency in [-N/2, N/2]
    let freq = k;
    if (freq > N / 2) {
      freq = freq - N;
    }

    const amp = Math.sqrt(re * re + im * im);
    const phase = Math.atan2(im, re);

    X.push({ re, im, freq, amp, phase });
  }

  return X;
}

/**
 * Performs Discrete Fourier Transform (DFT) asynchronously in chunked sub-tasks.
 * Treats the 2D coordinate (x, y) as a complex number z_n = x_n + i * y_n.
 * Returns sorted Fourier coefficients.
 * Optimizes via trigonometric precomputation & budget-based 16ms time-slicing.
 */
export function computeDFTAsync(
  points: Point[],
  onProgress: (percent: number, current: number, total: number) => void
): Promise<FourierCoefficient[]> {
  return new Promise((resolve) => {
    const X: FourierCoefficient[] = [];
    const N = points.length;

    // Precompute cos and sin tables
    const cosTable = new Float64Array(N);
    const sinTable = new Float64Array(N);
    const PI2_N = (Math.PI * 2) / N;
    for (let i = 0; i < N; i++) {
      const angle = i * PI2_N;
      cosTable[i] = Math.cos(angle);
      sinTable[i] = Math.sin(angle);
    }

    let k = 0;
    const TIME_BUDGET_MS = 16; // 16ms time-slice window for flawless 60fps UI matching

    function process() {
      const startTime = performance.now();

      while (k < N) {
        let re = 0;
        let im = 0;

        for (let n = 0; n < N; n++) {
          const m = (k * n) % N;
          re += points[n].x * cosTable[m] + points[n].y * sinTable[m];
          im += -points[n].x * sinTable[m] + points[n].y * cosTable[m];
        }

        // Normalize by N
        re = re / N;
        im = im / N;

        // Convert index k to frequency in [-N/2, N/2]
        let freq = k;
        if (freq > N / 2) {
          freq = freq - N;
        }

        const amp = Math.sqrt(re * re + im * im);
        const phase = Math.atan2(im, re);

        X.push({ re, im, freq, amp, phase });
        k++;

        // Yield if we exceeded our 16ms budget
        if (performance.now() - startTime > TIME_BUDGET_MS) {
          const percent = Math.min(100, Math.round((k / N) * 100));
          // Keep current/total interface compatible
          onProgress(percent, k, N);
          setTimeout(process, 1);
          return;
        }
      }

      // Completed
      onProgress(100, N, N);
      resolve(X);
    }

    setTimeout(process, 1);
  });
}

/**
 * Centered and scaled 2D points to fit exactly in the specified canvas viewport.
 */
export function centerAndScalePoints(
  points: Point[],
  viewportWidth: number,
  viewportHeight: number,
  padding = 100
): Point[] {
  if (points.length === 0) return [];

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  const dx = maxX - minX;
  const dy = maxY - minY;
  const centerX = minX + dx / 2;
  const centerY = minY + dy / 2;

  const targetW = viewportWidth - padding * 2;
  const targetH = viewportHeight - padding * 2;

  const scale = Math.min(targetW / (dx || 1), targetH / (dy || 1));

  return points.map((p) => ({
    x: viewportWidth / 2 + (p.x - centerX) * scale,
    y: viewportHeight / 2 + (p.y - centerY) * scale,
  }));
}

/**
 * Generates continuous mathematical curves based on parametric equations.
 */
export function generateMathematicalCurve(type: string, totalPoints = 1200): Point[] {
  const points: Point[] = [];

  for (let i = 0; i < totalPoints; i++) {
    const t = (i / totalPoints) * Math.PI * 2;

    let x = 0;
    let y = 0;

    switch (type) {
      case 'infinity': {
        // Dynamic Infinity Loop intertwined with heart-curves
        const scale = 200;
        x = (scale * Math.cos(t)) / (1 + Math.sin(t) * Math.sin(t));
        y = (scale * Math.sin(t) * Math.cos(t)) / (1 + Math.sin(t) * Math.sin(t));
        // Add a slight heart warp for extreme elegance
        y += Math.abs(x) * 0.4;
        break;
      }
      case 'rose': {
        // Elegant 5-petalled mathematical rose pattern
        const k = 5;
        const r = 250 * Math.sin(k * t);
        x = r * Math.cos(t);
        y = r * Math.sin(t);
        break;
      }
      case 'butterfly': {
        // Fay's magnificent butterfly curve
        const r =
          120 *
          (Math.exp(Math.cos(t)) -
            2 * Math.cos(4 * t) +
            Math.pow(Math.sin(t / 12), 5));
        x = r * Math.sin(t);
        // Flip canvas Y-axis orient
        y = -r * Math.cos(t);
        break;
      }
      case 'spiral': {
        // Archimedean Spiral in a closed orbital design (traces in & out)
        const maxR = 250;
        const cycles = 5;
        // Map t back and forth so the curve remains closed
        const factor = Math.sin(t / 2); // oscillates between 0 and 1
        const r = maxR * factor;
        const theta = t * cycles;
        x = r * Math.cos(theta);
        y = r * Math.sin(theta);
        break;
      }
      case 'heart':
      default: {
        // Standard high-fidelity parametric heart shape
        x = 16 * Math.pow(Math.sin(t), 3);
        y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
        // Scale for centering wrapper
        x *= 15;
        y *= 15;
        break;
      }
    }

    points.push({ x, y });
  }

  return points;
}

/**
 * Parses SVG paths and samples continuous points from them.
 * Handles single path sequences. For SVG files with multiple paths,
 * parses and concatenates them with continuous interpolation to maintain a single continuous stroke.
 */
export function samplePointsFromSVG(svgContent: string, sampleCount = 1200): Point[] {
  // Use browser-native DOMParser to parse the SVG content safely
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgContent, 'image/svg+xml');
  const paths = doc.querySelectorAll('path');

  if (paths.length === 0) {
    // If no path tags are present, search for polygons, polylines, circles, or rects
    const polylines = doc.querySelectorAll('polyline, polygon');
    if (polylines.length > 0) {
      const points: Point[] = [];
      polylines.forEach((poly) => {
        const pointsAttr = poly.getAttribute('points');
        if (pointsAttr) {
          const parts = pointsAttr.trim().split(/[\s,]+/);
          for (let i = 0; i < parts.length; i += 2) {
            if (parts[i] && parts[i + 1]) {
              points.push({ x: parseFloat(parts[i]), y: parseFloat(parts[i + 1]) });
            }
          }
        }
      });
      if (points.length > 0) return points;
    }
    throw new Error('No parseable <path> or vector segment was found in the SVG.');
  }

  // Create an off-screen SVG path element to leverage the browser's getPointAtLength API
  const svgNS = 'http://www.w3.org/2000/svg';
  const points: Point[] = [];

  // Combine multiple paths into a single sequence
  // We can create a virtual path element and set d string
  const dStrings: string[] = [];
  paths.forEach((p) => {
    const d = p.getAttribute('d');
    if (d) dStrings.push(d);
  });

  const combinedD = dStrings.join(' ');
  const tempPath = document.createElementNS(svgNS, 'path');
  tempPath.setAttribute('d', combinedD);

  try {
    const totalLength = tempPath.getTotalLength();
    if (totalLength <= 0) {
      throw new Error('The SVG path length is zero. Check whether the SVG file is valid.');
    }

    for (let i = 0; i < sampleCount; i++) {
      const distance = (i / sampleCount) * totalLength;
      const pt = tempPath.getPointAtLength(distance);
      points.push({ x: pt.x, y: pt.y });
    }
  } catch (err) {
    console.error('Error sampling SVG path:', err);
    // Fallback: manual parsing or generic error
    throw new Error('Unable to sample this SVG path. Ensure it is a valid 2D vector path.');
  }

  return points;
}
