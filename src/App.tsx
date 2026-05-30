/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Upload,
  Sliders,
  Layers,
  LineChart,
  HelpCircle,
  Info,
  Palette,
  Sparkles,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Download,
  Video,
  Globe
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Point, TracedPoint, FourierCoefficient, PresetPath } from './types';
import { PRESET_PATHS } from './presets';
import {
  computeDFT,
  computeDFTAsync,
  centerAndScalePoints,
  generateMathematicalCurve,
  samplePointsFromSVG
} from './fourier';
import { LANGUAGES, TRANSLATIONS } from './translations';

export default function App() {
  const [currentLang, setCurrentLang] = useState<string>('en');
  const t = TRANSLATIONS[currentLang] || TRANSLATIONS['en'];

  // --- State Configuration ---
  const [selectedPresetId, setSelectedPresetId] = useState<string>('portrait');
  const [activeCircles, setActiveCircles] = useState<number>(120);
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1.0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [showCircles, setShowCircles] = useState<boolean>(true);
  const [showRadii, setShowRadii] = useState<boolean>(true);
  const [showTargetGuide, setShowTargetGuide] = useState<boolean>(true);
  const [neonGlowEnabled, setNeonGlowEnabled] = useState<boolean>(true);
  
  // Tracing stroke customization
  const [strokeColor, setStrokeColor] = useState<string>('#ff007f'); // Neon Pink default
  const [trailRatio, setTrailRatio] = useState<number>(1.0); // Trail length ratio (1.0 = full / infinite delay)
  const strokeColors = [
    { value: '#ff007f', label: '極光粉粉', className: 'bg-[#ff007f]' },
    { value: '#00f0ff', label: '未來青藍', className: 'bg-[#00f0ff]' },
    { value: '#10b981', label: '劇毒翡翠', className: 'bg-[#10b981]' },
    { value: '#f59e0b', label: '烈焰夕陽', className: 'bg-[#f59e0b]' },
    { value: '#a855f7', label: '賽博極光', className: 'bg-[#a855f7]' },
    { value: '#ffffff', label: '耀眼極簡', className: 'bg-[#ffffff]' }
  ];

  // Mathematical and DFT core points
  const [sampledPoints, setSampledPoints] = useState<Point[]>([]);
  const [fourierCoefficients, setFourierCoefficients] = useState<FourierCoefficient[]>([]);
  
  // Custom uploaded file states
  const [customSvgFileName, setCustomSvgFileName] = useState<string | null>(null);
  const [customSvgText, setCustomSvgText] = useState<string | null>(null);
  const [samplingResolution, setSamplingResolution] = useState<number>(2000);
  const [autoPlayOnUpload, setAutoPlayOnUpload] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // --- Manual Confirmation Mode States ---
  const [manualConfirmMode, setManualConfirmMode] = useState<boolean>(false);
  const [draftPresetId, setDraftPresetId] = useState<string>('portrait');
  const [draftCustomSvgFileName, setDraftCustomSvgFileName] = useState<string | null>(null);
  const [draftCustomSvgText, setDraftCustomSvgText] = useState<string | null>(null);
  const [draftResolution, setDraftResolution] = useState<number>(2000);
  const [draftActiveCircles, setDraftActiveCircles] = useState<number>(120);
  const [draftSpeedMultiplier, setDraftSpeedMultiplier] = useState<number>(1.0);
  const [draftTrailRatio, setDraftTrailRatio] = useState<number>(1.0);

  // Unidirectional synchronization of draft parameters from active ones when Manual Apply Mode is OFF
  useEffect(() => {
    if (!manualConfirmMode) {
      setDraftPresetId(selectedPresetId);
      setDraftCustomSvgFileName(customSvgFileName);
      setDraftCustomSvgText(customSvgText);
      setDraftResolution(samplingResolution);
      setDraftActiveCircles(activeCircles);
      setDraftSpeedMultiplier(speedMultiplier);
      setDraftTrailRatio(trailRatio);
    }
  }, [
    manualConfirmMode,
    selectedPresetId,
    customSvgFileName,
    customSvgText,
    samplingResolution,
    activeCircles,
    speedMultiplier,
    trailRatio
  ]);

  // Compute if any draft changes are in-waiting (pending) compared to the active ones
  const hasPendingChanges = 
    draftPresetId !== selectedPresetId ||
    draftCustomSvgFileName !== customSvgFileName ||
    draftCustomSvgText !== customSvgText ||
    draftResolution !== samplingResolution ||
    draftActiveCircles !== activeCircles ||
    draftSpeedMultiplier !== speedMultiplier ||
    draftTrailRatio !== trailRatio;

  // Async calculation states to update interactive overlays for intensive matrix operations
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [calcProgress, setCalcProgress] = useState<{ percent: number; current: number; total: number }>({
    percent: 0,
    current: 0,
    total: 10
  });
  const calculationEpochRef = useRef<number>(0);

  // Video recording states and refs for MediaRecorder stream captures
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const isRecordingRef = useRef<boolean>(false);

  // We keep refs for highly frequent variables to prevent infinite state updates of React and guarantee extreme smooth render loops
  const timeRef = useRef<number>(0);
  const drawnPathRef = useRef<TracedPoint[]>([]);
  const stepCounterRef = useRef<number>(0);
  const [cycleCompletionProgress, setCycleCompletionProgress] = useState<number>(0);
  
  // Collapse controller for Math Panel
  const [mathPanelOpen, setMathPanelOpen] = useState<boolean>(true);

  // Refs for canvas elements & wrapper sizing
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [canvasSize, setCanvasSize] = useState<{ width: number; height: number }>({
    width: 650,
    height: 650
  });

  // --- 1. Dynamic Resize Handling ---
  useEffect(() => {
    if (!wrapperRef.current) return;

    const handleResize = () => {
      const rect = wrapperRef.current?.getBoundingClientRect();
      if (rect) {
        // Maintain a strict aspect square proportional to width
        const size = Math.max(450, Math.min(680, rect.width));
        setCanvasSize({ width: size, height: size });
      }
    };

    const observer = new ResizeObserver(() => {
      handleResize();
    });

    observer.observe(wrapperRef.current);
    handleResize();

    return () => {
      observer.disconnect();
    };
  }, []);

  // Cleanup effect to stop MediaRecorder on component unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  // --- 2. Load Preset or Custom Inputs ---
  const loadPreset = async (presetId: string, currentWidth = canvasSize.width, currentHeight = canvasSize.height, resolution = samplingResolution) => {
    const epoch = ++calculationEpochRef.current;
    try {
      setErrorMsg(null);
      const preset = PRESET_PATHS.find(p => p.id === presetId);
      if (!preset) return;

      setIsCalculating(true);
      setCalcProgress({ percent: 0, current: 0, total: 10 });

      let rawPoints: Point[] = [];
      if (preset.svgPath) {
        // Standard high-quality sampled path
        rawPoints = samplePointsFromSVG(
          `<svg viewBox="0 0 800 800"><path d="${preset.svgPath}" /></svg>`,
          resolution
        );
      } else if (preset.mathType) {
        // Pure high frequency mathematical parametric signals
        rawPoints = generateMathematicalCurve(preset.mathType, resolution);
      }

      if (rawPoints.length === 0) {
        throw new Error('無法從預設中產生存取點！');
      }

      const scaled = centerAndScalePoints(rawPoints, currentWidth, currentHeight);
      
      // Perform 2D DFT discrete calculation asynchronously in chunked sub-tasks
      const dftOutput = await computeDFTAsync(scaled, (percent, current, total) => {
        if (epoch === calculationEpochRef.current) {
          setCalcProgress({ percent, current, total });
        }
      });

      if (epoch !== calculationEpochRef.current) {
        return; // calculation was canceled or superseded
      }

      setSampledPoints(scaled);

      // Sort amplitude in descending order (dominant low frequency circles first to keep rendering visual beautiful)
      dftOutput.sort((a, b) => b.amp - a.amp);
      
      setFourierCoefficients(dftOutput);
      
      // Restart tracing
      timeRef.current = 0;
      drawnPathRef.current = [];
      stepCounterRef.current = 0;
      setCycleCompletionProgress(0);
      setCustomSvgFileName(null);
      setSelectedPresetId(presetId);
    } catch (err: any) {
      if (epoch === calculationEpochRef.current) {
        setErrorMsg(err.message || '載入預設時發生未預期錯誤');
      }
    } finally {
      if (epoch === calculationEpochRef.current) {
        setIsCalculating(false);
      }
    }
  };

  // Sync load when canvas size or sampling resolution triggers recalculation so the image remains perfectly centered
  // Note: Disabled when manualConfirmMode is active to let the manual Apply action handle calculation.
  useEffect(() => {
    if (manualConfirmMode) return;

    if (customSvgFileName && customSvgText) {
      const epoch = ++calculationEpochRef.current;
      setIsCalculating(true);
      setCalcProgress({ percent: 0, current: 0, total: 10 });

      const runResample = async () => {
        try {
          const rawPoints = samplePointsFromSVG(customSvgText, samplingResolution);
          const scaled = centerAndScalePoints(rawPoints, canvasSize.width, canvasSize.height);
          
          const dftOutput = await computeDFTAsync(scaled, (percent, current, total) => {
            if (epoch === calculationEpochRef.current) {
              setCalcProgress({ percent, current, total });
            }
          });

          if (epoch !== calculationEpochRef.current) return;

          setSampledPoints(scaled);
          dftOutput.sort((a, b) => b.amp - a.amp);
          setFourierCoefficients(dftOutput);
          timeRef.current = 0;
          drawnPathRef.current = [];
          stepCounterRef.current = 0;
          setCycleCompletionProgress(0);
        } catch (err: any) {
          if (epoch === calculationEpochRef.current) {
            setErrorMsg(err.message || '重採樣自訂 SVG 失敗');
          }
        } finally {
          if (epoch === calculationEpochRef.current) {
            setIsCalculating(false);
          }
        }
      };

      runResample();
    } else if (!customSvgFileName) {
      loadPreset(selectedPresetId, canvasSize.width, canvasSize.height, samplingResolution);
    }
  }, [canvasSize.width, canvasSize.height, samplingResolution, manualConfirmMode]);

  // Automatically set activeCircles to use full resolution coefficients for max detail and instant responsiveness
  useEffect(() => {
    const currentCount = fourierCoefficients.length;
    if (currentCount > 0) {
      setActiveCircles(currentCount);
      setDraftActiveCircles(currentCount);
    }
  }, [fourierCoefficients]);

  // --- 2.5 Manual Parameter Apply Handler ---
  const handleApplyChanges = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    const presetChanged = (draftPresetId !== selectedPresetId);
    const fileChanged = (draftCustomSvgFileName !== customSvgFileName || draftCustomSvgText !== customSvgText);
    const resolutionChanged = (draftResolution !== samplingResolution);

    // Synchronize drafts with live active parameters
    setActiveCircles(draftActiveCircles);
    setSpeedMultiplier(draftSpeedMultiplier);
    setTrailRatio(draftTrailRatio);
    setSamplingResolution(draftResolution);

    // Standard reset of drawing timeline elements for complete clean restart
    timeRef.current = 0;
    drawnPathRef.current = [];
    stepCounterRef.current = 0;
    setCycleCompletionProgress(0);

    // If DFT calculation needs to be recalculated (due to resolution, preset, or file updates)
    if (presetChanged || fileChanged || resolutionChanged) {
      setIsCalculating(true);
      setCalcProgress({ percent: 0, current: 0, total: 10 });

      const epoch = ++calculationEpochRef.current;
      try {
        let rawPoints: Point[] = [];
        
        if (draftPresetId === 'custom' && draftCustomSvgText) {
          rawPoints = samplePointsFromSVG(draftCustomSvgText, draftResolution);
          setCustomSvgFileName(draftCustomSvgFileName);
          setCustomSvgText(draftCustomSvgText);
          setSelectedPresetId('custom');
        } else {
          // Standard Preset Paths compiling
          const preset = PRESET_PATHS.find(p => p.id === draftPresetId);
          if (preset) {
            if (preset.svgPath) {
              rawPoints = samplePointsFromSVG(
                `<svg viewBox="0 0 800 800"><path d="${preset.svgPath}" /></svg>`,
                draftResolution
              );
            } else if (preset.mathType) {
              rawPoints = generateMathematicalCurve(preset.mathType, draftResolution);
            }
            setCustomSvgFileName(null);
            setCustomSvgText(null);
            setSelectedPresetId(draftPresetId);
          }
        }

        if (rawPoints.length === 0) {
          throw new Error('無法從選取的參數中產生採樣點！');
        }

        const scaled = centerAndScalePoints(rawPoints, canvasSize.width, canvasSize.height);
        
        const dftOutput = await computeDFTAsync(scaled, (percent, current, total) => {
          if (epoch === calculationEpochRef.current) {
            setCalcProgress({ percent, current, total });
          }
        });

        if (epoch !== calculationEpochRef.current) return;

        setSampledPoints(scaled);
        dftOutput.sort((a, b) => b.amp - a.amp);
        setFourierCoefficients(dftOutput);
        
        // Match activecircles boundary to coefficients
        const maxCircles = dftOutput.length;
        if (draftActiveCircles > maxCircles) {
          setActiveCircles(maxCircles);
          setDraftActiveCircles(maxCircles);
        } else {
          setActiveCircles(draftActiveCircles);
        }

        setIsPlaying(true);
        setSuccessMsg(
          currentLang === 'zh-TW'
            ? `參數套用成功！已重新完成傅立葉採樣（共 ${dftOutput.length} 合成諧波），開始繪製。`
            : currentLang === 'zh-CN'
            ? `参数套用成功！已重新完成傅氏采样（共 ${dftOutput.length} 合成谐波），开始绘制。`
            : `Parameters applied! Resampled with ${dftOutput.length} harmonics, tracing started.`
        );
        setTimeout(() => setSuccessMsg(null), 5000);
      } catch (err: any) {
        if (epoch === calculationEpochRef.current) {
          setErrorMsg(err.message || '採樣計算失敗');
        }
      } finally {
        if (epoch === calculationEpochRef.current) {
          setIsCalculating(false);
        }
      }
    } else {
      // Epicycles, speed representation, or trail limits updated without resampling
      setIsPlaying(true);
      setSuccessMsg(
        currentLang === 'zh-TW'
          ? `參數已完美更新，且無需重新採樣！`
          : currentLang === 'zh-CN'
          ? `参数已完美更新，且无需重新采样！`
          : `Parameters updated without recalculation!`
      );
      setTimeout(() => setSuccessMsg(null), 3000);
    }
  };

  // --- 3. Custom SVG File Upload ---
  const handleSvgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    setSuccessMsg(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) {
        setErrorMsg('檔案內容為空，請選擇正確的 SVG 向量檔！');
        return;
      }

      // Validate if it is genuine XML/SVG
      if (!text.includes('<svg') && !text.includes('<path')) {
         setErrorMsg('此檔案似乎不是標準的 SVG 圖片文件。請確定內置 <path> 線段！');
         return;
      }

      // If manual mode is active, prevent instant recalculation and cache to draft parameters instead
      if (manualConfirmMode) {
        setDraftPresetId('custom');
        setDraftCustomSvgFileName(file.name);
        setDraftCustomSvgText(text);
        setSuccessMsg(
          currentLang === 'zh-TW'
            ? `已將「${file.name}」載入至暫存參數中。請在調整周轉圓/流速/採樣解析度後，點擊「套用參數」開始繪製。`
            : currentLang === 'zh-CN'
            ? `已将「${file.name}」载入至暂存参数中。请在调整周转圆/流速/采样解析度后，点击「套用参数」开始绘制。`
            : `Draft SVG loaded from "${file.name}". Click "Apply Parameters & Start Tracing" to start drawing!`
        );
        setTimeout(() => setSuccessMsg(null), 6000);
        return;
      }

      const epoch = ++calculationEpochRef.current;
      setIsCalculating(true);
      setCalcProgress({ percent: 0, current: 0, total: 10 });

      const runCompilation = async () => {
        try {
          const rawPoints = samplePointsFromSVG(text, samplingResolution);
          if (rawPoints.length === 0) {
            throw new Error('SVG 中未檢測到可用的向量路徑座標點！');
          }

          const scaled = centerAndScalePoints(rawPoints, canvasSize.width, canvasSize.height);

          const dftOutput = await computeDFTAsync(scaled, (percent, current, total) => {
            if (epoch === calculationEpochRef.current) {
              setCalcProgress({ percent, current, total });
            }
          });

          if (epoch !== calculationEpochRef.current) return;

          setSampledPoints(scaled);
          dftOutput.sort((a, b) => b.amp - a.amp);
          setFourierCoefficients(dftOutput);

          setCustomSvgFileName(file.name);
          setCustomSvgText(text);
          setSelectedPresetId('custom');
          timeRef.current = 0;
          drawnPathRef.current = [];
          stepCounterRef.current = 0;
          setCycleCompletionProgress(0);
          
          if (autoPlayOnUpload) {
            setIsPlaying(true);
          } else {
            setIsPlaying(false);
          }

          setSuccessMsg(
            currentLang === 'zh-TW'
              ? `解鎖成功！已從「${file.name}」解析出 ${rawPoints.length} 個採樣錨點。${
                  autoPlayOnUpload ? '開始自動播放繪製！' : '請點擊「播放」按鈕開始繪製。'
                }`
              : currentLang === 'zh-CN'
              ? `解锁成功！已从「${file.name}」解析出 ${rawPoints.length} 个采样锚点。${
                  autoPlayOnUpload ? '开始自动播放绘制！' : '请点击「播放」按钮开始绘制。'
                }`
              : `Successfully loaded! Extracted ${rawPoints.length} sampling points from "${file.name}". ${
                  autoPlayOnUpload ? 'Autoplay started!' : 'Please click Play to start.'
                }`
          );
          
          // Auto-dismiss success alert
          setTimeout(() => setSuccessMsg(null), 5000);
        } catch (err: any) {
          if (epoch === calculationEpochRef.current) {
            setErrorMsg(
              err.message || 
              (currentLang === 'zh-TW'
                ? '解析上傳檔案失敗。請確定 SVG 包含連續單筆畫閉合 <path>！'
                : currentLang === 'zh-CN'
                ? '解析上传文件失败。请确定 SVG 包含连续单笔画闭合 <path>！'
                : 'Failed to parse uploaded SVG. Ensure it contains a continuous closed vector <path>!')
            );
          }
        } finally {
          if (epoch === calculationEpochRef.current) {
            setIsCalculating(false);
          }
        }
      };

      runCompilation();
    };
    reader.readAsText(file);
  };

  // --- 4. Interactive Frame Generation Loop ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || fourierCoefficients.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const renderFrame = () => {
      // Clear with elegant translucent cyber dark background, giving a slight trace blur if requested,
      // but standard clear is most accurate to see standard paths.
      ctx.fillStyle = '#0f172a'; // Deep slate
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // A. Draw original target guide in a faint dotted grey color
      if (showTargetGuide && sampledPoints.length > 0) {
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.15)'; // Slate light translucent
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 5]);
        for (let i = 0; i < sampledPoints.length; i++) {
          if (i === 0) ctx.moveTo(sampledPoints[i].x, sampledPoints[i].y);
          else ctx.lineTo(sampledPoints[i].x, sampledPoints[i].y);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.setLineDash([]); // Reset
      }

      // B. Chain and compute the Epicycles coordinate sequence
      const numCircles = Math.min(activeCircles, fourierCoefficients.length);
      let x = 0;
      let y = 0;

      // The 0-frequency term (DC Offset) is the centroid, anchoring the circle array
      if (fourierCoefficients.length > 0) {
        x = fourierCoefficients[0].re;
        y = fourierCoefficients[0].im;
      }

      const currentTime = timeRef.current;

      // Start drawing subsequent cycles from index 1 to numCircles
      for (let i = 1; i < numCircles; i++) {
        const prevX = x;
        const prevY = y;

        const coef = fourierCoefficients[i];
        const freq = coef.freq;
        const radius = coef.amp;
        const phase = coef.phase;

        // Calculate the relative angle for the current animation time frame
        const angle = freq * currentTime + phase;
        x += radius * Math.cos(angle);
        y += radius * Math.sin(angle);

        // Draw translucent orbit circles
        if (showCircles && radius > 0.5) {
          ctx.beginPath();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
          ctx.lineWidth = 0.8;
          ctx.arc(prevX, prevY, radius, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Draw radius connection lines
        if (showRadii && radius > 0.5) {
          ctx.beginPath();
          ctx.strokeStyle = i === 1 
            ? 'rgba(99, 102, 241, 0.25)' // Indigo major arm
            : 'rgba(56, 189, 248, 0.18)'; // Cyan secondary arm
          ctx.lineWidth = i === 1 ? 1.5 : 1;
          ctx.moveTo(prevX, prevY);
          ctx.lineTo(x, y);
          ctx.stroke();

          // Anchor little joint nodes
          ctx.beginPath();
          ctx.fillStyle = i === 1 ? '#6366f1' : 'rgba(56, 189, 248, 0.4)';
          ctx.arc(x, y, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // C. Tracing pen pen-tip updates
      // Accumulate traced points if playing
      if (isPlaying) {
        stepCounterRef.current += 1;

        let isOriginal = false;
        if (sampledPoints.length > 0) {
          const total = sampledPoints.length;
          // Calculate the expected index corresponding to the current time angle progress
          const currentProgressRatio = currentTime / (Math.PI * 2);
          const targetIdx = Math.round(currentProgressRatio * (total - 1));

          // Evaluate only points within a localized temporal neighborhood (+/- 6% index range)
          // to properly handle low-harmonic rendering phase lags without matching distant geometry.
          const windowSize = Math.max(12, Math.round(total * 0.06));
          let minDistSq = Infinity;

          for (let i = -windowSize; i <= windowSize; i++) {
            const checkIdx = (targetIdx + i + total) % total;
            const sp = sampledPoints[checkIdx];
            if (sp) {
              const dx = sp.x - x;
              const dy = sp.y - y;
              const distSq = dx * dx + dy * dy;
              if (distSq < minDistSq) {
                minDistSq = distSq;
              }
            }
          }
          // Tighter threshold: 8 pixels (64). If circles are low, it might be slightly far,
          // but we will also draw the authentic path when trailRatio === 1.0.
          isOriginal = minDistSq < 64;

          // Double check: is this a jump segment?
          // If we are drawing consecutive points, and they are far, it's a transient jump.
          if (drawnPathRef.current.length > 0) {
            const prev = drawnPathRef.current[drawnPathRef.current.length - 1];
            const dx = x - prev.x;
            const dy = y - prev.y;
            const stepDistSq = dx * dx + dy * dy;
            // If the stylus moves more than 16 pixels in a single step, it is jumping/flying!
            if (stepDistSq > 256) {
              isOriginal = false;
            }
          }
        }

        drawnPathRef.current.push({
          x,
          y,
          isOriginal,
          addedAt: stepCounterRef.current
        });

        // Optimization: Keep historical tracing buffer bounded during playback
        const maxBufferLength = Math.max(5, Math.round(fourierCoefficients.length * trailRatio));
        if (drawnPathRef.current.length > maxBufferLength * 2) {
          drawnPathRef.current = drawnPathRef.current.filter(pt => {
            return (trailRatio === 1.0 && pt.isOriginal) || (stepCounterRef.current - pt.addedAt < maxBufferLength);
          });
        }
      }

      // D. Draw the completed path trace with cyberpunk glowing curves
      const currentPath = drawnPathRef.current;
      const jumpThreshold = 18; // Threshold to prevent drawing connecting lines in gaps

      // D1. Draw the permanent clean traced original SVG path up to current progress (if trailRatio is 100%)
      if (trailRatio === 1.0 && sampledPoints.length > 0) {
        ctx.beginPath();
        if (neonGlowEnabled) {
          ctx.shadowBlur = 12;
          ctx.shadowColor = strokeColor;
        } else {
          ctx.shadowBlur = 0;
        }
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 2.8;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        const currentProgressRatio = currentTime / (Math.PI * 2);
        const maxIndex = Math.round(currentProgressRatio * (sampledPoints.length - 1));

        let isDrawing = false;
        for (let i = 0; i <= maxIndex; i++) {
          const pt = sampledPoints[i];
          if (i === 0) {
            ctx.moveTo(pt.x, pt.y);
            isDrawing = true;
          } else {
            const prevPt = sampledPoints[i - 1];
            const dx = pt.x - prevPt.x;
            const dy = pt.y - prevPt.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // If the distance between original SVG consecutive sample points exceeds threshold,
            // it is a disconnected jump segment! We lift the pen to NOT draw this connecting line!
            if (dist > jumpThreshold) {
              isDrawing = false;
            } else {
              if (!isDrawing) {
                ctx.moveTo(pt.x, pt.y);
                isDrawing = true;
              } else {
                ctx.lineTo(pt.x, pt.y);
              }
            }
          }
        }
        ctx.stroke();
        ctx.shadowBlur = 0; // Restore standard shadows
      }

      // D2. Draw the dynamic stylus comet tail
      if (currentPath.length > 0) {
        ctx.beginPath();
        // Setup glow styling
        if (neonGlowEnabled) {
          ctx.shadowBlur = 12;
          ctx.shadowColor = strokeColor;
        } else {
          ctx.shadowBlur = 0;
        }
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 2.8;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        const maxBufferLength = Math.max(5, Math.round(fourierCoefficients.length * trailRatio));
        const currentStep = stepCounterRef.current;

        let lastSegmentDrew = false;
        for (let i = 0; i < currentPath.length; i++) {
          const pt = currentPath[i];
          
          // Original points stay permanently if trailRatio is 100%, otherwise we only show the fading tail
          const shouldRender = (trailRatio === 1.0 ? pt.isOriginal : false) || (currentStep - pt.addedAt < maxBufferLength);

          if (shouldRender) {
            // Prevent drawing connecting jump lines in the stylus path!
            if (i > 0) {
              const prev = currentPath[i - 1];
              const dx = pt.x - prev.x;
              const dy = pt.y - prev.y;
              if (dx * dx + dy * dy > jumpThreshold * jumpThreshold) {
                lastSegmentDrew = false;
              }
            }

            if (!lastSegmentDrew) {
              ctx.moveTo(pt.x, pt.y);
              lastSegmentDrew = true;
            } else {
              ctx.lineTo(pt.x, pt.y);
            }
          } else {
            lastSegmentDrew = false;
          }
        }
        ctx.stroke();
        
        ctx.shadowBlur = 0; // Restore standard shadows immediately
      }

      // Draw the glowing active stylus pen-tip pointer
      ctx.beginPath();
      ctx.fillStyle = '#ffffff';
      ctx.shadowBlur = 10;
      ctx.shadowColor = strokeColor;
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // E. Update timeline time steps
      if (isPlaying) {
        // Step according to speed multiplier
        const baseSpeed = (Math.PI * 2) / fourierCoefficients.length;
        const dt = baseSpeed * speedMultiplier;
        
        let nextVal = timeRef.current + dt;
        if (nextVal >= Math.PI * 2) {
          // Completed a loop! Flash clear path to restart rendering cleanly
          nextVal = 0;
          drawnPathRef.current = [];
          stepCounterRef.current = 0;

          if (isRecordingRef.current) {
            // Stop recorder, delay slightly to let the last frames render perfectly
            setIsPlaying(false);
            setTimeout(() => {
              if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                mediaRecorderRef.current.stop();
              }
            }, 300);
          }
        }
        timeRef.current = nextVal;

        const nextProgress = Math.min(100, Math.round((nextVal / (Math.PI * 2)) * 100));
        setCycleCompletionProgress(prev => (prev !== nextProgress ? nextProgress : prev));
      }

      animationFrameRef.current = requestAnimationFrame(renderFrame);
    };

    renderFrame();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [
    fourierCoefficients,
    activeCircles,
    isPlaying,
    speedMultiplier,
    showCircles,
    showRadii,
    showTargetGuide,
    neonGlowEnabled,
    strokeColor,
    sampledPoints,
    trailRatio
  ]);

  // Clean path tracing history whenever state reset or preset changes
  const handleResetTimeline = () => {
    timeRef.current = 0;
    drawnPathRef.current = [];
    stepCounterRef.current = 0;
    setCycleCompletionProgress(0);
  };

  // Start automated high fidelity canvas drawing flow video recording
  const startVideoRecording = () => {
    if (!canvasRef.current) return;

    // Reset timeline for a full clean start
    setIsPlaying(false);
    timeRef.current = 0;
    drawnPathRef.current = [];
    stepCounterRef.current = 0;
    setCycleCompletionProgress(0);

    // Let state propagate momentarily
    setTimeout(() => {
      try {
        const stream = canvasRef.current!.captureStream(30); // 30fps
        let mimeType = 'video/webm;codecs=vp9';
        
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'video/webm;codecs=vp8';
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = 'video/webm';
            if (!MediaRecorder.isTypeSupported(mimeType)) {
              mimeType = 'video/mp4';
              if (!MediaRecorder.isTypeSupported(mimeType)) {
                mimeType = '';
              }
            }
          }
        }

        const options = mimeType ? { mimeType } : undefined;
        const recorder = new MediaRecorder(stream, options);
        const chunks: Blob[] = [];

        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            chunks.push(e.data);
          }
        };

        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: mimeType || 'video/webm' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
          a.download = `fourier-drawing-${Date.now()}.${ext}`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);

          setIsRecording(false);
          isRecordingRef.current = false;
          setIsPlaying(false);
          setSuccessMsg('影片錄製成功，並已啟動下載！');
          setTimeout(() => setSuccessMsg(null), 4000);
        };

        mediaRecorderRef.current = recorder;
        isRecordingRef.current = true;
        setIsRecording(true);

        // Turn on playing to record the drawing automatically
        recorder.start();
        setIsPlaying(true);
      } catch (err: any) {
        setErrorMsg('您的瀏覽器不支援 Canvas 錄影功能：' + (err.message || err));
        setIsRecording(false);
        isRecordingRef.current = false;
      }
    }, 150);
  };

  // Stop video recording manually if the user decides to stop it prematurely
  const stopVideoRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-[#f1f5f9] flex flex-col font-sans selection:bg-indigo-500/30 selection:text-white antialiased">
      {/* Upper Navigation Header */}
      <header className="border-b border-indigo-950/40 bg-slate-950/60 backdrop-blur-md px-6 py-4 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.1)]">
                <Sparkles size={20} className="animate-pulse" />
              </span>
              <h1 className="text-xl font-semibold tracking-tight text-white font-sans bg-clip-text">
                {t.appTitle} <span className="text-xs text-indigo-400 font-mono tracking-wide bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 ml-2">DFT Engine v1.2</span>
              </h1>
            </div>
            <p className="text-slate-400 text-xs mt-1 max-w-2xl font-sans leading-relaxed">
              {t.appSubtitle}
            </p>
          </div>
          <div className="flex md:flex-row flex-col items-start md:items-center gap-4 self-stretch md:self-auto justify-end">
            {/* Multi-language Selector */}
            <div className="flex items-center gap-1.5 shrink-0 bg-slate-950/80 border border-slate-800/80 rounded-xl px-3 py-1.5 shadow-inner">
              <Globe size={13} className="text-indigo-400 shrink-0" />
              <select
                value={currentLang}
                onChange={(e) => setCurrentLang(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-300 focus:outline-none border-none pr-1 cursor-pointer"
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code} className="bg-slate-950 text-slate-300">
                    {lang.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Auto-start on upload toggle checkbox */}
            <label className="flex items-center gap-2 text-xs text-slate-300 font-medium cursor-pointer select-none group">
              <span className="relative flex items-center">
                <input
                  type="checkbox"
                  checked={autoPlayOnUpload}
                  onChange={(e) => setAutoPlayOnUpload(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500/20 focus:ring-offset-slate-950 cursor-pointer"
                />
              </span>
              <span className="group-hover:text-indigo-400 transition-colors">{t.autoplayOnUpload}</span>
            </label>

            <label className="flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold cursor-pointer transition-all border border-indigo-400/30 shadow-[0_0_15px_rgba(99,102,241,0.15)] select-none shrink-0">
              <Upload size={14} />
              <span>{t.uploadSvg}</span>
              <input
                type="file"
                accept=".svg"
                onChange={handleSvgUpload}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </header>

      {/* Main Workspace Frame */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: Controls, Libraries, Math Panel (4 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          
          {/* Alerts Banner */}
          {errorMsg && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5"
            >
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-rose-200">{t.errorTitle}</p>
                <p className="mt-0.5 text-slate-300 leading-relaxed">{errorMsg}</p>
              </div>
            </motion.div>
          )}

          {successMsg && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-start gap-2.5"
            >
              <CheckCircle size={16} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-emerald-200">{t.successTitle}</p>
                <p className="mt-0.5 text-slate-300 leading-relaxed">{successMsg}</p>
              </div>
            </motion.div>
          )}

          {/* Preset Library Section */}
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 shadow-lg relative overflow-hidden backdrop-blur">
            <h2 className="text-sm font-semibold text-white tracking-wide uppercase flex items-center gap-2 mb-4">
              <Layers size={15} className="text-indigo-400" />
              {t.presetAssetsTitle}
            </h2>

            <div className="grid grid-cols-1 gap-2.5 max-h-[290px] overflow-y-auto pr-1">
              {PRESET_PATHS.map((preset) => {
                const isActive = manualConfirmMode ? (draftPresetId === preset.id) : (selectedPresetId === preset.id);
                
                // Dynamically translate preset Name and Description using t translation properties
                let displayName = preset.name;
                let displayDesc = preset.description;
                if (preset.id === 'portrait') {
                  displayName = t.preset_portrait_name;
                  displayDesc = t.preset_portrait_desc;
                } else if (preset.id === 'butterfly') {
                  displayName = t.preset_butterfly_name;
                  displayDesc = t.preset_butterfly_desc;
                } else if (preset.id === 'swan') {
                  displayName = t.preset_swan_name;
                  displayDesc = t.preset_swan_desc;
                } else if (preset.id === 'music-note') {
                  displayName = t.preset_music_note_name;
                  displayDesc = t.preset_music_note_desc;
                } else if (preset.id === 'infinity') {
                  displayName = t.preset_infinity_name;
                  displayDesc = t.preset_infinity_desc;
                } else if (preset.id === 'rose-pattern') {
                  displayName = t.preset_rose_pattern_name;
                  displayDesc = t.preset_rose_pattern_desc;
                } else if (preset.id === 'butterfly-math') {
                  displayName = t.preset_butterfly_math_name;
                  displayDesc = t.preset_butterfly_math_desc;
                }

                return (
                  <button
                    key={preset.id}
                    onClick={() => {
                      if (manualConfirmMode) {
                        setDraftPresetId(preset.id);
                        setDraftCustomSvgFileName(null);
                        setDraftCustomSvgText(null);
                      } else {
                        loadPreset(preset.id);
                      }
                    }}
                    className={`text-left p-3.5 rounded-xl border transition-all duration-200 cursor-pointer flex flex-col gap-1 relative overflow-hidden group ${
                      isActive
                        ? 'border-indigo-500 bg-indigo-500/10 shadow-[inner_0_0_15px_rgba(99,102,241,0.1)]'
                        : 'border-slate-800/80 bg-slate-950/40 hover:bg-slate-800/40 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-[13px] font-medium transition-colors ${isActive ? 'text-indigo-300' : 'text-slate-200 group-hover:text-white'}`}>
                        {displayName}
                      </span>
                      {preset.svgPath ? (
                        <span className="text-[9px] font-mono tracking-wider px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 uppercase">
                          {t.svgPathTag}
                        </span>
                      ) : (
                        <span className="text-[9px] font-mono tracking-wider px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 uppercase">
                          {t.polarTag}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-normal mt-0.5">
                      {displayDesc}
                    </p>
                    
                    {/* Tiny neon edge highlight */}
                    {isActive && (
                      <span className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-indigo-500 to-indigo-400" />
                    )}
                  </button>
                );
              })}

              {(manualConfirmMode ? draftCustomSvgFileName : customSvgFileName) && (
                <div className="p-3.5 rounded-xl border border-pink-500/30 bg-pink-500/5 flex flex-col gap-1 relative overflow-hidden select-none animate-pulse">
                  <span className="absolute left-0 top-0 bottom-0 w-1 bg-pink-500" />
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-medium text-pink-300 truncate max-w-[180px]">
                      📂 {manualConfirmMode ? draftCustomSvgFileName : customSvgFileName}
                    </span>
                    <span className="text-[9px] font-mono tracking-wider px-1.5 py-0.5 rounded bg-pink-950/60 text-pink-300 uppercase">
                      {manualConfirmMode && draftCustomSvgFileName !== customSvgFileName ? '待套用暫存' : t.customUploadedTag}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-normal mt-0.5">
                    {manualConfirmMode && draftCustomSvgFileName !== customSvgFileName 
                      ? '點擊右方下方的「套用參數」按鈕，繪製區才會開始進行重新採樣。' 
                      : t.customUploadedDesc}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Engine Parameters Section */}
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 shadow-lg backdrop-blur">
            <h2 className="text-sm font-semibold text-white tracking-wide uppercase flex items-center gap-2 mb-4">
              <Sliders size={15} className="text-indigo-400" />
              {t.harmonicsEngineTitle}
            </h2>

            {/* Manual Parameter Apply Switch */}
            <div className="mb-4 p-3.5 bg-slate-950/60 rounded-xl border border-slate-800/40 flex items-center justify-between gap-3 shadow-inner">
              <div className="space-y-0.5 max-w-[75%]">
                <span className="text-xs font-semibold text-slate-100 flex items-center gap-1.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${manualConfirmMode ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 'bg-slate-700'}`} />
                  {currentLang === 'zh-TW' ? '手動確認參數再開始' : currentLang === 'zh-CN' ? '手动确认参数再开始' : 'Manual Apply Mode'}
                </span>
                <p className="text-[10px] text-slate-400 leading-normal">
                  {currentLang === 'zh-TW' 
                    ? '調整解析度/數量/流速時凍結，手動點選套用才採樣重繪' 
                    : currentLang === 'zh-CN'
                    ? '调整解析度/数量/流速时冻结，手动点击套用才采样重绘'
                    : 'Freeze tracing; manually click Apply to resample and redraw'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setManualConfirmMode(!manualConfirmMode)}
                className={`relative inline-flex h-5.5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  manualConfirmMode ? 'bg-indigo-600' : 'bg-slate-800'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    manualConfirmMode ? 'translate-x-4.5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Apply Parameters Pulsing Action Button */}
            {manualConfirmMode && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mb-5 overflow-hidden"
              >
                <button
                  type="button"
                  onClick={handleApplyChanges}
                  className={`w-full py-3 px-4 rounded-xl font-semibold text-xs tracking-wide flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                    hasPendingChanges
                      ? 'bg-gradient-to-r from-amber-500 to-indigo-600 text-white border-amber-400/40 shadow-[0_0_15px_rgba(245,158,11,0.25)] animate-pulse hover:shadow-[0_0_20px_rgba(99,102,241,0.4)] hover:scale-[1.02]'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <Sparkles size={14} className={hasPendingChanges ? 'animate-spin text-amber-300' : 'text-slate-500'} />
                  <span>
                    {hasPendingChanges
                      ? (currentLang === 'zh-TW' ? '套用變更並開始繪製' : currentLang === 'zh-CN' ? '套用变更并开始绘制' : 'Apply Changes & Start Tracing')
                      : (currentLang === 'zh-TW' ? '參數與繪圖同步中 (Applied)' : currentLang === 'zh-CN' ? '参数与绘图同步中 (Applied)' : 'Parameters Applied')}
                  </span>
                </button>
              </motion.div>
            )}

            <div className="space-y-5">
              {/* Resolution Selector (Segmented control) */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                  <span>{t.resolutionLabel}</span>
                  <span className="text-[10px] text-slate-400 font-mono">{t.resolutionSub}</span>
                </label>
                <div className="grid grid-cols-5 sm:grid-cols-10 gap-1 p-1 bg-slate-950/80 rounded-xl border border-slate-800/80 font-mono">
                  {[1000, 2000, 3500, 4000, 5000, 6000, 7000, 8000, 9000, 10000].map((res) => {
                    const isSelected = manualConfirmMode ? draftResolution === res : samplingResolution === res;
                    return (
                      <button
                        key={res}
                        type="button"
                        onClick={() => {
                          if (manualConfirmMode) {
                            setDraftResolution(res);
                          } else {
                            setSamplingResolution(res);
                            setDraftResolution(res);
                          }
                        }}
                        className={`py-2 text-[10px] font-mono font-semibold rounded-lg transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
                        }`}
                      >
                        {res}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-slate-500 leading-normal">
                  {t.resolutionTip}
                </p>
              </div>

              {/* Slider 1: Number of Active Circles */}
              <div className="space-y-2">
                <div className="flex justify-between items-baseline">
                  <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                    <span>{t.epicyclesLabel}</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      ({manualConfirmMode ? draftActiveCircles : activeCircles} / {fourierCoefficients.length || 0})
                    </span>
                  </label>
                  <span className="text-xs font-mono font-semibold text-indigo-400">
                    N = {manualConfirmMode ? draftActiveCircles : activeCircles}
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max={Math.max(1, fourierCoefficients.length)}
                  value={manualConfirmMode ? draftActiveCircles : activeCircles}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (manualConfirmMode) {
                      setDraftActiveCircles(val);
                    } else {
                      setActiveCircles(val);
                      setDraftActiveCircles(val);
                    }
                  }}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>1 ({t.epicyclesLeft})</span>
                  <span>➔</span>
                  <span>{fourierCoefficients.length} ({t.epicyclesRight})</span>
                </div>
              </div>

              {/* Slider 2: Speed Factor */}
              <div className="space-y-2">
                <div className="flex justify-between items-baseline">
                  <label className="text-xs font-medium text-slate-300">
                    {t.speedLabel}
                  </label>
                  <span className="text-xs font-mono font-semibold text-indigo-400">
                    {(manualConfirmMode ? draftSpeedMultiplier : speedMultiplier).toFixed(1)}x
                  </span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="10.0"
                  step="0.1"
                  value={manualConfirmMode ? draftSpeedMultiplier : speedMultiplier}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (manualConfirmMode) {
                      setDraftSpeedMultiplier(val);
                    } else {
                      setSpeedMultiplier(val);
                      setDraftSpeedMultiplier(val);
                    }
                  }}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 focus:outline-none"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>{t.speedLeft}</span>
                  <span>{t.speedStandard}</span>
                  <span>{t.speedRight}</span>
                </div>

                {/* Speed Quick Presets */}
                <div className="flex flex-wrap gap-1 mt-1 bg-slate-950/40 p-1 rounded-lg border border-slate-800/50">
                  {[0.1, 0.5, 1.0, 2.0, 5.0, 10.0].map((preset) => {
                    const isSelected = manualConfirmMode ? draftSpeedMultiplier === preset : speedMultiplier === preset;
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          if (manualConfirmMode) {
                            setDraftSpeedMultiplier(preset);
                          } else {
                            setSpeedMultiplier(preset);
                            setDraftSpeedMultiplier(preset);
                          }
                        }}
                        className={`flex-1 py-1 text-[10px] font-mono font-bold rounded-md transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30 border border-transparent'
                        }`}
                      >
                        {preset.toFixed(1)}x
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Switches Box */}
              <div className="border-t border-slate-800/60 pt-4 grid grid-cols-2 gap-3.5">
                <label className="flex items-center gap-2.5 cursor-pointer group select-none">
                  <input
                    type="checkbox"
                    checked={showCircles}
                    onChange={(e) => setShowCircles(e.target.checked)}
                    className="rounded border-slate-800 text-indigo-500 focus:ring-slate-800 focus:ring-offset-0 bg-slate-950 h-4 w-4"
                  />
                  <span className="text-xs text-slate-300 group-hover:text-white transition-colors">
                    {t.toggleOrbits}
                  </span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer group select-none">
                  <input
                    type="checkbox"
                    checked={showRadii}
                    onChange={(e) => setShowRadii(e.target.checked)}
                    className="rounded border-slate-800 text-indigo-500 focus:ring-slate-800 focus:ring-offset-0 bg-slate-950 h-4 w-4"
                  />
                  <span className="text-xs text-slate-300 group-hover:text-white transition-colors">
                    {t.toggleRadii}
                  </span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer group select-none">
                  <input
                    type="checkbox"
                    checked={showTargetGuide}
                    onChange={(e) => setShowTargetGuide(e.target.checked)}
                    className="rounded border-slate-800 text-indigo-500 focus:ring-slate-800 focus:ring-offset-0 bg-slate-950 h-4 w-4"
                  />
                  <span className="text-xs text-slate-300 group-hover:text-white transition-colors">
                    {t.toggleGuide}
                  </span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer group select-none">
                  <input
                    type="checkbox"
                    checked={neonGlowEnabled}
                    onChange={(e) => setNeonGlowEnabled(e.target.checked)}
                    className="rounded border-slate-800 text-indigo-500 focus:ring-slate-800 focus:ring-offset-0 bg-slate-950 h-4 w-4"
                  />
                  <span className="text-xs text-slate-300 group-hover:text-white transition-colors">
                    {t.toggleNeon}
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Colorizer & Canvas Settings Customizer */}
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 shadow-lg backdrop-blur">
            <h2 className="text-sm font-semibold text-white tracking-wide uppercase flex items-center gap-2 mb-3">
              <Palette size={15} className="text-indigo-400" />
              {t.penStylingTitle}
            </h2>
            <div className="space-y-4">
              {/* Colorizer */}
              <div className="space-y-2">
                <span className="text-xs text-slate-300 block">{t.strokeColorLabel}</span>
                <div className="flex flex-wrap gap-2">
                  {strokeColors.map((color) => (
                    <button
                      key={color.value}
                      onClick={() => setStrokeColor(color.value)}
                      className={`relative w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer ${color.className} ${
                        strokeColor === color.value
                          ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-950 scale-110 shadow-lg'
                          : 'hover:scale-105'
                      }`}
                      title={color.label}
                    >
                      {strokeColor === color.value && (
                        <span className="w-1.5 h-1.5 bg-black rounded-full" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Trail delay controls (the dynamic fading trail tail requested by user) */}
              <div className="space-y-2 border-t border-slate-800/60 pt-3">
                <div className="flex justify-between items-baseline">
                  <span className="text-xs text-slate-300 block">{t.trailDelayLabel}</span>
                  <span className="text-xs font-mono font-semibold text-indigo-400">
                    {(manualConfirmMode ? draftTrailRatio : trailRatio) === 1.0 
                      ? t.trailRatioFull 
                      : `${Math.round((manualConfirmMode ? draftTrailRatio : trailRatio) * 100)}%`}
                  </span>
                </div>
                <div className="grid grid-cols-5 sm:grid-cols-10 gap-1 p-1 bg-slate-950/80 rounded-xl border border-slate-800/80">
                  {[0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0].map((ratio) => {
                    const isSelected = manualConfirmMode ? draftTrailRatio === ratio : trailRatio === ratio;
                    return (
                      <button
                        key={ratio}
                        type="button"
                        onClick={() => {
                          if (manualConfirmMode) {
                            setDraftTrailRatio(ratio);
                          } else {
                            setTrailRatio(ratio);
                            setDraftTrailRatio(ratio);
                            // Filter/slice the active drawn path buffer straight away
                            const maxLen = Math.max(5, Math.round(fourierCoefficients.length * ratio));
                            drawnPathRef.current = drawnPathRef.current.filter(
                              pt => pt.isOriginal || (stepCounterRef.current - pt.addedAt < maxLen)
                            );
                          }
                        }}
                        className={`py-1.5 text-[10px] font-mono font-semibold rounded-lg transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
                        }`}
                      >
                        {ratio === 1.0 ? t.trailRatioNoVanish : `${Math.round(ratio * 100)}`}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-slate-500 leading-normal">
                  {t.trailTip}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Tracing Stage & Analytics (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          
          {/* Main Visual Stage Panel */}
          <div className="bg-slate-900/40 border border-slate-850/80 rounded-3xl p-4 md:p-6 shadow-xl relative backdrop-blur flex flex-col items-center">
            
            {/* Canvas Header */}
            <div className="w-full flex items-center justify-between mb-4 px-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-semibold text-slate-300 font-mono tracking-wider">
                  {t.timeCycleTrack}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-slate-400 text-xs font-sans">
                  {t.pathCompletion}: <span className="text-indigo-400 font-semibold">{cycleCompletionProgress}%</span>
                </span>
                <div className="h-1.5 w-20 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 transition-all duration-100"
                    style={{ width: `${cycleCompletionProgress}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Tracing Area Wrapper */}
            <div 
              ref={wrapperRef}
              className="w-full relative flex items-center justify-center rounded-2xl bg-slate-950 border border-slate-900 overflow-hidden shadow-inner aspect-square"
            >
              <canvas
                ref={canvasRef}
                width={canvasSize.width}
                height={canvasSize.height}
                className="block max-w-full h-auto cursor-crosshair"
              />

              {/* Draft pending updates overlay warning badge */}
              {manualConfirmMode && hasPendingChanges && (
                <div className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-amber-500/30 bg-amber-950/80 backdrop-blur-md text-amber-400 text-[10px] font-semibold tracking-wider shadow-[0_0_15px_rgba(245,158,11,0.15)] z-20 select-none animate-bounce">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  <span>{currentLang === 'zh-TW' ? '參數待套用' : currentLang === 'zh-CN' ? '参数待套用' : 'Pending Apply'}</span>
                </div>
              )}

              {/* Animated Record Indicator */}
              {isRecording && (
                <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full border border-rose-500/30 bg-rose-950/70 backdrop-blur-md text-rose-400 text-[10px] font-mono font-bold tracking-widest shadow-[0_0_15px_rgba(239,68,68,0.25)] z-20 select-none">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping inline-block shrink-0" />
                  <span>{t.recordingActive} {cycleCompletionProgress}%</span>
                </div>
              )}

              {/* Async task calculation overlay with step detail task checker requested by user */}
              <AnimatePresence>
                {isCalculating && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-slate-950/90 backdrop-blur-md z-30 flex flex-col items-center justify-center p-6 text-center"
                  >
                    <div className="relative mb-5">
                      <div className="w-16 h-16 rounded-full border-4 border-indigo-500/10 border-t-indigo-500 animate-spin" />
                      <Sparkles className="absolute inset-0 m-auto text-indigo-400 animate-pulse" size={24} />
                    </div>

                    <h3 className="text-sm font-bold text-white mb-1.5 tracking-wide flex items-center gap-1.5">
                      <span>{t.calculatingTitle}</span>
                      <span className="text-[10px] bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded font-mono">
                        {samplingResolution} pts
                      </span>
                    </h3>

                    <p className="text-[11px] text-slate-400 max-w-[280px] mb-4 leading-normal">
                      {t.calculatingSub}
                    </p>

                    {/* Progress bar */}
                    <div className="w-full max-w-[240px] bg-slate-900 rounded-full h-1.5 mb-2.5 overflow-hidden border border-slate-800">
                      <div
                        className="bg-indigo-500 h-full transition-all duration-200 shadow-[0_0_12px_rgba(99,102,241,0.6)] animate-pulse"
                        style={{ width: `${calcProgress.percent}%` }}
                      />
                    </div>

                    {/* Task dots and counter */}
                    <div className="flex flex-col gap-1.5 w-full max-w-[240px] items-center">
                      <span className="text-[10px] font-mono font-bold text-slate-300">
                        {t.splitTaskLabel} {calcProgress.current} / {calcProgress.total} {t.splitTaskSub} ({calcProgress.percent}%)
                      </span>
                      
                      <div className="flex gap-1.5 mt-0.5">
                        {Array.from({ length: calcProgress.total }).map((_, i) => (
                          <span
                             key={i}
                             className={`w-3 h-1 rounded-full transition-all duration-300 ${
                               i < calcProgress.current
                                 ? 'bg-indigo-500 scale-x-110'
                                 : 'bg-slate-800'
                             }`}
                          />
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Playback Controls Float Block */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 border border-slate-800 bg-slate-950/85 backdrop-blur-md rounded-2xl flex items-center gap-4 shadow-xl select-none">
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  disabled={isRecording}
                  className={`p-2 rounded-xl transition ${
                    isRecording 
                      ? 'text-slate-600 cursor-not-allowed opacity-40' 
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/50 cursor-pointer'
                  }`}
                  title={isRecording ? t.playbackLocked : isPlaying ? t.pauseAnimation : t.playTrace}
                >
                  {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                </button>

                <button
                  onClick={handleResetTimeline}
                  disabled={isRecording}
                  className={`p-2 rounded-xl transition ${
                    isRecording 
                      ? 'text-slate-600 cursor-not-allowed opacity-40' 
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/50 cursor-pointer'
                  }`}
                  title={t.resetTooltip}
                >
                  <RotateCcw size={18} />
                </button>

                <div className="w-px h-5 bg-slate-800" />

                <button
                  onClick={isRecording ? stopVideoRecording : startVideoRecording}
                  disabled={isCalculating}
                  className={`p-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
                    isRecording
                      ? 'text-rose-500 hover:text-rose-400 bg-rose-500/10 border border-rose-500/25 shadow-[0_0_8px_rgba(239,68,68,0.25)]'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                  } ${isCalculating ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title={isRecording ? t.videoBtnTooltipStop : t.videoBtnTooltipRecord}
                >
                  <Video size={18} className={isRecording ? 'animate-pulse text-rose-500' : ''} />
                  <span className="text-[10px] font-semibold tracking-wide hidden sm:inline">
                    {isRecording ? t.videoBtnLabelActive : t.videoBtnLabelIdle}
                  </span>
                </button>
              </div>
            </div>

            {/* Canvas Footer Analytics Grid */}
            <div className="w-full mt-4 grid grid-cols-3 gap-4 border-t border-slate-800/50 pt-4 text-center">
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-sans">{t.totalHarmonics}</p>
                <p className="text-lg font-semibold text-slate-200 mt-0.5 font-mono">{fourierCoefficients.length}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-sans">{t.currentEpicycles}</p>
                <p className="text-lg font-semibold text-indigo-400 mt-0.5 font-mono">{activeCircles}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-sans">{t.angularVelocity}</p>
                <p className="text-lg font-semibold text-purple-400 mt-0.5 font-mono">
                  {((2 * Math.PI) / (fourierCoefficients.length || 1) * speedMultiplier).toFixed(5)}
                </p>
              </div>
            </div>
          </div>

          {/* Real-time Spectrum Analyzer */}
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 shadow-lg backdrop-blur">
            <h2 className="text-sm font-semibold text-white tracking-wide uppercase flex items-center gap-2 mb-4">
              <LineChart size={15} className="text-indigo-400" />
              傅立葉頻譜與振幅能量分析 (Frequency Spectrum)
            </h2>

            {/* Visual Bars for Amplitudes */}
            <div className="space-y-4">
              <div className="h-[90px] w-full bg-slate-950 rounded-xl border border-slate-900 p-3 flex items-end gap-[2px] overflow-hidden">
                {fourierCoefficients.length === 0 ? (
                  <div className="w-full h-full flex items-center justify-center text-xs text-slate-600">
                    等待頻譜數據計算中...
                  </div>
                ) : (
                  fourierCoefficients.slice(0, 55).map((coef, idx) => {
                    // Skip the massive stationary DC term idx = 0 for better relative bar visualization representation
                    if (idx === 0) return null;
                    const magnitudePct = Math.min(100, Math.log10(coef.amp * 1.5 + 1) * 45);
                    const isActive = idx < activeCircles;

                    return (
                      <div
                        key={idx}
                        className="flex-1 flex flex-col items-center group relative cursor-help h-full justify-end"
                      >
                        {/* Hover Tooltip card over bar */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 bg-slate-900 border border-slate-800 text-[10px] rounded shadow-xl hidden group-hover:block transition-all z-20 whitespace-nowrap text-left">
                          <p className="font-mono text-indigo-300">階數(指數): k = {coef.freq}</p>
                          <p className="font-mono text-slate-400">振幅幅度: {coef.amp.toFixed(3)}</p>
                          <p className="font-mono text-slate-400">相位初始: {(coef.phase * (180 / Math.PI)).toFixed(1)}°</p>
                        </div>

                        {/* Bar Segment */}
                        <div
                          style={{ height: `${magnitudePct || 2}%` }}
                          className={`w-full rounded-t-[1px] transition-all duration-300 ${
                            isActive
                              ? 'bg-gradient-to-t from-indigo-600 to-indigo-400 hover:sky-400'
                              : 'bg-slate-800 hover:bg-slate-700'
                          }`}
                        />
                      </div>
                    );
                  })
                )}
              </div>

              <div className="flex justify-between items-baseline text-[11px] text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded bg-indigo-500 inline-block" />
                  <span>{t.spectrumLegendActive}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded bg-slate-800 inline-block" />
                  <span>{t.spectrumLegendInactive}</span>
                </span>
                <span className="text-[10px] text-right text-slate-500 font-mono">
                  {t.spectrumFooter}
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* FOOTER: Mathematical Explanation Section */}
      <footer className="mt-auto border-t border-indigo-950/40 bg-slate-950/60 p-6 md:p-8 shrink-0">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
              <HelpCircle size={16} className="text-indigo-400" />
              {t.mathTitle}
            </h3>
            <button
              onClick={() => setMathPanelOpen(!mathPanelOpen)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800/50 transition cursor-pointer"
            >
              {mathPanelOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>

          <AnimatePresence>
            {mathPanelOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden space-y-5 text-xs text-slate-400 leading-relaxed"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-1">
                  <div className="space-y-3">
                    <h4 className="font-semibold text-indigo-300">{t.math1Title}</h4>
                    <p>
                      {t.math1Desc}
                    </p>
                    <h4 className="font-semibold text-indigo-300 mt-4">{t.math2Title}</h4>
                    <p>
                      {t.math2Desc}
                    </p>
                    <div className="bg-slate-950/45 p-3 rounded-xl border border-slate-900 font-mono text-indigo-400/90 text-center select-all my-2">
                      X_k = 1/N * Σ [z_n * e^(-i * 2π * k * n / N)]
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-semibold text-indigo-300">{t.math3Title}</h4>
                    <p>
                      {t.math3Desc}
                    </p>
                    <div className="bg-slate-950/45 p-3 rounded-xl border border-slate-900 font-mono text-indigo-400/90 text-center select-all my-2">
                      f(t) = Σ |X_k| * e^(i * (k * t + phase_k))
                    </div>
                    <p className="text-slate-500 text-[11px]">
                      {t.math3Footer}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="text-center text-[10px] text-slate-600 border-t border-slate-900/60 pt-4">
            {t.copyright}
          </div>
        </div>
      </footer>
    </div>
  );
}
