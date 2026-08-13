"use client";

import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileCheck } from "lucide-react";

interface Props {
  onUpload: (file: File) => void;
  isProcessing: boolean;
}

export default function FileUpload({ onUpload, isProcessing }: Props) {
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
        ${isProcessing ? "pointer-events-none opacity-50" : ""}
      `}
    >
      <input {...getInputProps()} />

      {isProcessing ? (
        <>
          {/* Subtle thin spinner */}
          <div className="w-8 h-8 border-2 border-outline-variant border-t-primary rounded-full animate-spin" />
          <div className="text-center">
            <p className="text-[15px] font-medium text-on-surface">
              Processing CT scan...
            </p>
            <p className="text-sm text-on-surface-variant mt-1">
              Running AI inference
            </p>
          </div>
        </>
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
