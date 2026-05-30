/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PresetPath } from './types';

export const PRESET_PATHS: PresetPath[] = [
  {
    id: 'portrait',
    name: 'Elegant Portrait',
    description: 'Stylized single-stroke outlines of a female portrait. Captures flowing chin, eye, and neck contours.',
    // Realistic stylized profile path centered around ~400, 400
    svgPath: 'M 220 180 C 230 110, 310 100, 350 140 C 370 160, 380 200, 370 240 C 360 270, 340 290, 330 310 C 320 330, 315 350, 320 370 C 325 390, 350 410, 370 415 C 380 417, 395 410, 410 400 C 430 385, 460 365, 480 390 C 490 405, 485 425, 470 440 C 450 460, 420 470, 390 475 C 360 480, 330 460, 310 450 C 290 440, 260 455, 240 480 C 220 500, 205 530, 200 560 C 195 590, 210 630, 230 650 C 250 670, 280 675, 300 660 C 320 645, 340 610, 350 600 C 365 585, 390 590, 410 610 C 430 630, 440 660, 435 690 C 430 720, 400 760, 360 780 C 320 800, 250 810, 200 780 C 170 762, 140 700, 150 620 C 155 580, 170 540, 160 500 C 150 460, 110 440, 90 400 C 80 380, 85 360, 100 340 C 120 310, 160 300, 170 280 C 180 260, 165 220, 180 195 Z'
  },
  {
    id: 'butterfly',
    name: 'Mystic Butterfly',
    description: 'Highly symmetric and elegant wing patterns perfect for showing harmonic synthesis.',
    svgPath: 'M 400 450 C 410 410, 430 390, 450 370 C 490 330, 560 310, 580 360 C 595 395, 560 450, 510 470 C 470 485, 430 490, 400 510 C 420 530, 445 550, 480 570 C 530 600, 550 640, 520 670 C 490 700, 440 680, 420 640 C 410 620, 405 590, 400 560 C 395 590, 390 620, 380 640 C 360 680, 310 700, 280 670 C 250 640, 270 600, 320 570 C 355 550, 380 530, 400 510 C 370 490, 330 485, 290 470 C 240 450, 205 395, 220 360 C 240 310, 310 330, 350 370 C 370 390, 390 410, 400 450 Z'
  },
  {
    id: 'swan',
    name: 'Graceful Swan',
    description: 'Sleek profile of a swan\'s neck and wing motions displaying beautiful varying curvature.',
    svgPath: 'M 180 500 C 190 450, 220 400, 270 400 C 310 400, 340 430, 330 480 C 320 530, 250 580, 300 630 C 330 660, 380 660, 420 610 C 460 560, 470 500, 500 460 C 530 420, 580 380, 620 410 C 650 430, 660 480, 640 520 C 620 560, 560 600, 550 640 C 540 680, 580 710, 620 720 C 660 730, 710 700, 730 660 C 750 620, 740 570, 710 540 C 680 510, 620 530, 600 490 C 580 450, 610 390, 570 350 C 530 310, 450 320, 410 360 C 380 390, 370 430, 380 470 C 390 510, 410 530, 400 560 C 390 590, 340 600, 310 580 C 280 560, 250 510, 210 530 C 190 540, 175 520, 180 500 Z'
  },
  {
    id: 'music-note',
    name: 'Treble Clef Note',
    description: 'Classical musical sign filled with spiral curls and intersecting paths.',
    svgPath: 'M 400 600 C 430 600, 460 570, 460 530 C 460 480, 400 450, 370 480 C 340 510, 340 560, 380 590 C 420 620, 470 610, 490 560 C 510 510, 490 420, 460 330 C 440 270, 420 180, 410 130 C 405 100, 415 80, 430 80 C 445 80, 450 110, 450 150 C 450 210, 420 300, 390 400 C 370 470, 350 550, 350 620 C 350 710, 380 770, 400 810 C 410 830, 395 850, 370 850 C 340 850, 320 810, 320 760 C 320 710, 350 670, 400 600 Z'
  },
  {
    id: 'infinity',
    name: 'Infinity Heart',
    description: 'Double mathematical curves overlapping in a heart and infinity shape.',
    mathType: 'infinity'
  },
  {
    id: 'rose-pattern',
    name: 'Mathematical Rose',
    description: 'Symmetrical flower created via polar equation r = cos(kθ) showing high-frequency overlay.',
    mathType: 'rose'
  },
  {
    id: 'butterfly-math',
    name: 'Fay\'s Butterfly',
    description: 'The famous Temple H. Fay butterfly transcendental curve with stunning rises and dips.',
    mathType: 'butterfly'
  }
];
