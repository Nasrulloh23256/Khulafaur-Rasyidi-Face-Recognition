import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Camera,
  Check,
  Clock,
  Send,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import DashboardLayout from "@/components/DashboardLayout";
import { useToast } from "@/hooks/use-toast";

type ClassItem = {
  id: string;
  name: string;
};

type AttendanceLocation = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
};

type AttendanceAreaStatus = {
  isInside: boolean;
  distanceMeters: number;
  radiusMeters: number;
  label: "Di area" | "Di luar area";
};

type AttendanceStatus = "PRESENT" | "ABSENT" | "SICK" | "PERMIT" | null;

type AttendanceStudent = {
  id: string;
  studentNumber: string | null;
  fullName: string;
  gender: "MALE" | "FEMALE";
  faceImageUrl: string | null;
  attendanceId: string | null;
  status: AttendanceStatus;
  checkInTime: string | null;
  checkInPhotoUrl: string | null;
  checkInLocation: AttendanceLocation | null;
  checkInAreaStatus: AttendanceAreaStatus | null;
};

type WhatsAppNotification = {
  sent: boolean;
  skipped?: boolean;
  locationSent?: boolean;
  reason?: string;
};

type AttendanceSaveResult = {
  saved: boolean;
  notification?: WhatsAppNotification | null;
};

const statusLabel: Record<string, string> = {
  PRESENT: "Hadir",
  ABSENT: "Alpha",
  SICK: "Sakit",
  PERMIT: "Izin",
  UNMARKED: "Belum",
};

const formatLocationText = (location: AttendanceLocation | null | undefined) => {
  if (!location) return "-";
  const coordinates = `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;
  if (typeof location.accuracy === "number") {
    return `${coordinates} (${Math.round(location.accuracy)} m)`;
  }
  return coordinates;
};

const getLocationMapUrl = (location: AttendanceLocation | null | undefined) =>
  location ? `https://www.google.com/maps?q=${location.latitude},${location.longitude}` : "#";

const formatAreaStatusText = (status: AttendanceAreaStatus | null | undefined) => {
  if (!status) return "-";
  return `${status.label} (${status.distanceMeters} m dari bimbel, radius ${status.radiusMeters} m)`;
};

const Kehadiran = () => {
  const { toast } = useToast();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [attendanceData, setAttendanceData] = useState<AttendanceStudent[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<AttendanceStudent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [resendingAttendanceId, setResendingAttendanceId] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
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

  const loadClasses = async () => {
    try {
      const response = await fetch("/api/classes");
      const data = await response.json();
      if (response.ok) {
        setClasses(data);
        if (!selectedClassId && data.length > 0) {
          setSelectedClassId(data[0].id);
        } else if (data.length === 0) {
          setIsLoading(false);
        }
      }
    } catch {
      setIsLoading(false);
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
    if (selectedClassId) {
      setSelectedStudent(null);
      setIsCameraOpen(false);
      loadAttendance(selectedClassId);
    }
  }, [selectedClassId]);

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast({
        title: "Kamera tidak tersedia",
        description: "Browser tidak mendukung akses kamera.",
        variant: "destructive",
      });
      setIsCameraOpen(false);
      return;
    }

    try {
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
      setIsCameraOpen(false);
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

  const getCurrentLocation = () =>
    new Promise<AttendanceLocation>((resolve, reject) => {
      if (typeof navigator === "undefined" || !navigator.geolocation) {
        reject(new Error("Browser tidak mendukung akses lokasi."));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
          });
        },
        () => reject(new Error("Izin lokasi ditolak atau lokasi tidak terbaca.")),
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        },
      );
    });

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      throw new Error("Kamera belum siap mengambil foto.");
    }

    const maxWidth = 1280;
    const scale = Math.min(1, maxWidth / video.videoWidth);
    const width = Math.round(video.videoWidth * scale);
    const height = Math.round(video.videoHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Browser tidak bisa mengambil foto dari kamera.");
    }

    context.translate(width, 0);
    context.scale(-1, 1);
    context.drawImage(video, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", 0.72);
  };

  const handleStatusChange = async (
    studentId: string,
    status: Exclude<AttendanceStatus, null>,
    evidence?: { photo: string; location: AttendanceLocation },
  ) => {
    if (!selectedClassId) return { saved: false } satisfies AttendanceSaveResult;

    setIsSaving(true);
    try {
      const response = await fetch("/api/attendance/mark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          classId: selectedClassId,
          status,
          photo: evidence?.photo,
          location: evidence?.location,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        const message = data?.error ?? "Gagal menyimpan absensi";
        toast({
          title: response.status === 409 ? "Sudah absen" : "Gagal menyimpan",
          description: message,
          variant: "destructive",
        });
        return { saved: false } satisfies AttendanceSaveResult;
      }
      await loadAttendance(selectedClassId);
      return {
        saved: true,
        notification: data?.whatsappNotification ?? null,
      } satisfies AttendanceSaveResult;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal menyimpan absensi";
      toast({
        title: "Gagal menyimpan",
        description: message,
        variant: "destructive",
      });
      return { saved: false } satisfies AttendanceSaveResult;
    } finally {
      setIsSaving(false);
    }
  };

  const handleResendNotification = async (attendanceId: string) => {
    setResendingAttendanceId(attendanceId);
    try {
      const response = await fetch("/api/attendance/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attendanceId }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "Gagal mengirim notifikasi");
      }

      const notification = data?.notification as WhatsAppNotification | undefined;
      if (notification?.sent) {
        toast({
          title: notification.locationSent === false ? "Rincian absensi terkirim" : "Notifikasi terkirim",
          description:
            notification.locationSent === false
              ? notification.reason ?? "Pin lokasi belum terkirim."
              : "Rincian absensi dan pin lokasi telah dikirim ke WhatsApp orang tua/wali.",
          ...(notification.locationSent === false ? { variant: "destructive" as const } : {}),
        });
        return;
      }

      toast({
        title: "Notifikasi belum terkirim",
        description: notification?.reason ?? "Periksa konfigurasi Fonnte dan nomor WhatsApp orang tua/wali.",
        variant: "destructive",
      });
    } catch (error) {
      toast({
        title: "Gagal mengirim notifikasi",
        description: error instanceof Error ? error.message : "Terjadi kesalahan saat menghubungi Fonnte.",
        variant: "destructive",
      });
    } finally {
      setResendingAttendanceId(null);
    }
  };

  const openPhotoAttendance = (student: AttendanceStudent) => {
    if (!selectedClassId) {
      toast({
        title: "Kelas belum dipilih",
        description: "Pilih kelas terlebih dahulu.",
        variant: "destructive",
      });
      return;
    }
    if (student.status) {
      toast({
        title: "Sudah diabsen",
        description: `${student.fullName} sudah memiliki status hari ini.`,
        variant: "destructive",
      });
      return;
    }

    setSelectedStudent(student);
    setIsCameraOpen(true);
  };

  const handlePhotoAttendance = async () => {
    if (!selectedStudent) return;

    setIsCapturing(true);
    try {
      const photo = capturePhoto();
      const location = await getCurrentLocation();
      const result = await handleStatusChange(selectedStudent.id, "PRESENT", { photo, location });
      if (!result.saved) return;

      toast({
        title: "Absensi berhasil",
        description: `${selectedStudent.fullName} tercatat hadir dengan foto dan lokasi.`,
      });
      if (result.notification?.sent) {
        toast({
          title: result.notification.locationSent === false ? "Rincian absensi terkirim" : "Notifikasi terkirim",
          description:
            result.notification.locationSent === false
              ? result.notification.reason ?? "Pin lokasi belum terkirim."
              : "Rincian absensi dan pin lokasi telah dikirim ke WhatsApp orang tua/wali.",
          ...(result.notification.locationSent === false ? { variant: "destructive" as const } : {}),
        });
      } else if (result.notification) {
        toast({
          title: "Notifikasi belum terkirim",
          description: result.notification.reason ?? "Periksa konfigurasi Fonnte dan nomor WhatsApp orang tua/wali.",
          variant: "destructive",
        });
      }
      setIsCameraOpen(false);
      setSelectedStudent(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal mengambil foto absensi";
      toast({
        title: "Gagal menyimpan absensi",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsCapturing(false);
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

  const renderLocationLink = (
    location: AttendanceLocation | null | undefined,
    areaStatus?: AttendanceAreaStatus | null,
  ) => {
    if (!location) return <span>-</span>;
    return (
      <a
        href={getLocationMapUrl(location)}
        target="_blank"
        rel="noreferrer"
        className="font-medium text-primary hover:underline"
      >
        Lihat Maps
        <span className="block text-[11px] font-normal text-muted-foreground">
          {formatLocationText(location)}
        </span>
        {areaStatus && (
          <span className={areaStatus.isInside ? "block text-[11px] font-semibold text-success" : "block text-[11px] font-semibold text-destructive"}>
            {formatAreaStatusText(areaStatus)}
          </span>
        )}
      </a>
    );
  };

  const renderPhotoLink = (url: string | null | undefined) => {
    if (!url) return <span>-</span>;
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="font-medium text-primary hover:underline"
      >
        Lihat Foto
      </a>
    );
  };

  return (
    <DashboardLayout title="Absensi Kehadiran" subtitle="Rekam kehadiran siswa dengan foto dan lokasi">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Select value={selectedClassId} onValueChange={setSelectedClassId}>
              <SelectTrigger className="w-full sm:w-[180px]">
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
              <Clock className="h-4 w-4" />
              <span>{formattedDate}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <Card className="border-0 shadow-card">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-primary">
                <Users className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Total Siswa</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-card">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/10">
                <Check className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold text-success">{stats.hadir}</p>
                <p className="text-sm text-muted-foreground">Hadir</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-card">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10">
                <X className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold text-destructive">{stats.sakit}</p>
                <p className="text-sm text-muted-foreground">Sakit</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-card">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-warning/10">
                <AlertCircle className="h-6 w-6 text-warning" />
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {isLoading && (
                <p className="text-sm text-muted-foreground">Memuat data absensi...</p>
              )}
              {!isLoading && attendanceData.length === 0 && (
                <p className="text-sm text-muted-foreground">Belum ada siswa di kelas ini.</p>
              )}
              {attendanceData.map((siswa) => {
                const currentStatus = siswa.status ?? "UNMARKED";
                const isAlreadyMarked = currentStatus !== "UNMARKED";
                return (
                  <Card key={siswa.id} className="border shadow-sm transition-all hover:shadow-card">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted">
                          {siswa.faceImageUrl ? (
                            <img
                              src={siswa.faceImageUrl}
                              alt={`Foto ${siswa.fullName}`}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center gradient-primary text-2xl font-bold text-primary-foreground">
                              {siswa.fullName.charAt(0)}
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <h4 className="truncate font-semibold text-foreground">{siswa.fullName}</h4>
                          <p className="text-sm text-muted-foreground">NIS: {siswa.studentNumber ?? "-"}</p>
                          <p className="text-sm text-muted-foreground">
                            {siswa.gender === "MALE" ? "Laki-laki" : "Perempuan"}
                          </p>

                          <div className="mt-3 space-y-2">
                            <Select
                              value={currentStatus}
                              disabled={isSaving || isAlreadyMarked}
                              onValueChange={(value) => {
                                if (value === "UNMARKED") return;
                                if (value === "PRESENT") {
                                  openPhotoAttendance(siswa);
                                  return;
                                }
                                handleStatusChange(siswa.id, value as Exclude<AttendanceStatus, null>);
                              }}
                            >
                              <SelectTrigger className={`h-9 w-full ${getStatusColor(currentStatus)}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="UNMARKED" disabled>
                                  Belum diabsen
                                </SelectItem>
                                <SelectItem value="PRESENT">
                                  <span className="flex items-center gap-2">
                                    <Check className="h-4 w-4 text-success" /> Hadir
                                  </span>
                                </SelectItem>
                                <SelectItem value="SICK">
                                  <span className="flex items-center gap-2">
                                    <X className="h-4 w-4 text-destructive" /> Sakit
                                  </span>
                                </SelectItem>
                                <SelectItem value="PERMIT">
                                  <span className="flex items-center gap-2">
                                    <AlertCircle className="h-4 w-4 text-warning" /> Izin
                                  </span>
                                </SelectItem>
                                <SelectItem value="ABSENT">
                                  <span className="flex items-center gap-2">
                                    <X className="h-4 w-4 text-muted-foreground" /> Alpha
                                  </span>
                                </SelectItem>
                              </SelectContent>
                            </Select>

                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full gap-2"
                              onClick={() => openPhotoAttendance(siswa)}
                              disabled={isSaving || isAlreadyMarked}
                            >
                              <Camera className="h-4 w-4" />
                              Ambil Foto Hadir
                            </Button>

                            {currentStatus === "PRESENT" && siswa.attendanceId && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full gap-2"
                                onClick={() => handleResendNotification(siswa.attendanceId as string)}
                                disabled={isSaving || resendingAttendanceId === siswa.attendanceId}
                              >
                                <Send className="h-4 w-4" />
                                {resendingAttendanceId === siswa.attendanceId
                                  ? "Mengirim..."
                                  : "Kirim Ulang Notifikasi"}
                              </Button>
                            )}

                            <div className="space-y-1 text-xs text-muted-foreground">
                              <p>Status: {statusLabel[currentStatus]}</p>
                              <p>Jam masuk: {siswa.checkInTime ?? "-"}</p>
                              <div>Foto: {renderPhotoLink(siswa.checkInPhotoUrl)}</div>
                              <div>Lokasi: {renderLocationLink(siswa.checkInLocation, siswa.checkInAreaStatus)}</div>
                            </div>
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
      </div>

      <Dialog
        open={isCameraOpen}
        onOpenChange={(open) => {
          setIsCameraOpen(open);
          if (!open) {
            setSelectedStudent(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Ambil Foto Kehadiran</DialogTitle>
            <DialogDescription>
              Ambil foto langsung dan aktifkan lokasi untuk mencatat kehadiran siswa.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="aspect-[4/3] w-full overflow-hidden rounded-lg bg-muted sm:aspect-video">
              <video
                ref={videoRef}
                className="h-full w-full object-cover"
                style={{ transform: "scaleX(-1)" }}
                muted
                playsInline
              />
            </div>
            <div className="rounded-lg border border-border p-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">{selectedStudent?.fullName ?? "Siswa"}</p>
              <p>
                {isCapturing || isSaving
                  ? "Menyimpan foto dan lokasi absensi..."
                  : "Pastikan foto terlihat jelas dan pencahayaan cukup."}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCameraOpen(false)}
              disabled={isCapturing || isSaving}
            >
              Tutup
            </Button>
            <Button
              variant="gradient"
              className="gap-2"
              onClick={handlePhotoAttendance}
              disabled={isCapturing || isSaving || !selectedStudent}
            >
              <Camera className="h-4 w-4" />
              {isCapturing || isSaving ? "Menyimpan..." : "Simpan Hadir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Kehadiran;
