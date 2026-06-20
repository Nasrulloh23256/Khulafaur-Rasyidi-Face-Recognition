import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Clock,
  LogIn,
  LogOut,
  RefreshCw,
  UserCheck,
  Users,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

const getLocalDateKey = (value = new Date()) => {
  const offsetDate = new Date(value.getTime() - value.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 10);
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

const AbsensiPengajarPage = () => {
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
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
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const isTeacher = currentUser?.role === "TEACHER";
  const pageSubtitle = isTeacher
    ? "Catat jam datang dan jam pulang pengajar"
    : "Pantau jam datang dan jam pulang semua pengajar";

  const formattedSelectedDate = useMemo(() => formatDate(selectedDate), [selectedDate]);

  const loadTeacherAttendance = async (userId: string) => {
    const todayKey = getLocalDateKey();
    const response = await fetch(`/api/teacher-attendance?userId=${userId}&date=${todayKey}`);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error ?? "Gagal memuat absensi pengajar");
    }
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

  const loadData = async (user: AuthUser | null = currentUser) => {
    if (!user) return;

    setIsLoading(true);
    try {
      if (user.role === "TEACHER") {
        await loadTeacherAttendance(user.id);
      } else {
        await loadAdminAttendance();
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

  const handleTeacherAction = async (action: "check-in" | "check-out") => {
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
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "Gagal menyimpan absensi");
      }

      setTodayAttendance(data.attendance ?? null);
      setTeacherStatus(data.status ?? "BELUM_ABSEN");
      await loadTeacherAttendance(currentUser.id);

      toast({
        title: "Absensi tersimpan",
        description: action === "check-in" ? "Jam datang berhasil dicatat." : "Jam pulang berhasil dicatat.",
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
                      onClick={() => handleTeacherAction("check-in")}
                      disabled={!canCheckIn || isSaving}
                    >
                      <LogIn className="w-4 h-4" />
                      Absen Datang
                    </Button>
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={() => handleTeacherAction("check-out")}
                      disabled={!canCheckOut || isSaving}
                    >
                      <LogOut className="w-4 h-4" />
                      Absen Pulang
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
                    Gunakan tombol datang saat mulai mengajar dan tombol pulang saat selesai.
                  </p>
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
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AbsensiPengajarPage;
