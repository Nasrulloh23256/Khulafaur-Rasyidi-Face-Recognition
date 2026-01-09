import { useEffect, useMemo, useState } from "react";
import {
  Calendar,
  Download,
  ClipboardCheck,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import DashboardLayout from "@/components/DashboardLayout";
import { useToast } from "@/hooks/use-toast";

type ClassItem = {
  id: string;
  name: string;
};

type AcademicYear = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
};

type Semester = {
  id: string;
  name: "GANJIL" | "GENAP";
  startDate: string;
  endDate: string;
  academicYearId: string;
};

type RecapStudent = {
  id: string;
  fullName: string;
  studentNumber: string | null;
  statuses: Record<string, string>;
};

const monthNames = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

const weekOptions = [
  { value: "all", label: "Semua Minggu" },
  { value: "1", label: "Minggu 1" },
  { value: "2", label: "Minggu 2" },
  { value: "3", label: "Minggu 3" },
  { value: "4", label: "Minggu 4" },
  { value: "5", label: "Minggu 5" },
];

const pad = (value: number) => String(value).padStart(2, "0");

const startOfDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const endOfDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
};

const clampDate = (value: Date, min: Date, max: Date) => {
  const time = Math.min(Math.max(value.getTime(), min.getTime()), max.getTime());
  return new Date(time);
};

const toMonthValue = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;

const buildMonthOptions = (start: Date, end: Date) => {
  const options: { value: string; label: string }[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cursor <= end) {
    options.push({
      value: toMonthValue(cursor),
      label: `${monthNames[cursor.getMonth()]} ${cursor.getFullYear()}`,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return options;
};

const parseMonthValue = (value: string) => {
  const [yearStr, monthStr] = value.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  if (Number.isNaN(year) || Number.isNaN(monthIndex)) return null;
  return { year, monthIndex };
};

const RekapAbsensi = () => {
  const { toast } = useToast();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedYearId, setSelectedYearId] = useState("");
  const [selectedSemesterId, setSelectedSemesterId] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedWeek, setSelectedWeek] = useState("all");
  const [dates, setDates] = useState<string[]>([]);
  const [rekapData, setRekapData] = useState<RecapStudent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const selectedClass = useMemo(
    () => classes.find((item) => item.id === selectedClassId) ?? null,
    [classes, selectedClassId],
  );

  const selectedYear = useMemo(
    () => years.find((year) => year.id === selectedYearId) ?? null,
    [years, selectedYearId],
  );

  const semesterOptions = useMemo(
    () => semesters.filter((semester) => (selectedYearId ? semester.academicYearId === selectedYearId : true)),
    [semesters, selectedYearId],
  );

  const selectedSemester = useMemo(() => {
    if (selectedSemesterId === "all") return null;
    return semesterOptions.find((semester) => semester.id === selectedSemesterId) ?? null;
  }, [semesterOptions, selectedSemesterId]);

  const baseRange = useMemo(() => {
    if (!selectedYear) return null;
    const start = new Date(selectedSemester?.startDate ?? selectedYear.startDate);
    const end = new Date(selectedSemester?.endDate ?? selectedYear.endDate);
    return { start, end };
  }, [selectedYear, selectedSemester]);

  const monthOptions = useMemo(() => {
    if (!baseRange) return [];
    return buildMonthOptions(baseRange.start, baseRange.end);
  }, [baseRange]);

  const selectedMonthLabel = useMemo(() => {
    return monthOptions.find((option) => option.value === selectedMonth)?.label ?? "-";
  }, [monthOptions, selectedMonth]);

  const dateRange = useMemo(() => {
    if (!baseRange || !selectedMonth) return null;
    const parsed = parseMonthValue(selectedMonth);
    if (!parsed) return null;
    const { year, monthIndex } = parsed;
    const monthStart = new Date(year, monthIndex, 1);
    const monthEnd = new Date(year, monthIndex + 1, 0);

    let rangeStart = monthStart;
    let rangeEnd = monthEnd;

    if (selectedWeek !== "all") {
      const weekNumber = Number(selectedWeek);
      const startDay = (weekNumber - 1) * 7 + 1;
      const lastDay = monthEnd.getDate();
      const endDay = Math.min(startDay + 6, lastDay);
      rangeStart = new Date(year, monthIndex, startDay);
      rangeEnd = new Date(year, monthIndex, endDay);
    }

    rangeStart = clampDate(rangeStart, baseRange.start, baseRange.end);
    rangeEnd = clampDate(rangeEnd, baseRange.start, baseRange.end);

    if (rangeStart > rangeEnd) {
      rangeStart = baseRange.start;
      rangeEnd = baseRange.end;
    }

    return { start: startOfDay(rangeStart), end: endOfDay(rangeEnd) };
  }, [baseRange, selectedMonth, selectedWeek]);

  useEffect(() => {
    const loadFilters = async () => {
      try {
        const [classRes, yearRes, semesterRes] = await Promise.all([
          fetch("/api/classes"),
          fetch("/api/academic-years"),
          fetch("/api/semesters"),
        ]);
        const classData = await classRes.json();
        const yearData = await yearRes.json();
        const semesterData = await semesterRes.json();

        if (classRes.ok) setClasses(classData);
        if (yearRes.ok) setYears(yearData);
        if (semesterRes.ok) setSemesters(semesterData);
      } catch (error) {
        toast({
          title: "Gagal memuat filter",
          description: "Tidak bisa mengambil data kelas, semester, atau tahun ajaran",
          variant: "destructive",
        });
      }
    };
    loadFilters();
  }, [toast]);

  useEffect(() => {
    if (!selectedClassId && classes.length > 0) {
      setSelectedClassId(classes[0].id);
    }
  }, [classes, selectedClassId]);

  useEffect(() => {
    if (!selectedYearId && years.length > 0) {
      const activeYear = years.find((year) => year.isActive) ?? years[0];
      if (activeYear) setSelectedYearId(activeYear.id);
    }
  }, [years, selectedYearId]);

  useEffect(() => {
    if (selectedSemesterId !== "all" && !semesterOptions.some((item) => item.id === selectedSemesterId)) {
      setSelectedSemesterId("all");
    }
  }, [semesterOptions, selectedSemesterId]);

  useEffect(() => {
    if (monthOptions.length === 0) {
      setSelectedMonth("");
      return;
    }
    if (!monthOptions.some((option) => option.value === selectedMonth)) {
      const currentValue = toMonthValue(new Date());
      const fallback = monthOptions.find((option) => option.value === currentValue) ?? monthOptions[0];
      if (fallback) setSelectedMonth(fallback.value);
    }
  }, [monthOptions, selectedMonth]);

  useEffect(() => {
    setSelectedWeek("all");
  }, [selectedMonth]);

  useEffect(() => {
    const loadRecap = async () => {
      if (!selectedClassId || !dateRange) return;
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/reports/recap?classId=${selectedClassId}&start=${dateRange.start.toISOString()}&end=${dateRange.end.toISOString()}`,
        );
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error ?? "Gagal memuat rekap absensi");
        }
        setDates(data.dates ?? []);
        setRekapData(data.students ?? []);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Gagal memuat rekap absensi";
        toast({
          title: "Gagal memuat data",
          description: message,
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };
    loadRecap();
  }, [selectedClassId, dateRange, toast]);

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "H":
        return "bg-success/20 text-success font-semibold";
      case "S":
        return "bg-destructive/20 text-destructive font-semibold";
      case "I":
        return "bg-warning/20 text-warning font-semibold";
      case "A":
        return "bg-muted text-muted-foreground font-semibold";
      default:
        return "bg-muted/40 text-muted-foreground";
    }
  };

  const handleExport = () => {
    if (!dateRange || rekapData.length === 0 || dates.length === 0) {
      toast({
        title: "Tidak ada data",
        description: "Rekap belum tersedia untuk diexport.",
        variant: "destructive",
      });
      return;
    }

    setIsExporting(true);
    try {
      const delimiter = ";";
      const escapeCell = (value: string) => {
        const needsQuote = value.includes(delimiter) || value.includes("\"") || value.includes("\n");
        if (!needsQuote) return value;
        return `"${value.replace(/\"/g, "\"\"")}"`;
      };

      const dateHeaders = dates.map((dateKey) => {
        const parts = dateKey.split("-");
        const day = parts[2] ?? dateKey;
        return day;
      });

      const rows = [
        ["No", "Nama", "NIS", ...dateHeaders, "H", "S", "I", "A", "Persentase"],
        ...rekapData.map((student, index) => {
          const statuses = dates.map((dateKey) => student.statuses[dateKey] ?? "-");
          const hadir = statuses.filter((value) => value === "H").length;
          const sakit = statuses.filter((value) => value === "S").length;
          const izin = statuses.filter((value) => value === "I").length;
          const alpha = statuses.filter((value) => value === "A").length;
          const total = hadir + sakit + izin + alpha;
          const percent = total > 0 ? (hadir / total) * 100 : 0;
          const nisValue = student.studentNumber ? `'${student.studentNumber}` : "-";

          return [
            String(index + 1),
            student.fullName,
            nisValue,
            ...statuses,
            String(hadir),
            String(sakit),
            String(izin),
            String(alpha),
            percent.toFixed(1),
          ];
        }),
      ];

      const csv = rows
        .map((row) => row.map((value) => escapeCell(String(value))).join(delimiter))
        .join("\r\n");
      const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const start = dateRange.start.toISOString().slice(0, 10);
      const end = dateRange.end.toISOString().slice(0, 10);
      const className = selectedClass?.name ?? "kelas";
      link.download = `rekap-absensi-${className}-${start}-sampai-${end}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DashboardLayout title="Rekap Absensi" subtitle="Lihat rekap kehadiran siswa per bulan">
      <div className="space-y-6">
        {/* Filters */}
        <Card className="border-0 shadow-card">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">Pilih:</span>
              </div>
              <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Kelas" />
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
              <Select value={selectedYearId} onValueChange={setSelectedYearId}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Tahun Ajaran" />
                </SelectTrigger>
                <SelectContent>
                  {years.length === 0 ? (
                    <SelectItem value="empty" disabled>
                      Belum ada tahun ajaran
                    </SelectItem>
                  ) : (
                    years.map((year) => (
                      <SelectItem key={year.id} value={year.id}>
                        {year.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <Select value={selectedSemesterId} onValueChange={setSelectedSemesterId}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Semester" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Semester</SelectItem>
                  {semesterOptions.map((semester) => (
                    <SelectItem key={semester.id} value={semester.id}>
                      {semester.name === "GANJIL" ? "Ganjil" : "Genap"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Bulan" />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.length === 0 ? (
                    <SelectItem value="empty" disabled>
                      Belum ada bulan
                    </SelectItem>
                  ) : (
                    monthOptions.map((month) => (
                      <SelectItem key={month.value} value={month.value}>
                        {month.label}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <Select value={selectedWeek} onValueChange={setSelectedWeek}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Minggu" />
                </SelectTrigger>
                <SelectContent>
                  {weekOptions.map((week) => (
                    <SelectItem key={week.value} value={week.value}>
                      {week.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="gradient"
                size="sm"
                className="ml-auto gap-2"
                onClick={handleExport}
                disabled={isExporting}
              >
                {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Export Excel
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 items-center justify-center">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-success/20 text-success font-bold flex items-center justify-center text-sm">H</span>
            <span className="text-sm text-muted-foreground">Hadir</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-destructive/20 text-destructive font-bold flex items-center justify-center text-sm">S</span>
            <span className="text-sm text-muted-foreground">Sakit</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-warning/20 text-warning font-bold flex items-center justify-center text-sm">I</span>
            <span className="text-sm text-muted-foreground">Izin</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-muted text-muted-foreground font-bold flex items-center justify-center text-sm">A</span>
            <span className="text-sm text-muted-foreground">Alpha</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-muted/40 text-muted-foreground font-bold flex items-center justify-center text-sm">-</span>
            <span className="text-sm text-muted-foreground">Belum dicatat</span>
          </div>
        </div>

        {/* Rekap Table */}
        <Card className="border-0 shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5" />
              Rekap Absensi {selectedClass?.name ?? "-"} - {selectedMonthLabel}
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-card w-12">No</TableHead>
                  <TableHead className="sticky left-12 bg-card min-w-[160px]">Nama Siswa</TableHead>
                  <TableHead className="sticky left-[208px] bg-card w-[120px]">NIS</TableHead>
                  {dates.map((dateKey) => {
                    const day = dateKey.split("-")[2] ?? dateKey;
                    return (
                      <TableHead key={dateKey} className="text-center min-w-[44px]">
                        {day}
                      </TableHead>
                    );
                  })}
                  <TableHead className="text-center">H</TableHead>
                  <TableHead className="text-center">S</TableHead>
                  <TableHead className="text-center">I</TableHead>
                  <TableHead className="text-center">A</TableHead>
                  <TableHead className="text-center">%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={dates.length + 8} className="text-center text-muted-foreground">
                      Memuat data...
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && rekapData.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={dates.length + 8} className="text-center text-muted-foreground">
                      Belum ada data absensi di periode ini.
                    </TableCell>
                  </TableRow>
                )}
                {rekapData.map((student, index) => {
                  const statuses = dates.map((dateKey) => student.statuses[dateKey] ?? "-");
                  const hadir = statuses.filter((value) => value === "H").length;
                  const sakit = statuses.filter((value) => value === "S").length;
                  const izin = statuses.filter((value) => value === "I").length;
                  const alpha = statuses.filter((value) => value === "A").length;
                  const total = hadir + sakit + izin + alpha;
                  const persentase = total > 0 ? (hadir / total) * 100 : 0;

                  return (
                    <TableRow key={student.id}>
                      <TableCell className="sticky left-0 bg-card font-medium w-12">{index + 1}</TableCell>
                      <TableCell className="sticky left-12 bg-card font-medium min-w-[160px]">
                        {student.fullName}
                      </TableCell>
                      <TableCell className="sticky left-[208px] bg-card font-mono text-sm w-[120px]">
                        {student.studentNumber ?? "-"}
                      </TableCell>
                      {statuses.map((status, dateIndex) => (
                        <TableCell key={`${student.id}-${dateIndex}`} className="text-center p-1">
                          <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-xs ${getStatusStyle(status)}`}>
                            {status}
                          </span>
                        </TableCell>
                      ))}
                      <TableCell className="text-center font-semibold text-success">{hadir}</TableCell>
                      <TableCell className="text-center font-semibold text-destructive">{sakit}</TableCell>
                      <TableCell className="text-center font-semibold text-warning">{izin}</TableCell>
                      <TableCell className="text-center font-semibold text-muted-foreground">{alpha}</TableCell>
                      <TableCell className="text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                          persentase >= 90 ? "bg-success/20 text-success" :
                          persentase >= 75 ? "bg-warning/20 text-warning" :
                          "bg-destructive/20 text-destructive"
                        }`}>
                          {persentase.toFixed(1)}%
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default RekapAbsensi;
