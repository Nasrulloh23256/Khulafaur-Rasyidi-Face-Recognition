import { useEffect, useMemo, useState } from "react";
import { Banknote, CalendarDays, Clock, RefreshCw, Save, Users, Wallet } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type PayrollPeriod = "WEEKLY" | "MONTHLY";

type PayrollSetting = {
  id: string;
  hourlyRate: number;
  period: PayrollPeriod;
  updatedAt: string;
};

type PayrollTeacherOption = {
  id: string;
  fullName: string;
};

type PayrollDaily = {
  id: string;
  date: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  workedMinutes: number;
  workedHours: number;
  pay: number;
  status: "LENGKAP" | "BELUM_KELUAR";
};

type PayrollTeacher = {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  classes: { id: string; name: string }[];
  totals: {
    completeAttendances: number;
    incompleteAttendances: number;
    workedMinutes: number;
    workedHours: number;
    pay: number;
  };
  daily: PayrollDaily[];
};

type PayrollResponse = {
  setting: PayrollSetting;
  period: {
    type: PayrollPeriod;
    label: string;
    anchorDate: string;
    start: string;
    end: string;
  };
  teacherOptions: PayrollTeacherOption[];
  stats: {
    totalTeachers: number;
    completeAttendances: number;
    incompleteAttendances: number;
    workedMinutes: number;
    workedHours: number;
    totalPay: number;
  };
  teachers: PayrollTeacher[];
};

const getLocalDateKey = (value = new Date()) => {
  const offsetDate = new Date(value.getTime() - value.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 10);
};

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);

const formatHours = (value: number) =>
  `${new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value)} jam`;

const emptyStats: PayrollResponse["stats"] = {
  totalTeachers: 0,
  completeAttendances: 0,
  incompleteAttendances: 0,
  workedMinutes: 0,
  workedHours: 0,
  totalPay: 0,
};

const PenggajianPengajarPage = () => {
  const { toast } = useToast();
  const [selectedTeacherId, setSelectedTeacherId] = useState("all");
  const [anchorDate, setAnchorDate] = useState(getLocalDateKey);
  const [teacherOptions, setTeacherOptions] = useState<PayrollTeacherOption[]>([]);
  const [teachers, setTeachers] = useState<PayrollTeacher[]>([]);
  const [stats, setStats] = useState<PayrollResponse["stats"]>(emptyStats);
  const [period, setPeriod] = useState<PayrollResponse["period"] | null>(null);
  const [setting, setSetting] = useState<PayrollSetting | null>(null);
  const [hourlyRateInput, setHourlyRateInput] = useState("0");
  const [periodInput, setPeriodInput] = useState<PayrollPeriod>("MONTHLY");
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingSetting, setIsSavingSetting] = useState(false);

  const flatDailyRows = useMemo(
    () =>
      teachers.flatMap((teacher) =>
        teacher.daily.map((item) => ({
          ...item,
          teacherId: teacher.id,
          fullName: teacher.fullName,
          classes: teacher.classes.length > 0 ? teacher.classes.map((kelas) => kelas.name).join(", ") : "-",
        })),
      ),
    [teachers],
  );

  const loadPayroll = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        date: anchorDate,
        teacherId: selectedTeacherId,
      });
      const response = await fetch(`/api/teacher-payroll?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error ?? "Gagal memuat penggajian pengajar");
      }

      const payrollData = data as PayrollResponse;
      setTeacherOptions(payrollData.teacherOptions ?? []);
      setTeachers(payrollData.teachers ?? []);
      setStats(payrollData.stats ?? emptyStats);
      setPeriod(payrollData.period ?? null);
      setSetting(payrollData.setting ?? null);
      setHourlyRateInput(String(payrollData.setting?.hourlyRate ?? 0));
      setPeriodInput(payrollData.setting?.period ?? "MONTHLY");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal memuat penggajian pengajar";
      toast({
        title: "Gagal memuat data",
        description: message,
        variant: "destructive",
      });
      setTeachers([]);
      setStats(emptyStats);
      setPeriod(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPayroll();
  }, [selectedTeacherId, anchorDate]);

  useEffect(() => {
    if (
      selectedTeacherId !== "all" &&
      teacherOptions.length > 0 &&
      !teacherOptions.some((teacher) => teacher.id === selectedTeacherId)
    ) {
      setSelectedTeacherId("all");
    }
  }, [selectedTeacherId, teacherOptions]);

  const handleSaveSetting = async (event: React.FormEvent) => {
    event.preventDefault();
    const hourlyRate = Number(hourlyRateInput);

    if (!Number.isFinite(hourlyRate) || hourlyRate < 0) {
      toast({
        title: "Tarif tidak valid",
        description: "Masukkan tarif per jam dengan angka yang benar.",
        variant: "destructive",
      });
      return;
    }

    setIsSavingSetting(true);
    try {
      const response = await fetch("/api/teacher-payroll", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hourlyRate,
          period: periodInput,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error ?? "Gagal menyimpan pengaturan gaji");
      }

      setSetting(data.setting ?? null);
      setHourlyRateInput(String(data.setting?.hourlyRate ?? 0));
      setPeriodInput(data.setting?.period ?? "MONTHLY");
      await loadPayroll();

      toast({
        title: "Pengaturan tersimpan",
        description: "Tarif dan periode penggajian berhasil diperbarui.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal menyimpan pengaturan gaji";
      toast({
        title: "Gagal menyimpan",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSavingSetting(false);
    }
  };

  const renderStatus = (status: PayrollDaily["status"]) => {
    if (status === "LENGKAP") {
      return <Badge className="bg-success text-success-foreground">Lengkap</Badge>;
    }
    return <Badge className="bg-warning text-warning-foreground">Belum Keluar</Badge>;
  };

  return (
    <DashboardLayout title="Penggajian Pengajar" subtitle="Hitung honor berdasarkan jam kerja pengajar">
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 xl:grid-cols-[0.8fr_1.2fr] gap-4">
          <Card className="border-0 shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="w-5 h-5" />
                Pengaturan Gaji
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveSetting} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="hourly-rate">Tarif Per Jam</Label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                      Rp
                    </span>
                    <Input
                      id="hourly-rate"
                      type="number"
                      min="0"
                      value={hourlyRateInput}
                      className="pl-10"
                      onChange={(event) => setHourlyRateInput(event.target.value)}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Sistem Penggajian</Label>
                  <Select value={periodInput} onValueChange={(value) => setPeriodInput(value as PayrollPeriod)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih periode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="WEEKLY">Mingguan</SelectItem>
                        <SelectItem value="MONTHLY">Bulanan</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" variant="gradient" className="gap-2" disabled={isSavingSetting}>
                  <Save className="w-4 h-4" />
                  {isSavingSetting ? "Menyimpan..." : "Simpan Pengaturan"}
                </Button>
                {setting && (
                  <p className="text-sm text-muted-foreground">
                    Tarif aktif {formatCurrency(setting.hourlyRate)} per jam.
                  </p>
                )}
              </form>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-card">
            <CardHeader>
              <div className="flex flex-col lg:flex-row gap-4 justify-between lg:items-center">
                <div>
                  <CardTitle>Rekap Penggajian</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {period ? `${period.label}: ${formatDate(period.start)} sampai ${formatDate(period.end)}` : "-"}
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-[220px_160px_auto] gap-2">
                  <Select value={selectedTeacherId} onValueChange={setSelectedTeacherId}>
                    <SelectTrigger aria-label="Filter pengajar">
                      <SelectValue placeholder="Semua Pengajar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="all">Semua Pengajar</SelectItem>
                        {teacherOptions.map((teacher) => (
                          <SelectItem key={teacher.id} value={teacher.id}>
                            {teacher.fullName}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <Input type="date" value={anchorDate} onChange={(event) => setAnchorDate(event.target.value)} />
                  <Button variant="outline" className="gap-2" onClick={loadPayroll} disabled={isLoading}>
                    <RefreshCw className="w-4 h-4" />
                    {isLoading ? "Memuat..." : "Refresh"}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
                <div className="rounded-xl bg-muted/50 p-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="w-4 h-4" />
                    Pengajar
                  </div>
                  <p className="mt-2 text-2xl font-bold text-foreground">{stats.totalTeachers}</p>
                </div>
                <div className="rounded-xl bg-muted/50 p-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    Total Jam
                  </div>
                  <p className="mt-2 text-2xl font-bold text-foreground">{formatHours(stats.workedHours)}</p>
                </div>
                <div className="rounded-xl bg-success/10 p-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Banknote className="w-4 h-4" />
                    Total Gaji
                  </div>
                  <p className="mt-2 text-2xl font-bold text-success">{formatCurrency(stats.totalPay)}</p>
                </div>
                <div className="rounded-xl bg-muted/50 p-4">
                  <p className="text-sm text-muted-foreground">Absensi Lengkap</p>
                  <p className="mt-2 text-2xl font-bold text-foreground">{stats.completeAttendances}</p>
                </div>
                <div className="rounded-xl bg-warning/10 p-4">
                  <p className="text-sm text-muted-foreground">Belum Keluar</p>
                  <p className="mt-2 text-2xl font-bold text-warning">{stats.incompleteAttendances}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-0 shadow-card">
          <CardHeader>
            <CardTitle>Ringkasan Gaji Pengajar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pengajar</TableHead>
                    <TableHead>Kelas</TableHead>
                    <TableHead>Absensi Lengkap</TableHead>
                    <TableHead>Total Jam</TableHead>
                    <TableHead>Tarif/Jam</TableHead>
                    <TableHead>Total Gaji</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        Memuat penggajian...
                      </TableCell>
                    </TableRow>
                  )}
                  {!isLoading && teachers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        Belum ada data penggajian.
                      </TableCell>
                    </TableRow>
                  )}
                  {teachers.map((teacher) => (
                    <TableRow key={teacher.id}>
                      <TableCell>
                        <div className="font-semibold text-foreground">{teacher.fullName}</div>
                        <div className="text-xs text-muted-foreground">{teacher.email ?? teacher.phone ?? "-"}</div>
                      </TableCell>
                      <TableCell>
                        {teacher.classes.length > 0 ? teacher.classes.map((item) => item.name).join(", ") : "-"}
                      </TableCell>
                      <TableCell>{teacher.totals.completeAttendances}</TableCell>
                      <TableCell>{formatHours(teacher.totals.workedHours)}</TableCell>
                      <TableCell>{formatCurrency(setting?.hourlyRate ?? 0)}</TableCell>
                      <TableCell className="font-semibold text-foreground">{formatCurrency(teacher.totals.pay)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5" />
              Detail Jam Kerja
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Pengajar</TableHead>
                    <TableHead>Kelas</TableHead>
                    <TableHead>Jam Datang</TableHead>
                    <TableHead>Jam Keluar</TableHead>
                    <TableHead>Durasi</TableHead>
                    <TableHead>Gaji</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground">
                        Memuat detail jam kerja...
                      </TableCell>
                    </TableRow>
                  )}
                  {!isLoading && flatDailyRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground">
                        Detail jam kerja belum tersedia.
                      </TableCell>
                    </TableRow>
                  )}
                  {flatDailyRows.map((item) => (
                    <TableRow key={`${item.teacherId}-${item.id}`}>
                      <TableCell>{formatDate(item.date)}</TableCell>
                      <TableCell className="font-medium text-foreground">{item.fullName}</TableCell>
                      <TableCell>{item.classes}</TableCell>
                      <TableCell>{item.checkInTime ?? "-"}</TableCell>
                      <TableCell>{item.checkOutTime ?? "-"}</TableCell>
                      <TableCell>{formatHours(item.workedHours)}</TableCell>
                      <TableCell>{formatCurrency(item.pay)}</TableCell>
                      <TableCell>{renderStatus(item.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default PenggajianPengajarPage;
