import { useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  Check,
  X,
  AlertCircle,
  Clock,
  Users,
  Loader2,
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

type TeacherAttendanceItem = {
  id: string;
  fullName: string;
  phone: string | null;
  faceImageUrl: string | null;
  hasFace: boolean;
  status: "PRESENT" | "ABSENT" | "SICK" | "PERMIT" | null;
  checkInTime: string | null;
  checkOutTime: string | null;
  notes: string | null;
};

type RecognizeMatch = {
  id: string;
  fullName: string;
  phone: string | null;
};

const statusLabel: Record<string, string> = {
  PRESENT: "Hadir",
  ABSENT: "Alpha",
  SICK: "Sakit",
  PERMIT: "Izin",
  UNMARKED: "Belum",
};

const KehadiranPengajar = () => {
  const { toast } = useToast();
  const [teachers, setTeachers] = useState<TeacherAttendanceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [lastMatch, setLastMatch] = useState<RecognizeMatch | null>(null);
  const [isTeacherView, setIsTeacherView] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const formattedDate = useMemo(() => {
    return new Date().toLocaleDateString("id-ID", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  }, []);

  const stats = useMemo(() => {
    const total = teachers.length;
    const hadir = teachers.filter((item) => item.status === "PRESENT").length;
    const sakit = teachers.filter((item) => item.status === "SICK").length;
    const izin = teachers.filter((item) => item.status === "PERMIT").length;
    const alpha = teachers.filter((item) => item.status === "ABSENT").length;
    return { total, hadir, sakit, izin, alpha };
  }, [teachers]);

  const registeredCount = useMemo(
    () => teachers.filter((t) => t.hasFace).length,
    [teachers],
  );

  const loadAttendance = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/attendance/teachers");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "Gagal memuat absensi pengajar");
      }
      setTeachers(data.teachers ?? []);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal memuat absensi pengajar";
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
    loadAttendance();
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
    setLastMatch(null);
    if (!isTeacherView) {
      setIsCameraOpen(false);
    }
  }, [isTeacherView]);

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

  const handleStatusChange = async (teacherId: string, status: TeacherAttendanceItem["status"]) => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/attendance/teachers/mark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherId,
          status,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "Gagal menyimpan absensi");
      }
      await loadAttendance();
      toast({
        title: "Status Diperbarui",
        description: "Absensi pengajar berhasil disimpan secara manual.",
      });
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
    if (!videoRef.current) return;

    if (registeredCount === 0) {
      toast({
        title: "Belum ada wajah pengajar terdaftar",
        description: "Daftarkan wajah pengajar di menu Enroll Wajah terlebih dahulu.",
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
          description: "Arahkan wajah pengajar ke kamera dengan pencahayaan cukup.",
          variant: "destructive",
        });
        return;
      }

      const response = await fetch("/api/attendance/teachers/recognize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
              ? `${data.match.fullName} sudah absen masuk & keluar hari ini.`
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
          description: "Pastikan wajah pengajar sudah terdaftar.",
          variant: "destructive",
        });
        return;
      }

      setLastMatch(data.match);
      await loadAttendance();

      const actionText = data.type === "check-in" ? "Masuk (Check-In)" : "Keluar (Check-Out)";
      toast({
        title: `Absensi ${actionText} Berhasil`,
        description: `${data.match.fullName} terdeteksi.`,
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
        return "bg-success text-success-foreground hover:bg-success/90";
      case "SICK":
        return "bg-destructive text-destructive-foreground hover:bg-destructive/90";
      case "PERMIT":
        return "bg-warning text-warning-foreground hover:bg-warning/90";
      case "ABSENT":
        return "bg-muted text-muted-foreground hover:bg-muted/90";
      default:
        return "bg-muted text-muted-foreground hover:bg-muted/90";
    }
  };

  return (
    <DashboardLayout title="Kehadiran Pengajar" subtitle="Rekam kehadiran masuk dan keluar pengajar (guru)">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span className="font-medium text-foreground">{formattedDate}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => window.open("/dashboard/enroll-wajah", "_self")}
            >
              <Camera className="w-4 h-4" />
              Enroll Wajah Pengajar
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
                Scan Wajah Pengajar
              </Button>
            )}
          </div>
        </div>

        {isTeacherView && (
          <Card className="border-0 shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="w-5 h-5" />
                Kamera Absensi Pengajar
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
                        <p>No HP: {lastMatch.phone ?? "-"}</p>
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
                        : "Arahkan wajah ke kamera."}
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

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <Card className="border-0 shadow-card">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center">
                <Users className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Guru</p>
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
                <p className="text-xs text-muted-foreground">Hadir</p>
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
                <p className="text-xs text-muted-foreground">Sakit</p>
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
                <p className="text-xs text-muted-foreground">Izin</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-card col-span-2 sm:col-span-1">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                <X className="w-6 h-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.alpha}</p>
                <p className="text-xs text-muted-foreground">Alpha</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Teachers List */}
        <Card className="border-0 shadow-card">
          <CardHeader>
            <CardTitle>Daftar Absensi Pengajar</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-6 text-muted-foreground gap-2">
                <Loader2 className="w-5 h-5 animate-spin" /> Memuat data absensi...
              </div>
            ) : teachers.length === 0 ? (
              <p className="text-center py-6 text-muted-foreground">Belum ada pengajar terdaftar di sistem.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {teachers.map((teacher) => {
                  const currentStatus = teacher.status ?? "UNMARKED";
                  return (
                    <Card key={teacher.id} className="border shadow-sm hover:shadow-card transition-all">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          
                          {/* Image profile/avatar */}
                          <div className="w-20 h-20 rounded-xl bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
                            {teacher.faceImageUrl ? (
                              <img
                                src={teacher.faceImageUrl}
                                alt={`Foto ${teacher.fullName}`}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full gradient-primary flex items-center justify-center text-primary-foreground font-bold text-2xl">
                                {teacher.fullName.charAt(0)}
                              </div>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-foreground truncate">{teacher.fullName}</h4>
                            <p className="text-xs text-muted-foreground mt-0.5">HP: {teacher.phone ?? "-"}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {teacher.hasFace ? "Wajah terdaftar" : "Wajah belum terdaftar"}
                            </p>

                            <div className="mt-3 space-y-2">
                              <Select
                                value={currentStatus}
                                onValueChange={(value) => {
                                  handleStatusChange(teacher.id, value === "UNMARKED" ? "UNMARKED" : value as any);
                                }}
                                disabled={isSaving}
                              >
                                <SelectTrigger className={`w-full h-9 ${getStatusColor(currentStatus)}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="UNMARKED">
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
                              
                              <div className="space-y-0.5 text-xs text-muted-foreground">
                                <p>Jam Masuk: <span className="font-medium text-foreground">{teacher.checkInTime ?? "-"}</span></p>
                                <p>Jam Keluar: <span className="font-medium text-foreground">{teacher.checkOutTime ?? "-"}</span></p>
                              </div>
                            </div>
                          </div>

                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
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
              <DialogTitle>Face Recognition Pengajar</DialogTitle>
              <DialogDescription>Arahkan wajah pengajar ke kamera untuk melakukan absen masuk/keluar.</DialogDescription>
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
                      ? `No HP: ${lastMatch.phone ?? "-"}`
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

export default KehadiranPengajar;
