import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, CheckCircle2, Loader2 } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { detectFaceWithDescriptor, loadFaceModels } from "@/lib/face-api";

type ClassItem = {
  id: string;
  name: string;
};

type StudentItem = {
  id: string;
  fullName: string;
  studentNumber: string | null;
  classId: string | null;
  class: ClassItem | null;
  faceImageUrl: string | null;
  hasFace: boolean;
};

type QualityResult = {
  passed: boolean;
  message: string;
  center: { x: number; y: number };
  descriptor: Float32Array;
  score: number;
  snapshot: string | null;
};

const TARGET_SAMPLES = 6;
const MIN_SAMPLES = 4;

const EnrollWajah = () => {
  const { toast } = useToast();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("all");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [sampleCount, setSampleCount] = useState(0);
  const [statusMessage, setStatusMessage] = useState("Siapkan kamera.");
  const [isSaving, setIsSaving] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analysisCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const snapshotCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const abortRef = useRef(false);

  const selectedStudent = useMemo(
    () => students.find((item) => item.id === selectedStudentId) ?? null,
    [students, selectedStudentId],
  );

  const filteredStudents = useMemo(() => {
    if (selectedClassId === "all") return students;
    return students.filter((student) => student.classId === selectedClassId);
  }, [students, selectedClassId]);

  const loadData = async () => {
    try {
      const [classRes, studentRes] = await Promise.all([fetch("/api/classes"), fetch("/api/students")]);
      const classData = await classRes.json();
      const studentData = await studentRes.json();
      if (classRes.ok) setClasses(classData);
      if (studentRes.ok) setStudents(studentData);
    } catch {
      toast({
        title: "Gagal memuat data",
        description: "Tidak bisa mengambil data kelas atau siswa",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedClassId === "all") return;
    if (selectedStudent && selectedStudent.classId !== selectedClassId) {
      setSelectedStudentId("");
    }
  }, [selectedClassId, selectedStudent]);

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast({
        title: "Kamera tidak tersedia",
        description: "Browser tidak mendukung akses kamera.",
        variant: "destructive",
      });
      return;
    }

    try {
      await loadFaceModels();
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      toast({
        title: "Gagal membuka kamera",
        description: "Periksa izin kamera di browser.",
        variant: "destructive",
      });
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  useEffect(() => {
    if (isCameraOpen) {
      abortRef.current = false;
      startCamera();
    } else {
      abortRef.current = true;
      stopCamera();
      setIsCapturing(false);
      setSampleCount(0);
      setStatusMessage("Siapkan kamera.");
    }
    return () => stopCamera();
  }, [isCameraOpen]);

  const getAnalysisCanvas = () => {
    if (!analysisCanvasRef.current) {
      analysisCanvasRef.current = document.createElement("canvas");
    }
    return analysisCanvasRef.current;
  };

  const getSnapshotCanvas = () => {
    if (!snapshotCanvasRef.current) {
      snapshotCanvasRef.current = document.createElement("canvas");
    }
    return snapshotCanvasRef.current;
  };

  const computeBrightnessAndBlur = (video: HTMLVideoElement) => {
    const canvas = getAnalysisCanvas();
    const ctx = canvas.getContext("2d");
    if (!ctx) return { brightness: 0, blur: 0 };
    const width = 160;
    const height = 120;
    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(video, 0, 0, width, height);
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const gray = new Float32Array(width * height);

    let brightnessSum = 0;
    for (let i = 0; i < data.length; i += 4) {
      const value = (data[i] + data[i + 1] + data[i + 2]) / 3;
      gray[i / 4] = value;
      brightnessSum += value;
    }

    const brightness = brightnessSum / (width * height);

    let laplacianSum = 0;
    let laplacianSqSum = 0;
    let count = 0;
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const idx = y * width + x;
        const lap =
          -4 * gray[idx] +
          gray[idx - 1] +
          gray[idx + 1] +
          gray[idx - width] +
          gray[idx + width];
        laplacianSum += lap;
        laplacianSqSum += lap * lap;
        count += 1;
      }
    }
    const mean = laplacianSum / count;
    const variance = laplacianSqSum / count - mean * mean;

    return { brightness, blur: variance };
  };

  const computeRollAngle = (landmarks: { getLeftEye: () => { x: number; y: number }[]; getRightEye: () => { x: number; y: number }[] }) => {
    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();
    const left = leftEye.reduce(
      (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
      { x: 0, y: 0 },
    );
    const right = rightEye.reduce(
      (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
      { x: 0, y: 0 },
    );
    left.x /= leftEye.length;
    left.y /= leftEye.length;
    right.x /= rightEye.length;
    right.y /= rightEye.length;
    const angle = (Math.atan2(right.y - left.y, right.x - left.x) * 180) / Math.PI;
    return angle;
  };

  const captureSnapshot = (video: HTMLVideoElement) => {
    const canvas = getSnapshotCanvas();
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;
    const targetWidth = 640;
    const scale = targetWidth / width;
    canvas.width = targetWidth;
    canvas.height = Math.round(height * scale);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.9);
  };

  const analyzeFrame = async (): Promise<QualityResult | null> => {
    if (!videoRef.current) return null;
    const result = await detectFaceWithDescriptor(videoRef.current);
    if (!result) return null;
    const { detection, landmarks, descriptor } = result;

    const videoWidth = videoRef.current.videoWidth || 640;
    const videoHeight = videoRef.current.videoHeight || 480;
    const faceWidthRatio = detection.box.width / videoWidth;
    const faceHeightRatio = detection.box.height / videoHeight;

    const { brightness, blur } = computeBrightnessAndBlur(videoRef.current);
    const roll = computeRollAngle(landmarks);

    const issues: string[] = [];
    if (faceWidthRatio < 0.22 || faceHeightRatio < 0.22) issues.push("Wajah terlalu kecil");
    if (brightness < 60) issues.push("Pencahayaan kurang");
    if (brightness > 210) issues.push("Cahaya terlalu terang");
    if (blur < 80) issues.push("Gambar terlalu blur");
    if (Math.abs(roll) > 15) issues.push("Wajah terlalu miring");

    const score = blur * 2 + faceWidthRatio * 200 - Math.abs(roll) * 2 - Math.abs(brightness - 140);
    const center = {
      x: detection.box.x + detection.box.width / 2,
      y: detection.box.y + detection.box.height / 2,
    };

    if (issues.length > 0) {
      return {
        passed: false,
        message: issues[0],
        center,
        descriptor,
        score,
        snapshot: null,
      };
    }

    return {
      passed: true,
      message: "Sampel layak disimpan",
      center,
      descriptor,
      score,
      snapshot: captureSnapshot(videoRef.current),
    };
  };

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const handleCapture = async () => {
    if (!selectedStudent) {
      toast({
        title: "Siswa belum dipilih",
        description: "Pilih siswa sebelum melakukan enroll wajah.",
        variant: "destructive",
      });
      return;
    }

    setIsCapturing(true);
    setSampleCount(0);
    setStatusMessage("Mulai menangkap sampel...");

    const samples: number[][] = [];
    let attempts = 0;
    let bestSnapshot: string | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;
    let movementDetected = false;
    let lastCenter: { x: number; y: number } | null = null;

    while (samples.length < TARGET_SAMPLES && attempts < TARGET_SAMPLES * 10 && !abortRef.current) {
      attempts += 1;
      const analysis = await analyzeFrame();
      if (!analysis) {
        setStatusMessage("Wajah belum terdeteksi.");
        await sleep(180);
        continue;
      }

      if (!analysis.passed) {
        setStatusMessage(analysis.message);
        await sleep(180);
        continue;
      }

      if (lastCenter) {
        const delta = Math.hypot(analysis.center.x - lastCenter.x, analysis.center.y - lastCenter.y);
        if (delta > 12) movementDetected = true;
      }
      lastCenter = analysis.center;

      samples.push(Array.from(analysis.descriptor));
      setSampleCount(samples.length);
      setStatusMessage(`Sampel ${samples.length}/${TARGET_SAMPLES} tersimpan`);

      if (analysis.snapshot && analysis.score > bestScore) {
        bestScore = analysis.score;
        bestSnapshot = analysis.snapshot;
      }

      await sleep(180);
    }

    if (abortRef.current) {
      setIsCapturing(false);
      return;
    }

    if (samples.length < MIN_SAMPLES) {
      setIsCapturing(false);
      toast({
        title: "Sampel kurang",
        description: "Coba lagi dengan pencahayaan yang lebih baik.",
        variant: "destructive",
      });
      return;
    }

    if (!movementDetected) {
      setIsCapturing(false);
      toast({
        title: "Gerakkan wajah sedikit",
        description: "Lakukan gerakan kecil agar sistem memastikan keaslian.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    setStatusMessage("Menyimpan data wajah...");
    try {
      const response = await fetch(`/api/students/${selectedStudent.id}/enroll-face`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          descriptors: samples,
          faceImage: bestSnapshot,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "Gagal menyimpan data wajah");
      }

      setStudents((prev) =>
        prev.map((item) =>
          item.id === selectedStudent.id
            ? { ...item, hasFace: true, faceImageUrl: data.faceImageUrl ?? item.faceImageUrl }
            : item,
        ),
      );
      toast({
        title: "Enroll berhasil",
        description: `Wajah ${selectedStudent.fullName} tersimpan.`,
      });
      setIsCameraOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal menyimpan data wajah";
      toast({
        title: "Gagal menyimpan",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
      setIsCapturing(false);
    }
  };

  return (
    <DashboardLayout title="Enroll Wajah" subtitle="Daftarkan wajah siswa melalui kamera">
      <div className="space-y-6">
        <Card className="border-0 shadow-card">
          <CardHeader>
            <CardTitle>Pilih Siswa</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Filter Kelas</label>
                <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Semua Kelas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Kelas</SelectItem>
                    {classes.map((kelas) => (
                      <SelectItem key={kelas.id} value={kelas.id}>
                        {kelas.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Nama Siswa</label>
                <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih siswa" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredStudents.length === 0 ? (
                      <SelectItem value="empty" disabled>
                        Belum ada siswa
                      </SelectItem>
                    ) : (
                      filteredStudents.map((student) => (
                        <SelectItem key={student.id} value={student.id}>
                          {student.fullName} {student.class?.name ? `(${student.class.name})` : ""}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Button
                variant="gradient"
                className="gap-2"
                disabled={!selectedStudent}
                onClick={() => setIsCameraOpen(true)}
              >
                <Camera className="w-4 h-4" />
                Mulai Enroll Wajah
              </Button>
              {selectedStudent?.hasFace && (
                <span className="inline-flex items-center gap-2 text-sm text-success">
                  <CheckCircle2 className="w-4 h-4" />
                  Wajah sudah terdaftar
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-card">
          <CardHeader>
            <CardTitle>Panduan Kualitas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Pastikan wajah terlihat jelas, pencahayaan cukup, dan tidak blur.</p>
            <p>Posisikan wajah di tengah kamera, tidak miring ekstrem.</p>
            <p>Gerakkan kepala sedikit selama pengambilan sampel untuk liveness sederhana.</p>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isCameraOpen} onOpenChange={setIsCameraOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Enroll Wajah</DialogTitle>
            <DialogDescription>
              {selectedStudent ? `Siswa: ${selectedStudent.fullName}` : "Pilih siswa dahulu"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="aspect-video w-full rounded-lg bg-muted overflow-hidden">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                style={{ transform: "scaleX(-1)" }}
                muted
                playsInline
              />
            </div>
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{statusMessage}</span>
              <span>
                Sampel: {sampleCount}/{TARGET_SAMPLES}
              </span>
            </div>
          </div>
          <DialogFooter className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              {isCapturing || isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {isSaving ? "Menyimpan..." : isCapturing ? "Mengambil sampel..." : "Siap"}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsCameraOpen(false)} disabled={isCapturing || isSaving}>
                Tutup
              </Button>
              <Button
                variant="gradient"
                onClick={handleCapture}
                disabled={!selectedStudent || isCapturing || isSaving}
              >
                Mulai Ambil Sampel
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default EnrollWajah;
