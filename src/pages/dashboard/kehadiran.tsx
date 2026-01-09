import { useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  Check,
  X,
  AlertCircle,
  Clock,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import DashboardLayout from "@/components/DashboardLayout";
import { useToast } from "@/hooks/use-toast";
import { getStableFaceDescriptor } from "@/lib/face-api";

type ClassItem = {
  id: string;
  name: string;
};

type AttendanceStudent = {
  id: string;
  studentNumber: string | null;
  fullName: string;
  gender: "MALE" | "FEMALE";
  faceImageUrl: string | null;
  hasFace: boolean;
  status: "PRESENT" | "ABSENT" | "SICK" | "PERMIT" | null;
  checkInTime: string | null;
};

type RecognizeMatch = {
  id: string;
  fullName: string;
  studentNumber: string | null;
  gender: "MALE" | "FEMALE";
  className: string | null;
};

const statusLabel: Record<string, string> = {
  PRESENT: "Hadir",
  ABSENT: "Alpha",
  SICK: "Sakit",
  PERMIT: "Izin",
  UNMARKED: "Belum",
};

const Kehadiran = () => {
  const { toast } = useToast();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [attendanceData, setAttendanceData] = useState<AttendanceStudent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [lastMatch, setLastMatch] = useState<RecognizeMatch | null>(null);
  const [isTeacherView, setIsTeacherView] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const selectedClass = useMemo(
    () => classes.find((item) => item.id === selectedClassId),
    [classes, selectedClassId],
  );

  const formattedDate = useMemo(() => {
    return new Date().toLocaleDateString("id-ID", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  }, []);

  const stats = useMemo(() => {
    const total = attendanceData.length;
    const hadir = attendanceData.filter((item) => item.status === "PRESENT").length;
    const sakit = attendanceData.filter((item) => item.status === "SICK").length;
    const izin = attendanceData.filter((item) => item.status === "PERMIT").length;
    return { total, hadir, sakit, izin };
  }, [attendanceData]);

  const registeredCount = useMemo(
    () => attendanceData.filter((student) => student.hasFace).length,
    [attendanceData],
  );

  const loadClasses = async () => {
    try {
      const response = await fetch("/api/classes");
      const data = await response.json();
      if (response.ok) {
        setClasses(data);
        if (!selectedClassId && data.length > 0) {
          setSelectedClassId(data[0].id);
        }
      }
    } catch (error) {
      toast({
        title: "Gagal memuat kelas",
        description: "Tidak bisa mengambil data kelas",
        variant: "destructive",
      });
    }
  };

  const loadAttendance = async (classId: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/attendance?classId=${classId}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "Gagal memuat data absensi");
      }
      setAttendanceData(data.students ?? []);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal memuat data absensi";
      toast({
        title: "Gagal memuat data",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadClasses();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("auth_user");
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as { role?: string };
      setIsTeacherView(parsed?.role === "TEACHER");
    } catch {
      setIsTeacherView(false);
    }
  }, []);

  useEffect(() => {
    if (selectedClassId) {
      loadAttendance(selectedClassId);
    }
  }, [selectedClassId]);

  useEffect(() => {
    setLastMatch(null);
    if (!isTeacherView) {
      setIsCameraOpen(false);
    }
  }, [selectedClassId, isTeacherView]);

  useEffect(() => {
    if (isTeacherView) {
      setIsCameraOpen(true);
    }
  }, [isTeacherView]);


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
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (error) {
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
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isCameraOpen]);

  const handleStatusChange = async (studentId: string, status: AttendanceStudent["status"]) => {
    if (!selectedClassId || !status) return false;

    setIsSaving(true);
    try {
      const response = await fetch("/api/attendance/mark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          classId: selectedClassId,
          status,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        const message = data?.error ?? "Gagal menyimpan absensi";
        if (response.status === 409) {
          toast({
            title: "Sudah absen",
            description: message,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Gagal menyimpan",
            description: message,
            variant: "destructive",
          });
        }
        return false;
      }
      await loadAttendance(selectedClassId);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal menyimpan absensi";
      toast({
        title: "Gagal menyimpan",
        description: message,
        variant: "destructive",
      });
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleRecognize = async () => {
    if (!selectedClassId) {
      toast({
        title: "Kelas belum dipilih",
        description: "Pilih kelas terlebih dahulu.",
        variant: "destructive",
      });
      return;
    }
    if (!videoRef.current) return;

    if (registeredCount === 0) {
      toast({
        title: "Belum ada wajah terdaftar",
        description: "Enroll wajah siswa terlebih dahulu.",
        variant: "destructive",
      });
      return;
    }

    setIsRecognizing(true);
    setLastMatch(null);
    try {
      const descriptor = await getStableFaceDescriptor(videoRef.current, {
        samples: 6,
        minSamples: 3,
        intervalMs: 150,
      });
      if (!descriptor) {
        toast({
          title: "Wajah tidak terdeteksi",
          description: "Arahkan wajah ke kamera dengan pencahayaan cukup.",
          variant: "destructive",
        });
        return;
      }

      const response = await fetch("/api/attendance/recognize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: selectedClassId,
          descriptor: Array.from(descriptor),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        const message = data?.error ?? "Gagal mengenali wajah";
        if (response.status === 409) {
          if (data?.match) {
            setLastMatch(data.match);
          }
          toast({
            title: "Sudah absen",
            description: data?.match?.fullName
              ? `${data.match.fullName} sudah absen hari ini.`
              : message,
            variant: "destructive",
          });
          return;
        }
        throw new Error(message);
      }

      if (!data?.match) {
        toast({
          title: "Wajah tidak dikenali",
          description: "Pastikan wajah sudah terdaftar.",
          variant: "destructive",
        });
        return;
      }

      setLastMatch(data.match);
      const saved = await handleStatusChange(data.match.id, "PRESENT");
      if (!saved) return;
      toast({
        title: "Absensi berhasil",
        description: `${data.match.fullName} terdeteksi hadir.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal mengenali wajah";
      toast({
        title: "Gagal mengenali",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsRecognizing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PRESENT":
        return "bg-success text-success-foreground";
      case "SICK":
        return "bg-destructive text-destructive-foreground";
      case "PERMIT":
        return "bg-warning text-warning-foreground";
      case "ABSENT":
        return "bg-muted text-muted-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <DashboardLayout title="Absensi Kehadiran" subtitle="Rekam kehadiran siswa dengan face recognition">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          <div className="flex items-center gap-4">
            <Select value={selectedClassId} onValueChange={setSelectedClassId}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Pilih Kelas" />
              </SelectTrigger>
              <SelectContent>
                {classes.length === 0 ? (
                  <SelectItem value="empty" disabled>
                    Belum ada kelas
                  </SelectItem>
                ) : (
                  classes.map((kelas) => (
                    <SelectItem key={kelas.id} value={kelas.id}>
                      {kelas.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>{formattedDate}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => window.open("/dashboard/enroll-wajah", "_self")}
            >
              <Camera className="w-4 h-4" />
              Enroll Wajah
            </Button>
            {!isTeacherView && (
              <Button
                variant="gradient"
                className="gap-2"
                onClick={() => {
                  setLastMatch(null);
                  setIsCameraOpen(true);
                }}
                disabled={registeredCount === 0}
              >
                <Camera className="w-4 h-4" />
                Scan Wajah
              </Button>
            )}
          </div>
        </div>

        {isTeacherView && (
          <Card className="border-0 shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="w-5 h-5" />
                Kamera Absensi
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid lg:grid-cols-[2fr_1fr] gap-4">
                <div className="aspect-[4/3] sm:aspect-video w-full rounded-lg bg-muted overflow-hidden">
                  <video
                    ref={videoRef}
                    className="w-full h-full object-cover"
                    style={{ transform: "scaleX(-1)" }}
                    muted
                    playsInline
                  />
                </div>
                <div className="space-y-3">
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-sm font-medium text-foreground">Hasil Deteksi</p>
                    {lastMatch ? (
                      <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                        <p className="font-semibold text-foreground">{lastMatch.fullName}</p>
                        <p>NIS: {lastMatch.studentNumber ?? "-"}</p>
                        <p>Kelas: {lastMatch.className ?? "-"}</p>
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-muted-foreground">Belum ada wajah terdeteksi.</p>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {registeredCount === 0
                      ? "Belum ada wajah terdaftar."
                      : isRecognizing
                        ? "Mendeteksi..."
                        : "Siap mendeteksi."}
                  </div>
                  <Button
                    variant="gradient"
                    className="w-full"
                    onClick={handleRecognize}
                    disabled={isRecognizing || registeredCount === 0}
                  >
                    {isRecognizing ? "Mendeteksi..." : "Scan Wajah"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Card className="border-0 shadow-card">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center">
                <Users className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Total Siswa</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-card">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center">
                <Check className="w-6 h-6 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold text-success">{stats.hadir}</p>
                <p className="text-sm text-muted-foreground">Hadir</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-card">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center">
                <X className="w-6 h-6 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold text-destructive">{stats.sakit}</p>
                <p className="text-sm text-muted-foreground">Sakit</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-card">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-warning/10 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold text-warning">{stats.izin}</p>
                <p className="text-sm text-muted-foreground">Izin</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-0 shadow-card">
          <CardHeader>
            <CardTitle>Daftar Kehadiran - {selectedClass?.name ?? "-"}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {isLoading && (
                <p className="text-sm text-muted-foreground">Memuat data absensi...</p>
              )}
              {!isLoading && attendanceData.length === 0 && (
                <p className="text-sm text-muted-foreground">Belum ada siswa di kelas ini.</p>
              )}
              {attendanceData.map((siswa) => {
                const currentStatus = siswa.status ?? "UNMARKED";
                return (
                  <Card key={siswa.id} className="border shadow-sm hover:shadow-card transition-all">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                      <div className="w-20 h-20 rounded-xl bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {siswa.faceImageUrl ? (
                            <img
                              src={siswa.faceImageUrl}
                              alt={`Foto ${siswa.fullName}`}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full gradient-primary flex items-center justify-center text-primary-foreground font-bold text-2xl">
                              {siswa.fullName.charAt(0)}
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-foreground truncate">{siswa.fullName}</h4>
                          <p className="text-sm text-muted-foreground">NIS: {siswa.studentNumber ?? "-"}</p>
                          <p className="text-sm text-muted-foreground">
                            {siswa.gender === "MALE" ? "Laki-laki" : "Perempuan"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {siswa.hasFace ? "Wajah terdaftar" : "Wajah belum terdaftar"}
                          </p>

                          <div className="mt-3 space-y-2">
                            <Select
                              value={currentStatus}
                              onValueChange={(value) => {
                                if (value === "UNMARKED") return;
                                handleStatusChange(siswa.id, value as AttendanceStudent["status"]);
                              }}
                            >
                              <SelectTrigger className={`w-full h-9 ${getStatusColor(currentStatus)}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="UNMARKED" disabled>
                                  Belum diabsen
                                </SelectItem>
                                <SelectItem value="PRESENT">
                                  <span className="flex items-center gap-2">
                                    <Check className="w-4 h-4 text-success" /> Hadir
                                  </span>
                                </SelectItem>
                                <SelectItem value="SICK">
                                  <span className="flex items-center gap-2">
                                    <X className="w-4 h-4 text-destructive" /> Sakit
                                  </span>
                                </SelectItem>
                                <SelectItem value="PERMIT">
                                  <span className="flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 text-warning" /> Izin
                                  </span>
                                </SelectItem>
                                <SelectItem value="ABSENT">
                                  <span className="flex items-center gap-2">
                                    <X className="w-4 h-4 text-muted-foreground" /> Alpha
                                  </span>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                              Jam masuk: {siswa.checkInTime ?? "-"}
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button variant="gradient" size="lg" disabled={isSaving}>
            {isSaving ? "Menyimpan..." : "Simpan Absensi"}
          </Button>
        </div>
      </div>

      {!isTeacherView && (
        <Dialog
          open={isCameraOpen}
          onOpenChange={(open) => {
            setIsCameraOpen(open);
            if (!open) {
              setLastMatch(null);
            }
          }}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Face Recognition</DialogTitle>
              <DialogDescription>Arahkan wajah ke kamera untuk absensi.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="aspect-[4/3] sm:aspect-video w-full rounded-lg bg-muted overflow-hidden">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  style={{ transform: "scaleX(-1)" }}
                  muted
                  playsInline
                />
              </div>
              <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-center text-sm text-muted-foreground">
                <div>
                  <p className="text-xs text-muted-foreground">Hasil deteksi</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {lastMatch?.fullName ?? "Belum ada wajah terdeteksi"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {lastMatch
                      ? `NIS: ${lastMatch.studentNumber ?? "-"} - Kelas: ${lastMatch.className ?? "-"}`
                      : "Pastikan wajah terlihat jelas di kamera."}
                  </p>
                </div>
                <div className="text-right">
                  <span>
                    Status:{" "}
                    {registeredCount === 0
                      ? "Belum ada wajah terdaftar"
                      : isRecognizing
                        ? "Mengambil beberapa frame..."
                        : "Siap"}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Kelas aktif: {selectedClass?.name ?? "-"}</span>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCameraOpen(false)}>
                Tutup
              </Button>
              <Button
                variant="gradient"
                onClick={handleRecognize}
                disabled={isRecognizing || registeredCount === 0}
              >
                {isRecognizing ? "Mendeteksi..." : "Scan Wajah"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </DashboardLayout>
  );
};

export default Kehadiran;
