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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { getStableFaceDescriptor } from "@/lib/face-api";

type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "TEACHER";
};

type TeacherAttendanceStatus = "BELUM_ABSEN" | "SUDAH_DATANG" | "SELESAI";

type TeacherAttendance = {
  id: string;
  date: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  notes: string | null;
};

type CurrentTeacher = {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  classes: { id: string; name: string }[];
  faceImageUrl: string | null;
  hasFace: boolean;
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
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [pendingAction, setPendingAction] = useState<"check-in" | "check-out" | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const isTeacher = currentUser?.role === "TEACHER";
  const pageSubtitle = isTeacher
    ? "Catat jam datang dan jam pulang pengajar"
    : "Pantau jam datang dan jam pulang semua pengajar";

  const formattedSelectedDate = useMemo(() => formatDate(selectedDate), [selectedDate]);
  const flatRecapRows = useMemo(
    () =>
      recapRows.flatMap((teacher) =>
        teacher.daily.map((item) => ({
          teacherId: teacher.id,
          fullName: teacher.fullName,
          contact: teacher.email ?? teacher.phone ?? "-",
          classes: teacher.classes.length > 0 ? teacher.classes.map((kelas) => kelas.name).join(", ") : "-",
          date: item.date,
          checkInTime: item.checkInTime,
          checkOutTime: item.checkOutTime,
          status: item.status,
        })),
      ),
    [recapRows],
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

  const openFaceScan = (action: "check-in" | "check-out") => {
    if (!currentTeacher?.hasFace) {
      toast({
        title: "Wajah belum terdaftar",
        description: "Daftarkan wajah pengajar di menu Enroll Wajah terlebih dahulu.",
        variant: "destructive",
      });
      return;
    }

    setPendingAction(action);
    setIsCameraOpen(true);
  };

  const handleTeacherAction = async (action: "check-in" | "check-out", descriptor: number[]) => {
    if (!currentUser) return;

    setIsSaving(true);
    try {
      const response = await fetch("/api/teacher-attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.id,
          action,
          date: getLocalDateKey(),
          descriptor,
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
            ? "Wajah cocok. Jam datang berhasil dicatat."
            : "Wajah cocok. Jam pulang berhasil dicatat.",
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

  const handleFaceScan = async () => {
    if (!pendingAction || !videoRef.current) return;

    setIsRecognizing(true);
    try {
      const descriptor = await getStableFaceDescriptor(videoRef.current, {
        samples: 10,
        minSamples: 2,
        intervalMs: 180,
      });
      if (!descriptor) {
        toast({
          title: "Wajah tidak terdeteksi",
          description: "Arahkan wajah ke kamera dengan pencahayaan cukup.",
          variant: "destructive",
        });
        return;
      }

      await handleTeacherAction(pendingAction, Array.from(descriptor));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal melakukan scan wajah";
      toast({
        title: "Gagal scan wajah",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsRecognizing(false);
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

    const headers = ["Tanggal", "Pengajar", "Kontak", "Kelas", "Jam Datang", "Jam Keluar", "Status"];
    const rows = flatRecapRows.map((item) => [
      formatDate(item.date),
      item.fullName,
      item.contact,
      item.classes,
      item.checkInTime ?? "-",
      item.checkOutTime ?? "-",
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
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                      variant="gradient"
                      className="gap-2"
                      onClick={() => openFaceScan("check-in")}
                      disabled={!canCheckIn || isSaving || isRecognizing}
                    >
                      <Camera className="w-4 h-4" />
                      Scan Wajah Datang
                    </Button>
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={() => openFaceScan("check-out")}
                      disabled={!canCheckOut || isSaving || isRecognizing}
                    >
                      <Camera className="w-4 h-4" />
                      Scan Wajah Pulang
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
                    Gunakan scan wajah saat mulai mengajar dan saat selesai.
                  </p>
                  <div className="rounded-xl border border-border p-3">
                    <p className="text-sm font-medium text-foreground">Status Wajah</p>
                    <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      {currentTeacher?.hasFace ? (
                        <span className="inline-flex items-center gap-2 text-sm text-success">
                          <CheckCircle2 className="w-4 h-4" />
                          Wajah sudah terdaftar
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-2 text-sm text-destructive">
                          <AlertCircle className="w-4 h-4" />
                          Wajah belum terdaftar
                        </span>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => window.open("/dashboard/enroll-wajah", "_self")}
                      >
                        <Camera className="w-4 h-4" />
                        Enroll Wajah
                      </Button>
                    </div>
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
                      <TableHead>Jam Keluar</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground">
                          Memuat data...
                        </TableCell>
                      </TableRow>
                    )}
                    {!isLoading && recentAttendance.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground">
                          Belum ada riwayat absensi.
                        </TableCell>
                      </TableRow>
                    )}
                    {recentAttendance.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{formatDate(item.date)}</TableCell>
                        <TableCell>{item.checkInTime ?? "-"}</TableCell>
                        <TableCell>{item.checkOutTime ?? "-"}</TableCell>
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
                      <TableHead>Jam Keluar</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          Memuat data...
                        </TableCell>
                      </TableRow>
                    )}
                    {!isLoading && teacherRows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
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
                        <TableCell>{teacher.attendance?.checkOutTime ?? "-"}</TableCell>
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-[160px_160px_auto_auto] gap-2">
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
                    <p className="text-2xl font-bold text-foreground">{recapStats.totalDays}</p>
                  </div>
                  <div className="rounded-xl bg-muted/50 p-4">
                    <p className="text-sm text-muted-foreground">Total Slot</p>
                    <p className="text-2xl font-bold text-foreground">{recapStats.totalSlots}</p>
                  </div>
                  <div className="rounded-xl bg-success/10 p-4">
                    <p className="text-sm text-muted-foreground">Hadir</p>
                    <p className="text-2xl font-bold text-success">{recapStats.presentSlots}</p>
                  </div>
                  <div className="rounded-xl bg-warning/10 p-4">
                    <p className="text-sm text-muted-foreground">Belum Pulang</p>
                    <p className="text-2xl font-bold text-warning">{recapStats.missingCheckOut}</p>
                  </div>
                  <div className="rounded-xl bg-muted p-4">
                    <p className="text-sm text-muted-foreground">Tidak Absen</p>
                    <p className="text-2xl font-bold text-foreground">{recapStats.absentSlots}</p>
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
                      {!isRecapLoading && recapRows.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground">
                            Belum ada rekap untuk rentang ini.
                          </TableCell>
                        </TableRow>
                      )}
                      {recapRows.map((teacher) => {
                        const attendancePercent =
                          recapStats.totalDays > 0
                            ? Math.round((teacher.totals.present / recapStats.totalDays) * 100)
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
                        <TableHead>Jam Keluar</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isRecapLoading && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground">
                            Memuat detail rekap...
                          </TableCell>
                        </TableRow>
                      )}
                      {!isRecapLoading && flatRecapRows.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground">
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
                          <TableCell>{item.checkOutTime ?? "-"}</TableCell>
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
            <DialogTitle>Scan Wajah Pengajar</DialogTitle>
            <DialogDescription>
              {pendingAction === "check-out"
                ? "Arahkan wajah ke kamera untuk mencatat jam pulang."
                : "Arahkan wajah ke kamera untuk mencatat jam datang."}
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
                {isRecognizing
                  ? "Mendeteksi wajah dari beberapa frame..."
                  : "Pastikan wajah terlihat jelas dan pencahayaan cukup."}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCameraOpen(false)}
              disabled={isRecognizing || isSaving}
            >
              Tutup
            </Button>
            <Button
              variant="gradient"
              className="gap-2"
              onClick={handleFaceScan}
              disabled={isRecognizing || isSaving || !pendingAction}
            >
              <Camera className="w-4 h-4" />
              {isRecognizing || isSaving
                ? "Mendeteksi..."
                : pendingAction === "check-out"
                  ? "Scan Pulang"
                  : "Scan Datang"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default AbsensiPengajarPage;
