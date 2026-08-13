"use client";

import { useState } from "react";
import { AlertCircle } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import FileUpload from "@/components/FileUpload";
import SliceViewer from "@/components/SliceViewer";
import StatsPanel from "@/components/StatsPanel";
import { runInference, InferenceResult } from "@/lib/api";

export default function Home() {
  const [result, setResult] = useState<InferenceResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSlice, setActiveSlice] = useState(0);

  const handleUpload = async (file: File) => {
    setIsProcessing(true);
    setError(null);
    setResult(null);
    setActiveSlice(0);

    try {
      const data = await runInference(file);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />

      <div className="ml-16 flex flex-col h-full w-[calc(100%-4rem)]">
        <TopBar
          filename={result?.filename}
          sliceCount={result?.slice_images.length}
        />

        <main className="mt-12 flex-1 flex overflow-hidden">
          <div className="flex-1 flex flex-col min-w-0">
            {error && (
              <div className="m-4 p-3 bg-error/10 border border-error/20 rounded flex items-start gap-3 text-error animate-fade-in">
                <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-sm">Inference failed</p>
                  <p className="text-xs mt-0.5 opacity-80">{error}</p>
                </div>
              </div>
            )}

            {result ? (
              <div className="flex-1 min-h-0 animate-fade-in">
                <SliceViewer
                  slices={result.slice_images}
                  activeSlice={activeSlice}
                  onSliceChange={setActiveSlice}
                />
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center p-8">
                <div className="w-full max-w-lg">
                  <FileUpload
                    onUpload={handleUpload}
                    isProcessing={isProcessing}
                  />
                </div>
              </div>
            )}
          </div>

          {result && (
            <StatsPanel
              filename={result.filename}
              detectedOrgans={result.detected_organs}
              organFiles={result.organ_files}
              coveragePct={result.statistics.coverage_pct}
              volumeShape={result.statistics.volume_shape}
              organVoxels={result.statistics.organ_voxels}
              downloadUrl={result.download_url}
            />
          )}
        </main>
      </div>
    </div>
  );
}
