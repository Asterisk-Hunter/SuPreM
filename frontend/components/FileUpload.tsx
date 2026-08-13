"use client";

import { useCallback, useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileCheck } from "lucide-react";

interface Props {
  onUpload: (file: File) => void;
  isProcessing: boolean;
}

const STEPS = [
  "Loading CT volume",
  "Preprocessing",
  "Running AI inference",
  "Generating visualizations",
  "Preparing results",
];

export default function FileUpload({ onUpload, isProcessing }: Props) {
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (!isProcessing) {
      setProgress(0);
      setCurrentStep(0);
      return;
    }

    const duration = 45000; // 45s estimate
    const interval = 100;
    const increment = 100 / (duration / interval);

    const timer = setInterval(() => {
      setProgress((p) => {
        const next = p + increment;
        if (next >= 100) {
          clearInterval(timer);
          return 100;
        }
        return next;
      });
    }, interval);

    const stepTimer = setInterval(() => {
      setCurrentStep((s) => Math.min(s + 1, STEPS.length - 1));
    }, duration / STEPS.length);

    return () => {
      clearInterval(timer);
      clearInterval(stepTimer);
    };
  }, [isProcessing]);

  const onDrop = useCallback(
    (files: File[]) => {
      if (files[0]) onUpload(files[0]);
    },
    [onUpload],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/octet-stream": [".nii", ".nii.gz"] },
    multiple: false,
    disabled: isProcessing,
  });

  return (
    <div
      {...getRootProps()}
      className={`
        flex flex-col items-center justify-center gap-6
        w-full h-full min-h-[400px]
        border-2 border-dashed rounded-lg
        transition-all duration-200
        cursor-pointer
        ${
          isDragActive
            ? "border-clinical-amber bg-clinical-amber/5"
            : "border-outline-variant hover:border-outline"
        }
        ${isProcessing ? "pointer-events-none opacity-90" : ""}
      `}
    >
      <input {...getInputProps()} />

      {isProcessing ? (
        <div className="w-full max-w-md flex flex-col gap-5 px-8">
          <div className="text-center">
            <p className="text-[15px] font-medium text-on-surface">
              {STEPS[currentStep]}
            </p>
            <p className="text-xs text-on-surface-variant mt-1 font-mono">
              {Math.floor(progress)}%
            </p>
          </div>

          <div className="w-full h-1 bg-surface-variant rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-100 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            {STEPS.map((step, i) => (
              <div
                key={step}
                className={`text-xs font-mono ${
                  i < currentStep
                    ? "text-on-surface-variant"
                    : i === currentStep
                      ? "text-primary"
                      : "text-outline"
                }`}
              >
                {i < currentStep ? "✓" : i === currentStep ? "●" : "○"}{" "}
                {step}
              </div>
            ))}
          </div>
        </div>
      ) : isDragActive ? (
        <>
          <FileCheck className="w-10 h-10 text-clinical-amber" />
          <p className="text-[15px] font-medium text-clinical-amber">
            Drop your CT scan here
          </p>
        </>
      ) : (
        <>
          <Upload className="w-10 h-10 text-on-surface-variant" />
          <div className="text-center">
            <p className="text-[15px] font-medium text-on-surface">
              Upload CT Scan
            </p>
            <p className="text-sm text-on-surface-variant mt-1">
              Drag &amp; drop or click to browse
            </p>
            <p className="text-xs text-outline mt-3">
              Supports{" "}
              <span className="font-medium text-on-surface-variant">
                .nii.gz
              </span>{" "}
              and{" "}
              <span className="font-medium text-on-surface-variant">.nii</span>{" "}
              files
            </p>
          </div>
        </>
      )}
    </div>
  );
}
