"use client";

import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import FileUpload from "@/components/FileUpload";
import SliceViewer from "@/components/SliceViewer";
import VolumeViewer from "@/components/VolumeViewer";
import StatsPanel from "@/components/StatsPanel";
import RecentScansDrawer from "@/components/RecentScansDrawer";
import { runInference, InferenceResult } from "@/lib/api";
import { saveRecentScan, getRecentScans, StoredScan } from "@/lib/recentScans";

export default function Home() {
  const [result, setResult] = useState<InferenceResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadByteProgress, setUploadByteProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [activeSlice, setActiveSlice] = useState(0);
  const [activeOrgans, setActiveOrgans] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"2d" | "3d" | "split">("2d");
  const [overlayOpacity, setOverlayOpacity] = useState(0.45);
  const [selectedOrgan, setSelectedOrgan] = useState<string | null>(null);
  const [showCTInMesh, setShowCTInMesh] = useState(false);
  const [showSlicePlane, setShowSlicePlane] = useState(false);
  const [isRecentDrawerOpen, setIsRecentDrawerOpen] = useState(false);
  const [recentScans, setRecentScans] = useState<StoredScan[]>([]);

  const fetchRecentScans = async () => {
    try {
      const data = await getRecentScans();
      setRecentScans(data);
    } catch (err) {
      console.error("Failed to fetch recent scans", err);
    }
  };

  useEffect(() => {
    fetchRecentScans();
  }, []);

  // Global keyboard shortcuts for slice navigation
  useEffect(() => {
    if (!result || !result.ct_images) return;
    const total = result.ct_images.length;
    
    const handleKey = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input field (like search)
      if (e.target instanceof HTMLInputElement) return;
      
      if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
        setActiveSlice((prev) => Math.max(0, prev - 1));
        e.preventDefault();
      } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
        setActiveSlice((prev) => Math.min(total - 1, prev + 1));
        e.preventDefault();
      }
    };
    
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [result]);

  const handleUpload = async (file: File) => {
    setIsProcessing(true);
    setUploadByteProgress(0);
    setError(null);
    setResult(null);
    setActiveSlice(0);
    setActiveOrgans(new Set());

    try {
      const data = await runInference(file, (pct) => {
        setUploadByteProgress(pct);
      });
      setResult(data);
      setActiveOrgans(new Set(data.detected_organs));
      
      // Auto save scan to history
      await saveRecentScan(data);
      await fetchRecentScans();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSelectRecentScan = (scanResult: InferenceResult) => {
    setResult(scanResult);
    setActiveSlice(0);
    setActiveOrgans(new Set(scanResult.detected_organs));
  };

  const handleToggleOrgan = (organ: string) => {
    setActiveOrgans((prev) => {
      const next = new Set(prev);
      if (next.has(organ)) {
        next.delete(organ);
      } else {
        next.add(organ);
      }
      return next;
    });
  };

  const handleSelectAllOrgans = () => {
    if (result) {
      setActiveOrgans(new Set(result.detected_organs));
    }
  };

  const handleDeselectAllOrgans = () => {
    setActiveOrgans(new Set());
  };

  const handleReset = () => {
    setResult(null);
    setError(null);
    setIsProcessing(false);
    setUploadByteProgress(0);
    setActiveSlice(0);
    setActiveOrgans(new Set());
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {result && (
        <Sidebar
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          detectedOrgans={result.detected_organs || []}
          organFiles={result.organ_files || []}
          activeOrgans={activeOrgans}
          onToggleOrgan={handleToggleOrgan}
          onSelectAll={handleSelectAllOrgans}
          onDeselectAll={handleDeselectAllOrgans}
          overlayOpacity={overlayOpacity}
          onOpacityChange={setOverlayOpacity}
          showCTInMesh={showCTInMesh}
          onShowCTInMeshChange={setShowCTInMesh}
          showSlicePlane={showSlicePlane}
          onShowSlicePlaneChange={setShowSlicePlane}
          selectedOrgan={selectedOrgan}
        />
      )}

      <div
        className={`flex flex-col h-full transition-all duration-300 ${
          result ? "ml-64 w-[calc(100%-16rem)]" : "ml-0 w-full"
        }`}
      >
        <TopBar
          filename={result?.filename}
          sliceCount={result?.statistics?.volume_shape?.[2] ?? result?.ct_images?.length}
          hasSidebar={Boolean(result)}
          onReset={handleReset}
          onOpenRecentScans={() => setIsRecentDrawerOpen(true)}
          recentScansCount={recentScans.length}
        />

        <main className="mt-12 flex-1 flex overflow-hidden">
          <div className="flex-1 flex flex-col min-w-0 min-h-0">
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
                {viewMode === "3d" ? (
                  <VolumeViewer
                    caseName={result.filename.replace(".nii.gz", "").replace(".nii", "")}
                    activeOrgans={activeOrgans}
                    activeSlice={activeSlice}
                    onSliceChange={setActiveSlice}
                    totalSlices={result.ct_images.length}
                    ctImages={result.ct_images}
                    statistics={result.statistics}
                    selectedOrgan={selectedOrgan}
                    onSelectOrgan={setSelectedOrgan}
                    showCTInMesh={showCTInMesh}
                    onShowCTInMeshChange={setShowCTInMesh}
                    showSlicePlane={showSlicePlane}
                    onShowSlicePlaneChange={setShowSlicePlane}
                  />
                ) : viewMode === "split" ? (
                  <div className="flex h-full">
                    <div className="flex-1 min-w-0">
                      <SliceViewer
                        ctImages={result.ct_images}
                        organOverlays={result.organ_overlays}
                        activeOrgans={activeOrgans}
                        activeSlice={activeSlice}
                        onSliceChange={setActiveSlice}
                        overlayOpacity={overlayOpacity}
                      />
                    </div>
                    <div className="flex-1 min-w-0 border-l border-outline-variant">
                      <VolumeViewer
                        caseName={result.filename.replace(".nii.gz", "").replace(".nii", "")}
                        activeOrgans={activeOrgans}
                        activeSlice={activeSlice}
                        onSliceChange={setActiveSlice}
                        totalSlices={result.ct_images.length}
                        ctImages={result.ct_images}
                        statistics={result.statistics}
                        selectedOrgan={selectedOrgan}
                        onSelectOrgan={setSelectedOrgan}
                        showCTInMesh={showCTInMesh}
                        onShowCTInMeshChange={setShowCTInMesh}
                        showSlicePlane={showSlicePlane}
                        onShowSlicePlaneChange={setShowSlicePlane}
                      />
                    </div>
                  </div>
                ) : (
                  <SliceViewer
                    ctImages={result.ct_images}
                    organOverlays={result.organ_overlays}
                    activeOrgans={activeOrgans}
                    activeSlice={activeSlice}
                    onSliceChange={setActiveSlice}
                    overlayOpacity={overlayOpacity}
                  />
                )}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center p-8">
                <div className="w-full max-w-lg">
                  <FileUpload
                    onUpload={handleUpload}
                    isProcessing={isProcessing}
                    uploadByteProgress={uploadByteProgress}
                    recentScansCount={recentScans.length}
                    onOpenRecentScans={() => setIsRecentDrawerOpen(true)}
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

      {/* Recent Scans Drawer */}
      <RecentScansDrawer
        isOpen={isRecentDrawerOpen}
        onClose={() => {
          setIsRecentDrawerOpen(false);
          fetchRecentScans();
        }}
        onSelectScan={handleSelectRecentScan}
      />
    </div>
  );
}

