import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Camera, CalendarDays, CheckCircle2, Clock, Download, RefreshCw, Users } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

type AuthUser = { id: string; name: string; email: string; role: "ADMIN" | "TEACHER" };
type AttendanceStatus = "BELUM_ABSEN" | "SUDAH_DATANG" | "SELESAI";
type Location = { latitude: number; longitude: number; accuracy: number | null };
type AreaStatus = { isInside: boolean; distanceMeters: number; radiusMeters: number; label: string };

type Attendance = {
  id: string;
  date: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  checkInLocation: Location | null;
  checkOutLocation: Location | null;
  checkInAreaStatus: AreaStatus | null;
  checkOutAreaStatus: AreaStatus | null;
  checkInPhotoUrl: string | null;
  checkOutPhotoUrl: string | null;
  session: { id: string; className: string; startTime: string; endTime: string } | null;
};

type Availability = { isOpen: boolean; canCheckIn: boolean; canCheckOut: boolean; message: string };
type Session = {
  id: string;
  classId: string;
  className: string;
  startTime: string;
  endTime: string;
  attendance: Attendance | null;
  status: AttendanceStatus;
  availability: Availability;
};
type AdminSession = Session & {
  teacher: { id: string; fullName: string; phone: string | null; user: { email: string } | null } | null;
};
type RecapSession = {
  date: string;
  teacher: { id: string; fullName: string; phone: string | null; user: { email: string } | null } | null;
  schedule: { id: string; className: string; startTime: string; endTime: string };
  attendance: Attendance | null;
  status: AttendanceStatus;
};

const statusLabels: Record<AttendanceStatus, string> = {
  BELUM_ABSEN: "Belum Absen",
  SUDAH_DATANG: "Sudah Datang",
  SELESAI: "Selesai",
};

const getLocalDateKey = (value = new Date()) => {
  const offset = new Date(value.getTime() - value.getTimezoneOffset() * 60000);
  return offset.toISOString().slice(0, 10);
};
const getMonthStartKey = () => {
  const now = new Date();
  return getLocalDateKey(new Date(now.getFullYear(), now.getMonth(), 1));
};
const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
const csvEscape = (value: unknown) => {
  const raw = value === null || value === undefined ? "" : String(value);
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
};
const mapUrl = (location: Location | null | undefined) =>
  location ? `https://www.google.com/maps?q=${location.latitude},${location.longitude}` : "-";

const StatusBadge = ({ status }: { status: AttendanceStatus }) => {
  if (status === "SELESAI") return <Badge className="bg-success text-success-foreground">Selesai</Badge>;
  if (status === "SUDAH_DATANG") return <Badge className="bg-warning text-warning-foreground">Sudah Datang</Badge>;
  return <Badge variant="secondary">Belum Absen</Badge>;
};

const LocationLink = ({ location, area }: { location?: Location | null; area?: AreaStatus | null }) => {
  if (!location) return <span>-</span>;
  return (
    <a href={mapUrl(location)} target="_blank" rel="noreferrer" className="text-primary hover:underline">
      Lihat Maps
      {area && <span className={`block text-xs ${area.isInside ? "text-success" : "text-destructive"}`}>{area.label} · {area.distanceMeters} m</span>}
    </a>
  );
};

const PhotoLink = ({ url }: { url?: string | null }) =>
  url ? <a href={url} target="_blank" rel="noreferrer" className="text-primary hover:underline">Lihat Foto</a> : <span>-</span>;

export default function AbsensiPengajarPage() {
  const { toast } = useToast();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [teacherName, setTeacherName] = useState("");
  const [teacherSessions, setTeacherSessions] = useState<Session[]>([]);
  const [recent, setRecent] = useState<Attendance[]>([]);
  const [adminSessions, setAdminSessions] = useState<AdminSession[]>([]);
  const [selectedDate, setSelectedDate] = useState(getLocalDateKey);
  const [recapStart, setRecapStart] = useState(getMonthStartKey);
  const [recapEnd, setRecapEnd] = useState(getLocalDateKey);
  const [recapSessions, setRecapSessions] = useState<RecapSession[]>([]);
  const [teacherOptions, setTeacherOptions] = useState<{ id: string; fullName: string }[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState("all");
  const [loading, setLoading] = useState(true);
  const [recapLoading, setRecapLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [pending, setPending] = useState<{ session: Session; action: "check-in" | "check-out" } | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const isTeacher = user?.role === "TEACHER";
  const visibleRecap = useMemo(
    () => selectedTeacher === "all" ? recapSessions : recapSessions.filter((item) => item.teacher?.id === selectedTeacher),
    [recapSessions, selectedTeacher],
  );
  const adminStats = useMemo(() => ({
    teachers: new Set(adminSessions.map((item) => item.teacher?.id).filter(Boolean)).size,
    sessions: adminSessions.length,
    checkedIn: adminSessions.filter((item) => item.status !== "BELUM_ABSEN").length,
    completed: adminSessions.filter((item) => item.status === "SELESAI").length,
    missing: adminSessions.filter((item) => item.status === "BELUM_ABSEN").length,
  }), [adminSessions]);
  const recapStats = useMemo(() => ({
    sessions: visibleRecap.length,
    checkedIn: visibleRecap.filter((item) => item.status !== "BELUM_ABSEN").length,
    completed: visibleRecap.filter((item) => item.status === "SELESAI").length,
    missing: visibleRecap.filter((item) => item.status === "BELUM_ABSEN").length,
  }), [visibleRecap]);

  const loadTeacher = async (authUser: AuthUser) => {
    const response = await fetch(`/api/teacher-attendance?userId=${authUser.id}&date=${getLocalDateKey()}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error ?? "Gagal memuat absensi pengajar");
    setTeacherName(data.teacher?.fullName ?? authUser.name);
    setTeacherSessions(data.sessions ?? []);
    setRecent((data.recent ?? []).filter(Boolean));
  };

  const loadAdmin = async () => {
    const response = await fetch(`/api/teacher-attendance?date=${selectedDate}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error ?? "Gagal memuat absensi pengajar");
    setAdminSessions(data.sessions ?? []);
  };

  const loadRecap = async () => {
    if (recapStart > recapEnd) {
      toast({ title: "Rentang tidak valid", description: "Tanggal awal tidak boleh melewati tanggal akhir.", variant: "destructive" });
      return;
    }
    setRecapLoading(true);
    try {
      const response = await fetch(`/api/teacher-attendance?start=${recapStart}&end=${recapEnd}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? "Gagal memuat rekap");
      setRecapSessions(data.sessions ?? []);
      setTeacherOptions(data.teacherOptions ?? []);
    } catch (error) {
      toast({ title: "Gagal memuat rekap", description: error instanceof Error ? error.message : "Terjadi kesalahan", variant: "destructive" });
    } finally {
      setRecapLoading(false);
    }
  };

  const loadData = async (authUser: AuthUser) => {
    setLoading(true);
    try {
      if (authUser.role === "TEACHER") await loadTeacher(authUser);
      else await Promise.all([loadAdmin(), loadRecap()]);
    } catch (error) {
      toast({ title: "Gagal memuat data", description: error instanceof Error ? error.message : "Terjadi kesalahan", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const stored = window.localStorage.getItem("auth_user");
    if (!stored) { setLoading(false); return; }
    try {
      const parsed = JSON.parse(stored) as AuthUser;
      setUser(parsed);
      loadData(parsed);
    } catch { setLoading(false); }
  }, []);

  useEffect(() => {
    if (user?.role === "ADMIN") loadAdmin().catch(() => undefined);
  }, [selectedDate]);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };
  useEffect(() => {
    if (!cameraOpen) { stopCamera(); return; }
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: "user" } })
      .then(async (stream) => {
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      })
      .catch(() => {
        setCameraOpen(false);
        toast({ title: "Kamera tidak tersedia", description: "Periksa izin kamera pada browser.", variant: "destructive" });
      });
    return stopCamera;
  }, [cameraOpen]);

  const openCamera = (session: Session, action: "check-in" | "check-out") => {
    setPending({ session, action });
    setCameraOpen(true);
  };
  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video?.videoWidth || !video.videoHeight) throw new Error("Kamera belum siap.");
    const scale = Math.min(1, 1280 / video.videoWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Foto tidak dapat diambil.");
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.72);
  };
  const getLocation = () => new Promise<Location>((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error("Browser tidak mendukung lokasi.")); return; }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy ?? null }),
      () => reject(new Error("Izin lokasi ditolak atau lokasi tidak terbaca.")),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });

  const saveAttendance = async () => {
    if (!pending || !user) return;
    setSaving(true);
    try {
      const [photo, location] = await Promise.all([Promise.resolve(capturePhoto()), getLocation()]);
      const response = await fetch("/api/teacher-attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, scheduleId: pending.session.id, action: pending.action, date: getLocalDateKey(), photo, location }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? "Gagal menyimpan absensi");
      await loadTeacher(user);
      setCameraOpen(false);
      setPending(null);
      toast({ title: "Absensi tersimpan", description: `${pending.session.className} · ${pending.session.startTime}-${pending.session.endTime} WIB berhasil dicatat.` });
    } catch (error) {
      toast({ title: "Gagal menyimpan", description: error instanceof Error ? error.message : "Terjadi kesalahan", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const downloadRecap = () => {
    if (!visibleRecap.length) {
      toast({ title: "Belum ada data", description: "Tidak ada rekap untuk diunduh.", variant: "destructive" });
      return;
    }
    const rows = visibleRecap.map((item) => [
      item.date,
      item.teacher?.fullName ?? "-",
      item.teacher?.user?.email ?? item.teacher?.phone ?? "-",
      item.schedule.className,
      `${item.schedule.startTime}-${item.schedule.endTime}`,
      item.attendance?.checkInTime ?? "-",
      item.attendance?.checkOutTime ?? "-",
      mapUrl(item.attendance?.checkInLocation),
      mapUrl(item.attendance?.checkOutLocation),
      statusLabels[item.status],
    ]);
    const headers = ["Tanggal", "Pengajar", "Kontak", "Kelas", "Jadwal", "Jam Datang", "Jam Keluar", "Lokasi Datang", "Lokasi Keluar", "Status"];
    const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `rekap-sesi-pengajar-${recapStart}-${recapEnd}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const AttendanceDetail = ({ attendance }: { attendance: Attendance | null }) => (
    <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
      <div><p className="text-muted-foreground">Jam datang</p><p className="font-semibold">{attendance?.checkInTime ?? "-"}</p></div>
      <div><p className="text-muted-foreground">Jam keluar</p><p className="font-semibold">{attendance?.checkOutTime ?? "-"}</p></div>
      <div><p className="text-muted-foreground">Bukti datang</p><PhotoLink url={attendance?.checkInPhotoUrl} /></div>
      <div><p className="text-muted-foreground">Lokasi datang</p><LocationLink location={attendance?.checkInLocation} area={attendance?.checkInAreaStatus} /></div>
    </div>
  );

  return (
    <DashboardLayout title="Absensi Pengajar" subtitle={isTeacher ? "Absen datang dan pulang pada setiap sesi mengajar" : "Pantau seluruh sesi mengajar dan kehadiran pengajar"}>
      {isTeacher ? (
        <div className="space-y-6">
          <Card className="border-0 shadow-card">
            <CardHeader><CardTitle>Sesi Mengajar Hari Ini</CardTitle><p className="text-sm text-muted-foreground">{teacherName} · {formatDate(getLocalDateKey())}</p></CardHeader>
            <CardContent className="space-y-4">
              {loading && <p className="text-muted-foreground">Memuat sesi...</p>}
              {!loading && teacherSessions.length === 0 && (
                <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
                  Tidak ada sesi mengajar yang ditugaskan hari ini. Admin dapat mengaturnya melalui menu Kelas.
                </div>
              )}
              {teacherSessions.map((session) => (
                <div key={session.id} className="rounded-xl border p-4">
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                    <div><h3 className="text-lg font-semibold">{session.className}</h3><p className="text-sm text-muted-foreground"><Clock className="mr-1 inline h-4 w-4" />{session.startTime}-{session.endTime} WIB</p></div>
                    <StatusBadge status={session.status} />
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{session.availability.message}</p>
                  <div className="my-4"><AttendanceDetail attendance={session.attendance} /></div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="gradient" onClick={() => openCamera(session, "check-in")} disabled={saving || session.status !== "BELUM_ABSEN" || !session.availability.canCheckIn}><Camera className="h-4 w-4" /> Absen Datang</Button>
                    <Button variant="outline" onClick={() => openCamera(session, "check-out")} disabled={saving || session.status !== "SUDAH_DATANG" || !session.availability.canCheckOut}><Camera className="h-4 w-4" /> Absen Pulang</Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-card">
            <CardHeader><CardTitle>Riwayat Sesi Terakhir</CardTitle></CardHeader>
            <CardContent><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Tanggal</TableHead><TableHead>Kelas</TableHead><TableHead>Jadwal</TableHead><TableHead>Datang</TableHead><TableHead>Pulang</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>
              {recent.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Belum ada riwayat.</TableCell></TableRow>}
              {recent.map((item) => <TableRow key={item.id}><TableCell>{formatDate(item.date)}</TableCell><TableCell>{item.session?.className ?? "Data lama"}</TableCell><TableCell>{item.session ? `${item.session.startTime}-${item.session.endTime}` : "-"}</TableCell><TableCell>{item.checkInTime ?? "-"}</TableCell><TableCell>{item.checkOutTime ?? "-"}</TableCell><TableCell><StatusBadge status={item.checkOutTime ? "SELESAI" : item.checkInTime ? "SUDAH_DATANG" : "BELUM_ABSEN"} /></TableCell></TableRow>)}
            </TableBody></Table></div></CardContent>
          </Card>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><Input type="date" className="w-full sm:w-48" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} /><Button variant="outline" onClick={() => user && loadData(user)}><RefreshCw className="h-4 w-4" /> Refresh</Button></div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {[{ label: "Pengajar", value: adminStats.teachers, icon: Users }, { label: "Total Sesi", value: adminStats.sessions, icon: CalendarDays }, { label: "Sudah Datang", value: adminStats.checkedIn, icon: CheckCircle2 }, { label: "Selesai", value: adminStats.completed, icon: Clock }, { label: "Belum Absen", value: adminStats.missing, icon: AlertCircle }].map((item) => <Card key={item.label} className="border-0 shadow-card"><CardContent className="flex items-center gap-3 p-4"><item.icon className="h-6 w-6 text-primary" /><div><p className="text-2xl font-bold">{item.value}</p><p className="text-sm text-muted-foreground">{item.label}</p></div></CardContent></Card>)}
          </div>
          <Card className="border-0 shadow-card"><CardHeader><CardTitle>Sesi Pengajar · {formatDate(selectedDate)}</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Pengajar</TableHead><TableHead>Kelas</TableHead><TableHead>Jadwal</TableHead><TableHead>Jam Datang</TableHead><TableHead>Jam Keluar</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>
            {adminSessions.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Tidak ada sesi pada tanggal ini.</TableCell></TableRow>}
            {adminSessions.map((session) => <TableRow key={`${session.id}-${selectedDate}`}><TableCell><p className="font-medium">{session.teacher?.fullName ?? "-"}</p><p className="text-xs text-muted-foreground">{session.teacher?.user?.email ?? session.teacher?.phone ?? "-"}</p></TableCell><TableCell>{session.className}</TableCell><TableCell>{session.startTime}-{session.endTime}</TableCell><TableCell>{session.attendance?.checkInTime ?? "-"}</TableCell><TableCell>{session.attendance?.checkOutTime ?? "-"}</TableCell><TableCell><StatusBadge status={session.status} /></TableCell></TableRow>)}
          </TableBody></Table></div></CardContent></Card>

          <Card className="border-0 shadow-card"><CardHeader><div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"><div><CardTitle>Rekap Absensi Per Sesi</CardTitle><p className="text-sm text-muted-foreground">Filter pengajar dan rentang tanggal, lalu unduh CSV.</p></div><div className="flex flex-wrap gap-2"><Input type="date" className="w-40" value={recapStart} onChange={(event) => setRecapStart(event.target.value)} /><Input type="date" className="w-40" value={recapEnd} onChange={(event) => setRecapEnd(event.target.value)} /><Select value={selectedTeacher} onValueChange={setSelectedTeacher}><SelectTrigger className="w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Semua Pengajar</SelectItem>{teacherOptions.map((teacher) => <SelectItem key={teacher.id} value={teacher.id}>{teacher.fullName}</SelectItem>)}</SelectContent></Select><Button variant="outline" onClick={loadRecap} disabled={recapLoading}><RefreshCw className="h-4 w-4" /> Muat</Button><Button variant="gradient" onClick={downloadRecap}><Download className="h-4 w-4" /> Download</Button></div></div></CardHeader><CardContent>
            <div className="mb-4 grid gap-3 sm:grid-cols-4">{[{ label: "Total Sesi", value: recapStats.sessions }, { label: "Sudah Datang", value: recapStats.checkedIn }, { label: "Selesai", value: recapStats.completed }, { label: "Belum Absen", value: recapStats.missing }].map((item) => <div key={item.label} className="rounded-lg bg-muted/50 p-3"><p className="text-xl font-bold">{item.value}</p><p className="text-xs text-muted-foreground">{item.label}</p></div>)}</div>
            <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Tanggal</TableHead><TableHead>Pengajar</TableHead><TableHead>Kelas</TableHead><TableHead>Jadwal</TableHead><TableHead>Datang</TableHead><TableHead>Pulang</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{visibleRecap.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Rekap belum tersedia.</TableCell></TableRow>}{visibleRecap.map((item) => <TableRow key={`${item.date}-${item.schedule.id}-${item.teacher?.id}`}><TableCell>{formatDate(item.date)}</TableCell><TableCell>{item.teacher?.fullName ?? "-"}</TableCell><TableCell>{item.schedule.className}</TableCell><TableCell>{item.schedule.startTime}-{item.schedule.endTime}</TableCell><TableCell>{item.attendance?.checkInTime ?? "-"}</TableCell><TableCell>{item.attendance?.checkOutTime ?? "-"}</TableCell><TableCell><StatusBadge status={item.status} /></TableCell></TableRow>)}</TableBody></Table></div>
          </CardContent></Card>
        </div>
      )}

      <Dialog open={cameraOpen} onOpenChange={(open) => { setCameraOpen(open); if (!open) setPending(null); }}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>Ambil Foto Absensi</DialogTitle><DialogDescription>{pending ? `${pending.session.className} · ${pending.session.startTime}-${pending.session.endTime} WIB · ${pending.action === "check-in" ? "Datang" : "Pulang"}` : "Sesi pengajar"}</DialogDescription></DialogHeader><div className="aspect-video overflow-hidden rounded-lg bg-muted"><video ref={videoRef} className="h-full w-full object-cover" style={{ transform: "scaleX(-1)" }} muted playsInline /></div><DialogFooter><Button variant="outline" onClick={() => setCameraOpen(false)} disabled={saving}>Tutup</Button><Button variant="gradient" onClick={saveAttendance} disabled={saving || !pending}><Camera className="h-4 w-4" />{saving ? "Menyimpan..." : pending?.action === "check-out" ? "Simpan Pulang" : "Simpan Datang"}</Button></DialogFooter></DialogContent></Dialog>
    </DashboardLayout>
  );
}
