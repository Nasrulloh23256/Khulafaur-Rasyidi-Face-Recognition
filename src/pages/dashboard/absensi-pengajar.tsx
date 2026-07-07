import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Camera,
  CalendarDays,
  CheckCircle2,
  Clock,
  Download,
  RefreshCw,
  UserCheck,
  Users,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "TEACHER";
};

type TeacherAttendanceStatus = "BELUM_ABSEN" | "SUDAH_DATANG" | "SELESAI";

type AttendanceLocation = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
};

type TeacherAttendance = {
  id: string;
  date: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  checkInLocation: AttendanceLocation | null;
  checkOutLocation: AttendanceLocation | null;
  checkInPhotoUrl: string | null;
  checkOutPhotoUrl: string | null;
  notes: string | null;
};

type CurrentTeacher = {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  classes: { id: string; name: string }[];
};

type TeacherRow = {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  classes: { id: string; name: string }[];
  attendance: TeacherAttendance | null;
  status: TeacherAttendanceStatus;
};

type AdminStats = {
  totalTeachers: number;
  checkedIn: number;
  checkedOut: number;
  notCheckedIn: number;
};

type RecapDaily = {
  date: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  checkInLocation: AttendanceLocation | null;
  checkOutLocation: AttendanceLocation | null;
  checkInPhotoUrl: string | null;
  checkOutPhotoUrl: string | null;
  status: TeacherAttendanceStatus;
};

type RecapTeacherRow = {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  classes: { id: string; name: string }[];
  totals: {
    present: number;
    complete: number;
    missingCheckOut: number;
    absent: number;
  };
  daily: RecapDaily[];
};

type RecapStats = {
  totalTeachers: number;
  totalDays: number;
  totalSlots: number;
  presentSlots: number;
  completeSlots: number;
  missingCheckOut: number;
  absentSlots: number;
};

const getLocalDateKey = (value = new Date()) => {
  const offsetDate = new Date(value.getTime() - value.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 10);
};

const getMonthStartKey = () => {
  const today = new Date();
  return getLocalDateKey(new Date(today.getFullYear(), today.getMonth(), 1));
};

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("id-ID", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

const statusLabel: Record<TeacherAttendanceStatus, string> = {
  BELUM_ABSEN: "Belum Absen",
  SUDAH_DATANG: "Sudah Datang",
  SELESAI: "Selesai",
};

const csvEscape = (value: string | number | null | undefined) => {
  const rawValue = value === null || value === undefined ? "" : String(value);
  const safeValue = /^[=+\-@]/.test(rawValue) ? `'${rawValue}` : rawValue;
  return `"${safeValue.replace(/"/g, '""')}"`;
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
  location ? `https://www.google.com/maps?q=${location.latitude},${location.longitude}` : "-";

const getPhotoCsvValue = (url: string | null | undefined) => {
  if (!url) return "-";
  return url.startsWith("data:") ? "Tersimpan di sistem" : url;
};

const AbsensiPengajarPage = () => {
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [currentTeacher, setCurrentTeacher] = useState<CurrentTeacher | null>(null);
  const [selectedDate, setSelectedDate] = useState(getLocalDateKey);
  const [todayAttendance, setTodayAttendance] = useState<TeacherAttendance | null>(null);
  const [teacherStatus, setTeacherStatus] = useState<TeacherAttendanceStatus>("BELUM_ABSEN");
  const [recentAttendance, setRecentAttendance] = useState<TeacherAttendance[]>([]);
  const [teacherRows, setTeacherRows] = useState<TeacherRow[]>([]);
  const [stats, setStats] = useState<AdminStats>({
    totalTeachers: 0,
    checkedIn: 0,
    checkedOut: 0,
    notCheckedIn: 0,
  });
  const [recapStart, setRecapStart] = useState(getMonthStartKey);
  const [recapEnd, setRecapEnd] = useState(getLocalDateKey);
  const [selectedRecapTeacherId, setSelectedRecapTeacherId] = useState("all");
  const [recapRows, setRecapRows] = useState<RecapTeacherRow[]>([]);
  const [recapStats, setRecapStats] = useState<RecapStats>({
    totalTeachers: 0,
    totalDays: 0,
    totalSlots: 0,
    presentSlots: 0,
    completeSlots: 0,
    missingCheckOut: 0,
    absentSlots: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRecapLoading, setIsRecapLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [pendingAction, setPendingAction] = useState<"check-in" | "check-out" | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const isTeacher = currentUser?.role === "TEACHER";
  const pageSubtitle = isTeacher
    ? "Catat jam datang dan jam pulang pengajar"
    : "Pantau jam datang dan jam pulang semua pengajar";

  const formattedSelectedDate = useMemo(() => formatDate(selectedDate), [selectedDate]);
  const visibleRecapRows = useMemo(
    () =>
      selectedRecapTeacherId === "all"
        ? recapRows
        : recapRows.filter((teacher) => teacher.id === selectedRecapTeacherId),
    [recapRows, selectedRecapTeacherId],
  );
  const filteredRecapStats = useMemo(() => {
    const presentSlots = visibleRecapRows.reduce((total, teacher) => total + teacher.totals.present, 0);
    const completeSlots = visibleRecapRows.reduce((total, teacher) => total + teacher.totals.complete, 0);
    const missingCheckOut = visibleRecapRows.reduce(
      (total, teacher) => total + teacher.totals.missingCheckOut,
      0,
    );
    const absentSlots = visibleRecapRows.reduce((total, teacher) => total + teacher.totals.absent, 0);
    const totalSlots = visibleRecapRows.length * recapStats.totalDays;

    return {
      totalTeachers: visibleRecapRows.length,
      totalDays: recapStats.totalDays,
      totalSlots,
      presentSlots,
      completeSlots,
      missingCheckOut,
      absentSlots,
    };
  }, [recapStats.totalDays, visibleRecapRows]);
  const flatRecapRows = useMemo(
    () =>
      visibleRecapRows.flatMap((teacher) =>
        teacher.daily.map((item) => ({
          teacherId: teacher.id,
          fullName: teacher.fullName,
          contact: teacher.email ?? teacher.phone ?? "-",
          classes: teacher.classes.length > 0 ? teacher.classes.map((kelas) => kelas.name).join(", ") : "-",
          date: item.date,
          checkInTime: item.checkInTime,
          checkOutTime: item.checkOutTime,
          checkInLocation: item.checkInLocation,
          checkOutLocation: item.checkOutLocation,
          checkInPhotoUrl: item.checkInPhotoUrl,
          checkOutPhotoUrl: item.checkOutPhotoUrl,
          status: item.status,
        })),
      ),
    [visibleRecapRows],
  );

  const loadTeacherAttendance = async (userId: string) => {
    const todayKey = getLocalDateKey();
    const response = await fetch(`/api/teacher-attendance?userId=${userId}&date=${todayKey}`);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error ?? "Gagal memuat absensi pengajar");
    }
    setCurrentTeacher(data.teacher ?? null);
    setTodayAttendance(data.today ?? null);
    setTeacherStatus(data.status ?? "BELUM_ABSEN");
    setRecentAttendance((data.recent ?? []).filter(Boolean));
  };

  const loadAdminAttendance = async () => {
    const response = await fetch(`/api/teacher-attendance?date=${selectedDate}`);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error ?? "Gagal memuat absensi pengajar");
    }
    setTeacherRows(data.teachers ?? []);
    setStats(
      data.stats ?? {
        totalTeachers: 0,
        checkedIn: 0,
        checkedOut: 0,
        notCheckedIn: 0,
      },
    );
  };

  const loadRecapAttendance = async () => {
    if (recapStart > recapEnd) {
      toast({
        title: "Rentang tanggal tidak valid",
        description: "Tanggal awal tidak boleh melewati tanggal akhir.",
        variant: "destructive",
      });
      return;
    }

    setIsRecapLoading(true);
    try {
      const response = await fetch(`/api/teacher-attendance?start=${recapStart}&end=${recapEnd}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "Gagal memuat rekap absensi pengajar");
      }
      setRecapRows(data.teachers ?? []);
      setRecapStats(
        data.stats ?? {
          totalTeachers: 0,
          totalDays: 0,
          totalSlots: 0,
          presentSlots: 0,
          completeSlots: 0,
          missingCheckOut: 0,
          absentSlots: 0,
        },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal memuat rekap absensi pengajar";
      toast({
        title: "Gagal memuat rekap",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsRecapLoading(false);
    }
  };

  const loadData = async (user: AuthUser | null = currentUser) => {
    if (!user) return;

    setIsLoading(true);
    try {
      if (user.role === "TEACHER") {
        await loadTeacherAttendance(user.id);
      } else {
        await Promise.all([loadAdminAttendance(), loadRecapAttendance()]);
      }
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
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("auth_user");
    if (!stored) {
      setIsLoading(false);
      return;
    }

    try {
      const parsed = JSON.parse(stored) as AuthUser;
      setCurrentUser(parsed);
      loadData(parsed);
    } catch {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentUser?.role === "ADMIN") {
      loadData(currentUser);
    }
  }, [selectedDate]);

  useEffect(() => {
    if (
      selectedRecapTeacherId !== "all" &&
      !recapRows.some((teacher) => teacher.id === selectedRecapTeacherId)
    ) {
      setSelectedRecapTeacherId("all");
    }
  }, [recapRows, selectedRecapTeacherId]);

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

  const openPhotoCapture = (action: "check-in" | "check-out") => {
    setPendingAction(action);
    setIsCameraOpen(true);
  };

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

  const handleTeacherAction = async (action: "check-in" | "check-out", photo: string) => {
    if (!currentUser) return;

    setIsSaving(true);
    try {
      const location = await getCurrentLocation();
      const response = await fetch("/api/teacher-attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.id,
          action,
          date: getLocalDateKey(),
          photo,
          location,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "Gagal menyimpan absensi");
      }

      setTodayAttendance(data.attendance ?? null);
      setTeacherStatus(data.status ?? "BELUM_ABSEN");
      await loadTeacherAttendance(currentUser.id);
      setIsCameraOpen(false);
      setPendingAction(null);

      toast({
        title: "Absensi tersimpan",
        description:
          action === "check-in"
            ? "Foto dan lokasi datang berhasil dicatat."
            : "Foto dan lokasi pulang berhasil dicatat.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal menyimpan absensi";
      toast({
        title: "Gagal menyimpan",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePhotoCapture = async () => {
    if (!pendingAction || !videoRef.current) return;

    setIsCapturing(true);
    try {
      const photo = capturePhoto();
      await handleTeacherAction(pendingAction, photo);
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

  const handleDownloadRecap = () => {
    if (flatRecapRows.length === 0) {
      toast({
        title: "Belum ada data",
        description: "Muat rekap terlebih dahulu sebelum download.",
        variant: "destructive",
      });
      return;
    }

    const headers = [
      "Tanggal",
      "Pengajar",
      "Kontak",
      "Kelas",
      "Jam Datang",
      "Foto Datang",
      "Lokasi Datang",
      "Jam Keluar",
      "Foto Keluar",
      "Lokasi Keluar",
      "Status",
    ];
    const rows = flatRecapRows.map((item) => [
      formatDate(item.date),
      item.fullName,
      item.contact,
      item.classes,
      item.checkInTime ?? "-",
      getPhotoCsvValue(item.checkInPhotoUrl),
      getLocationMapUrl(item.checkInLocation),
      item.checkOutTime ?? "-",
      getPhotoCsvValue(item.checkOutPhotoUrl),
      getLocationMapUrl(item.checkOutLocation),
      statusLabel[item.status],
    ]);
    const csvContent = [headers, ...rows]
      .map((row) => row.map((value) => csvEscape(value)).join(","))
      .join("\r\n");
    const blob = new Blob([`\uFEFF${csvContent}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `rekap-absensi-pengajar-${recapStart}-sampai-${recapEnd}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const renderStatusBadge = (status: TeacherAttendanceStatus) => {
    if (status === "SELESAI") {
      return <Badge className="bg-success text-success-foreground">{statusLabel[status]}</Badge>;
    }
    if (status === "SUDAH_DATANG") {
      return <Badge className="bg-warning text-warning-foreground">{statusLabel[status]}</Badge>;
    }
    return <Badge variant="secondary">{statusLabel[status]}</Badge>;
  };

  const renderLocationLink = (location: AttendanceLocation | null | undefined) => {
    if (!location) return <span className="text-muted-foreground">-</span>;

    return (
      <a
        href={getLocationMapUrl(location)}
        target="_blank"
        rel="noreferrer"
        className="inline-flex flex-col text-sm font-medium text-primary hover:underline"
      >
        <span>Lihat Maps</span>
        <span className="text-xs font-normal text-muted-foreground">{formatLocationText(location)}</span>
      </a>
    );
  };

  const renderPhotoLink = (url: string | null | undefined) => {
    if (!url) return <span className="text-muted-foreground">-</span>;

    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="text-sm font-medium text-primary hover:underline"
      >
        Lihat Foto
      </a>
    );
  };

  const canCheckIn = teacherStatus === "BELUM_ABSEN";
  const canCheckOut = teacherStatus === "SUDAH_DATANG";

  return (
    <DashboardLayout title="Absensi Pengajar" subtitle={pageSubtitle}>
      <div className="flex flex-col gap-6">
        {isTeacher ? (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-4">
              <Card className="border-0 shadow-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserCheck className="w-5 h-5" />
                    Absensi Hari Ini
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                    <div className="rounded-xl border border-border p-4">
                      <p className="text-sm text-muted-foreground">Status</p>
                      <div className="mt-2">{renderStatusBadge(teacherStatus)}</div>
                    </div>
                    <div className="rounded-xl border border-border p-4">
                      <p className="text-sm text-muted-foreground">Jam Datang</p>
                      <p className="mt-2 text-2xl font-bold text-foreground">
                        {todayAttendance?.checkInTime ?? "-"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border p-4">
                      <p className="text-sm text-muted-foreground">Jam Keluar</p>
                      <p className="mt-2 text-2xl font-bold text-foreground">
                        {todayAttendance?.checkOutTime ?? "-"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border p-4">
                      <p className="text-sm text-muted-foreground">Lokasi Datang</p>
                      <div className="mt-2">{renderLocationLink(todayAttendance?.checkInLocation)}</div>
                    </div>
                    <div className="rounded-xl border border-border p-4">
                      <p className="text-sm text-muted-foreground">Foto Datang</p>
                      <div className="mt-2">{renderPhotoLink(todayAttendance?.checkInPhotoUrl)}</div>
                    </div>
                    <div className="rounded-xl border border-border p-4">
                      <p className="text-sm text-muted-foreground">Lokasi Keluar</p>
                      <div className="mt-2">{renderLocationLink(todayAttendance?.checkOutLocation)}</div>
                    </div>
                    <div className="rounded-xl border border-border p-4">
                      <p className="text-sm text-muted-foreground">Foto Keluar</p>
                      <div className="mt-2">{renderPhotoLink(todayAttendance?.checkOutPhotoUrl)}</div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                      variant="gradient"
                      className="gap-2"
                      onClick={() => openPhotoCapture("check-in")}
                      disabled={!canCheckIn || isSaving || isCapturing}
                    >
                      <Camera className="w-4 h-4" />
                      Ambil Foto Datang
                    </Button>
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={() => openPhotoCapture("check-out")}
                      disabled={!canCheckOut || isSaving || isCapturing}
                    >
                      <Camera className="w-4 h-4" />
                      Ambil Foto Pulang
                    </Button>
                    <Button variant="ghost" className="gap-2" onClick={() => loadData()} disabled={isLoading}>
                      <RefreshCw className="w-4 h-4" />
                      Refresh
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CalendarDays className="w-5 h-5" />
                    Tanggal
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <p className="text-2xl font-bold text-foreground">{formatDate(getLocalDateKey())}</p>
                  <p className="text-sm text-muted-foreground">
                    Ambil foto langsung dan aktifkan lokasi saat mulai mengajar dan saat selesai.
                  </p>
                  <div className="rounded-xl border border-border p-3">
                    <p className="text-sm font-medium text-foreground">Bukti Absensi</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Setiap absen menyimpan jam, foto langsung dari kamera, dan titik lokasi browser.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="border-0 shadow-card">
              <CardHeader>
                <CardTitle>Riwayat Absensi Terakhir</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Jam Datang</TableHead>
                      <TableHead>Foto Datang</TableHead>
                      <TableHead>Lokasi Datang</TableHead>
                      <TableHead>Jam Keluar</TableHead>
                      <TableHead>Foto Keluar</TableHead>
                      <TableHead>Lokasi Keluar</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground">
                          Memuat data...
                        </TableCell>
                      </TableRow>
                    )}
                    {!isLoading && recentAttendance.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground">
                          Belum ada riwayat absensi.
                        </TableCell>
                      </TableRow>
                    )}
                    {recentAttendance.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{formatDate(item.date)}</TableCell>
                        <TableCell>{item.checkInTime ?? "-"}</TableCell>
                        <TableCell>{renderPhotoLink(item.checkInPhotoUrl)}</TableCell>
                        <TableCell>{renderLocationLink(item.checkInLocation)}</TableCell>
                        <TableCell>{item.checkOutTime ?? "-"}</TableCell>
                        <TableCell>{renderPhotoLink(item.checkOutPhotoUrl)}</TableCell>
                        <TableCell>{renderLocationLink(item.checkOutLocation)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <Card className="border-0 shadow-card">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center">
                    <Users className="w-6 h-6 text-primary-foreground" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{stats.totalTeachers}</p>
                    <p className="text-sm text-muted-foreground">Total Pengajar</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-card">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6 text-success" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-success">{stats.checkedIn}</p>
                    <p className="text-sm text-muted-foreground">Sudah Datang</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-card">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-warning/10 flex items-center justify-center">
                    <Clock className="w-6 h-6 text-warning" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-warning">{stats.checkedOut}</p>
                    <p className="text-sm text-muted-foreground">Sudah Keluar</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-card">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                    <AlertCircle className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{stats.notCheckedIn}</p>
                    <p className="text-sm text-muted-foreground">Belum Absen</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="border-0 shadow-card">
              <CardHeader>
                <div className="flex flex-col lg:flex-row gap-4 justify-between lg:items-center">
                  <div>
                    <CardTitle>Rekap Absensi Pengajar</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">{formattedSelectedDate}</p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                      type="date"
                      value={selectedDate}
                      onChange={(event) => setSelectedDate(event.target.value)}
                    />
                    <Button variant="outline" className="gap-2" onClick={() => loadData()} disabled={isLoading}>
                      <RefreshCw className="w-4 h-4" />
                      Refresh
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pengajar</TableHead>
                      <TableHead>Kelas</TableHead>
                      <TableHead>Jam Datang</TableHead>
                      <TableHead>Foto Datang</TableHead>
                      <TableHead>Lokasi Datang</TableHead>
                      <TableHead>Jam Keluar</TableHead>
                      <TableHead>Foto Keluar</TableHead>
                      <TableHead>Lokasi Keluar</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading && (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground">
                          Memuat data...
                        </TableCell>
                      </TableRow>
                    )}
                    {!isLoading && teacherRows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground">
                          Belum ada data pengajar.
                        </TableCell>
                      </TableRow>
                    )}
                    {teacherRows.map((teacher) => (
                      <TableRow key={teacher.id}>
                        <TableCell>
                          <div className="font-semibold text-foreground">{teacher.fullName}</div>
                          <div className="text-xs text-muted-foreground">
                            {teacher.email ?? teacher.phone ?? "-"}
                          </div>
                        </TableCell>
                        <TableCell>
                          {teacher.classes.length > 0
                            ? teacher.classes.map((item) => item.name).join(", ")
                            : "-"}
                        </TableCell>
                        <TableCell>{teacher.attendance?.checkInTime ?? "-"}</TableCell>
                        <TableCell>{renderPhotoLink(teacher.attendance?.checkInPhotoUrl)}</TableCell>
                        <TableCell>{renderLocationLink(teacher.attendance?.checkInLocation)}</TableCell>
                        <TableCell>{teacher.attendance?.checkOutTime ?? "-"}</TableCell>
                        <TableCell>{renderPhotoLink(teacher.attendance?.checkOutPhotoUrl)}</TableCell>
                        <TableCell>{renderLocationLink(teacher.attendance?.checkOutLocation)}</TableCell>
                        <TableCell>{renderStatusBadge(teacher.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-card">
              <CardHeader>
                <div className="flex flex-col xl:flex-row gap-4 justify-between xl:items-center">
                  <div>
                    <CardTitle>Rekap Rentang Tanggal</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatDate(recapStart)} sampai {formatDate(recapEnd)}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-[220px_160px_160px_auto_auto] gap-2">
                    <Select value={selectedRecapTeacherId} onValueChange={setSelectedRecapTeacherId}>
                      <SelectTrigger className="w-full" aria-label="Filter pengajar">
                        <SelectValue placeholder="Semua Pengajar" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="all">Semua Pengajar</SelectItem>
                          {recapRows.map((teacher) => (
                            <SelectItem key={teacher.id} value={teacher.id}>
                              {teacher.fullName}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <Input
                      type="date"
                      value={recapStart}
                      onChange={(event) => setRecapStart(event.target.value)}
                    />
                    <Input
                      type="date"
                      value={recapEnd}
                      onChange={(event) => setRecapEnd(event.target.value)}
                    />
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={loadRecapAttendance}
                      disabled={isRecapLoading}
                    >
                      <RefreshCw className="w-4 h-4" />
                      {isRecapLoading ? "Memuat..." : "Muat Rekap"}
                    </Button>
                    <Button
                      variant="gradient"
                      className="gap-2"
                      onClick={handleDownloadRecap}
                      disabled={isRecapLoading || flatRecapRows.length === 0}
                    >
                      <Download className="w-4 h-4" />
                      Download CSV
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
                  <div className="rounded-xl bg-muted/50 p-4">
                    <p className="text-sm text-muted-foreground">Hari Rekap</p>
                    <p className="text-2xl font-bold text-foreground">{filteredRecapStats.totalDays}</p>
                  </div>
                  <div className="rounded-xl bg-muted/50 p-4">
                    <p className="text-sm text-muted-foreground">Total Slot</p>
                    <p className="text-2xl font-bold text-foreground">{filteredRecapStats.totalSlots}</p>
                  </div>
                  <div className="rounded-xl bg-success/10 p-4">
                    <p className="text-sm text-muted-foreground">Hadir</p>
                    <p className="text-2xl font-bold text-success">{filteredRecapStats.presentSlots}</p>
                  </div>
                  <div className="rounded-xl bg-warning/10 p-4">
                    <p className="text-sm text-muted-foreground">Belum Pulang</p>
                    <p className="text-2xl font-bold text-warning">{filteredRecapStats.missingCheckOut}</p>
                  </div>
                  <div className="rounded-xl bg-muted p-4">
                    <p className="text-sm text-muted-foreground">Tidak Absen</p>
                    <p className="text-2xl font-bold text-foreground">{filteredRecapStats.absentSlots}</p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Pengajar</TableHead>
                        <TableHead>Kelas</TableHead>
                        <TableHead>Hadir</TableHead>
                        <TableHead>Jam Lengkap</TableHead>
                        <TableHead>Belum Pulang</TableHead>
                        <TableHead>Tidak Absen</TableHead>
                        <TableHead>Persentase</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isRecapLoading && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground">
                            Memuat rekap...
                          </TableCell>
                        </TableRow>
                      )}
                      {!isRecapLoading && visibleRecapRows.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground">
                            Belum ada rekap untuk rentang ini.
                          </TableCell>
                        </TableRow>
                      )}
                      {visibleRecapRows.map((teacher) => {
                        const attendancePercent =
                          filteredRecapStats.totalDays > 0
                            ? Math.round((teacher.totals.present / filteredRecapStats.totalDays) * 100)
                            : 0;
                        return (
                          <TableRow key={teacher.id}>
                            <TableCell>
                              <div className="font-semibold text-foreground">{teacher.fullName}</div>
                              <div className="text-xs text-muted-foreground">
                                {teacher.email ?? teacher.phone ?? "-"}
                              </div>
                            </TableCell>
                            <TableCell>
                              {teacher.classes.length > 0
                                ? teacher.classes.map((item) => item.name).join(", ")
                                : "-"}
                            </TableCell>
                            <TableCell>{teacher.totals.present}</TableCell>
                            <TableCell>{teacher.totals.complete}</TableCell>
                            <TableCell>{teacher.totals.missingCheckOut}</TableCell>
                            <TableCell>{teacher.totals.absent}</TableCell>
                            <TableCell>{attendancePercent}%</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tanggal</TableHead>
                        <TableHead>Pengajar</TableHead>
                        <TableHead>Kelas</TableHead>
                        <TableHead>Jam Datang</TableHead>
                        <TableHead>Foto Datang</TableHead>
                        <TableHead>Lokasi Datang</TableHead>
                        <TableHead>Jam Keluar</TableHead>
                        <TableHead>Foto Keluar</TableHead>
                        <TableHead>Lokasi Keluar</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isRecapLoading && (
                        <TableRow>
                          <TableCell colSpan={10} className="text-center text-muted-foreground">
                            Memuat detail rekap...
                          </TableCell>
                        </TableRow>
                      )}
                      {!isRecapLoading && flatRecapRows.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={10} className="text-center text-muted-foreground">
                            Detail rekap belum tersedia.
                          </TableCell>
                        </TableRow>
                      )}
                      {flatRecapRows.map((item) => (
                        <TableRow key={`${item.teacherId}-${item.date}`}>
                          <TableCell>{formatDate(item.date)}</TableCell>
                          <TableCell className="font-medium text-foreground">{item.fullName}</TableCell>
                          <TableCell>{item.classes}</TableCell>
                          <TableCell>{item.checkInTime ?? "-"}</TableCell>
                          <TableCell>{renderPhotoLink(item.checkInPhotoUrl)}</TableCell>
                          <TableCell>{renderLocationLink(item.checkInLocation)}</TableCell>
                          <TableCell>{item.checkOutTime ?? "-"}</TableCell>
                          <TableCell>{renderPhotoLink(item.checkOutPhotoUrl)}</TableCell>
                          <TableCell>{renderLocationLink(item.checkOutLocation)}</TableCell>
                          <TableCell>{renderStatusBadge(item.status)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <Dialog
        open={isCameraOpen}
        onOpenChange={(open) => {
          setIsCameraOpen(open);
          if (!open) {
            setPendingAction(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Ambil Foto Absensi</DialogTitle>
            <DialogDescription>
              {pendingAction === "check-out"
                ? "Ambil foto langsung dan aktifkan lokasi untuk mencatat jam pulang."
                : "Ambil foto langsung dan aktifkan lokasi untuk mencatat jam datang."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="aspect-video w-full overflow-hidden rounded-lg bg-muted">
              <video
                ref={videoRef}
                className="h-full w-full object-cover"
                style={{ transform: "scaleX(-1)" }}
                muted
                playsInline
              />
            </div>
            <div className="rounded-lg border border-border p-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">{currentTeacher?.fullName ?? "Pengajar"}</p>
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
              onClick={handlePhotoCapture}
              disabled={isCapturing || isSaving || !pendingAction}
            >
              <Camera className="w-4 h-4" />
              {isCapturing || isSaving
                ? "Menyimpan..."
                : pendingAction === "check-out"
                  ? "Simpan Pulang"
                  : "Simpan Datang"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default AbsensiPengajarPage;
