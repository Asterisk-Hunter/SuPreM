"use client";

import { useCallback, useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileCheck, FolderOpen, Loader2, CheckCircle2 } from "lucide-react";

interface Props {
  onUpload: (file: File) => void;
  isProcessing: boolean;
  uploadByteProgress?: number; // 0 to 100% from XHR upload
  recentScansCount?: number;
  onOpenRecentScans?: () => void;
}

const INFERENCE_STEPS = [
  { label: "Uploading CT volume", desc: "Sending scan bytes to server..." },
  { label: "Preprocessing volume", desc: "Resampling & normalizing HU values..." },
  { label: "Running SuPreM AI model", desc: "Segmenting 13 abdominal organs..." },
  { label: "Generating 2D/3D overlays", desc: "Building slice masks & 3D meshes..." },
  { label: "Finalizing scan statistics", desc: "Computing volume metrics & coverage..." },
];

export default function FileUpload({
  onUpload,
  isProcessing,
  uploadByteProgress = 0,
  recentScansCount = 0,
  onOpenRecentScans,
}: Props) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Timer for elapsed seconds during processing
  useEffect(() => {
    if (!isProcessing) {
      setElapsedSeconds(0);
      setCurrentStepIndex(0);
      return;
    }

    const timer = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [isProcessing]);

  // Determine actual display percentage and step index
  // Phase 1 (0-100 uploadByteProgress): mapping to 0-35% of total
  // Phase 2 (uploadByteProgress === 100): asymptotic approach 35% -> 94%
  let displayPercent = 0;
  if (isProcessing) {
    if (uploadByteProgress < 100) {
      displayPercent = Math.max(5, Math.floor(uploadByteProgress * 0.35));
    } else {
      // Asymptotic curve: 35 + 59 * (1 - exp(-elapsed / 20))
      // Never reaches 100% while waiting for backend response!
      displayPercent = Math.min(
        94,
        Math.floor(35 + 59 * (1 - Math.exp(-elapsedSeconds / 22)))
      );
    }
  }

  // Update step index based on progress/time
  useEffect(() => {
    if (!isProcessing) return;
    if (uploadByteProgress < 100) {
      setCurrentStepIndex(0);
    } else if (elapsedSeconds < 8) {
      setCurrentStepIndex(1);
    } else if (elapsedSeconds < 25) {
      setCurrentStepIndex(2);
    } else if (elapsedSeconds < 40) {
      setCurrentStepIndex(3);
    } else {
      setCurrentStepIndex(4);
    }
  }, [isProcessing, uploadByteProgress, elapsedSeconds]);

  const onDrop = useCallback(
    (files: File[]) => {
      if (files[0]) onUpload(files[0]);
    },
    [onUpload]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/octet-stream": [".nii", ".nii.gz"] },
    multiple: false,
    disabled: isProcessing,
  });

  const formatElapsed = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="w-full flex flex-col items-center gap-4">
      <div
        {...getRootProps()}
        className={`
          flex flex-col items-center justify-center gap-6
          w-full h-full min-h-[420px] p-8
          border-2 border-dashed rounded-xl
          transition-all duration-300
          cursor-pointer shadow-xs hover:shadow-md
          ${
            isDragActive
              ? "border-clinical-amber bg-clinical-amber/5 scale-[1.01]"
              : "border-outline-variant hover:border-primary/50 bg-surface-container-lowest"
          }
          ${isProcessing ? "pointer-events-none border-primary/40 bg-surface-container-low" : ""}
        `}
      >
        <input {...getInputProps()} />

        {isProcessing ? (
          <div className="w-full max-w-md flex flex-col gap-6 px-4 animate-fade-in">
            {/* Header info */}
            <div className="text-center flex flex-col items-center gap-2">
              <div className="p-3 bg-primary/10 rounded-full text-primary">
                <Loader2 className="w-7 h-7 animate-spin" />
              </div>
              <h3 className="text-base font-bold text-on-surface tracking-tight">
                {uploadByteProgress < 100
                  ? `Uploading CT Volume (${uploadByteProgress}%)`
                  : INFERENCE_STEPS[currentStepIndex].label}
              </h3>
              <p className="text-xs text-on-surface-variant max-w-xs">
                {uploadByteProgress < 100
                  ? "Transferring medical DICOM/NIfTI scan to SuPreM inference engine..."
                  : INFERENCE_STEPS[currentStepIndex].desc}
              </p>
            </div>

            {/* Progress bar with dynamic percentage and elapsed time */}
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="font-bold text-primary flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {displayPercent}%
                </span>
                <span className="text-on-surface-variant font-medium">
                  Elapsed: <strong className="text-on-surface">{formatElapsed(elapsedSeconds)}</strong>
                </span>
              </div>

              <div className="w-full h-2 bg-surface-variant rounded-full overflow-hidden p-0.5 border border-outline-variant/30">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${displayPercent}%` }}
                />
              </div>
              <p className="text-[10px] text-outline text-center font-mono mt-0.5">
                AI Segmentation actively running. Please do not close this tab.
              </p>
            </div>

            {/* Step checklist */}
            <div className="flex flex-col gap-2 bg-surface-container-lowest p-3.5 rounded-lg border border-outline-variant/60">
              {INFERENCE_STEPS.map((step, i) => {
                const isDone = i < currentStepIndex || (i === 0 && uploadByteProgress === 100 && currentStepIndex > 0);
                const isCurrent = i === currentStepIndex;

                return (
                  <div
                    key={step.label}
                    className={`flex items-center justify-between text-xs transition-colors ${
                      isDone
                        ? "text-on-surface-variant"
                        : isCurrent
                        ? "text-primary font-semibold"
                        : "text-outline/70"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {isDone ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : isCurrent ? (
                        <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin shrink-0" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-outline-variant shrink-0" />
                      )}
                      <span>{step.label}</span>
                    </div>
                    {isCurrent && (
                      <span className="text-[10px] font-mono text-primary animate-pulse">
                        Active...
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : isDragActive ? (
          <>
            <FileCheck className="w-12 h-12 text-clinical-amber animate-bounce" />
            <p className="text-base font-semibold text-clinical-amber">
              Drop your CT scan file here
            </p>
          </>
        ) : (
          <>
            <div className="p-4 bg-primary/5 rounded-full text-primary border border-outline-variant/40">
              <Upload className="w-8 h-8" />
            </div>
            <div className="text-center max-w-sm">
              <p className="text-base font-bold text-on-surface">
                Upload CT Volume Scan
              </p>
              <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                Drag &amp; drop your NIfTI file or click anywhere in this box to browse local files.
              </p>
              <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 bg-surface-container rounded-full text-[11px] font-mono text-on-surface-variant border border-outline-variant/60">
                <span>Supports .nii &amp; .nii.gz files</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Quick Access to Recent Scans below upload box */}
      {!isProcessing && onOpenRecentScans && recentScansCount > 0 && (
        <div className="w-full flex items-center justify-between p-3 bg-surface-container-low border border-outline-variant rounded-lg text-xs">
          <div className="flex items-center gap-2 text-on-surface-variant">
            <FolderOpen className="w-4 h-4 text-primary" />
            <span>
              You have <strong className="text-on-surface font-semibold">{recentScansCount}</strong> saved scan{recentScansCount > 1 ? "s" : ""} in history.
            </span>
          </div>
          <button
            onClick={onOpenRecentScans}
            className="px-3 py-1 bg-surface hover:bg-surface-container-high border border-outline-variant rounded text-xs font-semibold text-primary transition-colors cursor-pointer"
          >
            Open Recent Scans Folder
          </button>
        </div>
      )}
    </div>
  );
}

