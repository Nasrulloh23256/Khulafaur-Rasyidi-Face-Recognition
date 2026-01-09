import { useEffect, useMemo, useState } from "react";
import { 
  BarChart3, 
  TrendingUp,
  Download,
  Filter,
  Medal,
  Loader2
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
import DashboardLayout from "@/components/DashboardLayout";
import { useToast } from "@/hooks/use-toast";

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

type ChartItem = {
  bulan: string;
  hadir: number;
  sakit: number;
  izin: number;
};

type RankingItem = {
  id: string;
  nama: string;
  kelas: string;
  hadir: number;
  sakit: number;
  izin: number;
  persentase: number;
};

type ReportSummary = {
  averageAttendance: number;
  totalStudents: number;
  perfectAttendance: number;
};

const monthOptions = [
  { value: "all", label: "Semua Bulan" },
  { value: "0", label: "Januari" },
  { value: "1", label: "Februari" },
  { value: "2", label: "Maret" },
  { value: "3", label: "April" },
  { value: "4", label: "Mei" },
  { value: "5", label: "Juni" },
  { value: "6", label: "Juli" },
  { value: "7", label: "Agustus" },
  { value: "8", label: "September" },
  { value: "9", label: "Oktober" },
  { value: "10", label: "November" },
  { value: "11", label: "Desember" },
];

const weekOptions = [
  { value: "all", label: "Semua Minggu" },
  { value: "1", label: "Minggu 1" },
  { value: "2", label: "Minggu 2" },
  { value: "3", label: "Minggu 3" },
  { value: "4", label: "Minggu 4" },
];

const formatPercent = (value: number) => `${value.toFixed(1)}%`;

const clampDate = (value: Date, min: Date, max: Date) => {
  const time = Math.min(Math.max(value.getTime(), min.getTime()), max.getTime());
  return new Date(time);
};

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

const Laporan = () => {
  const { toast } = useToast();
  const [filterMinggu, setFilterMinggu] = useState("all");
  const [filterBulan, setFilterBulan] = useState("all");
  const [filterSemester, setFilterSemester] = useState("all");
  const [filterTahunAjaran, setFilterTahunAjaran] = useState("");
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [summary, setSummary] = useState<ReportSummary>({
    averageAttendance: 0,
    totalStudents: 0,
    perfectAttendance: 0,
  });
  const [chartData, setChartData] = useState<ChartItem[]>([]);
  const [rankingData, setRankingData] = useState<RankingItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const selectedYear = useMemo(
    () => years.find((year) => year.id === filterTahunAjaran) ?? null,
    [years, filterTahunAjaran],
  );

  const semesterOptions = useMemo(
    () =>
      semesters.filter((semester) =>
        filterTahunAjaran ? semester.academicYearId === filterTahunAjaran : true,
      ),
    [semesters, filterTahunAjaran],
  );

  const selectedSemester = useMemo(() => {
    if (filterSemester === "all") return null;
    return semesterOptions.find((semester) => semester.id === filterSemester) ?? null;
  }, [semesterOptions, filterSemester]);

  useEffect(() => {
    const loadFilters = async () => {
      try {
        const [yearRes, semesterRes] = await Promise.all([
          fetch("/api/academic-years"),
          fetch("/api/semesters"),
        ]);
        const yearData = await yearRes.json();
        const semesterData = await semesterRes.json();

        if (yearRes.ok) {
          setYears(yearData);
          const activeYear = yearData.find((item: AcademicYear) => item.isActive) ?? yearData[0];
          if (activeYear?.id) {
            setFilterTahunAjaran(activeYear.id);
          }
        }
        if (semesterRes.ok) {
          setSemesters(semesterData);
        }
      } catch (error) {
        toast({
          title: "Gagal memuat filter",
          description: "Tidak bisa mengambil data tahun ajaran atau semester",
          variant: "destructive",
        });
      }
    };
    loadFilters();
  }, [toast]);

  useEffect(() => {
    if (filterSemester !== "all" && !semesterOptions.some((item) => item.id === filterSemester)) {
      setFilterSemester("all");
    }
  }, [semesterOptions, filterSemester]);

  useEffect(() => {
    if (filterBulan === "all" && filterMinggu !== "all") {
      setFilterMinggu("all");
    }
  }, [filterBulan, filterMinggu]);

  const dateRange = useMemo(() => {
    if (!selectedYear) return null;
    const baseStart = selectedSemester ? new Date(selectedSemester.startDate) : new Date(selectedYear.startDate);
    const baseEnd = selectedSemester ? new Date(selectedSemester.endDate) : new Date(selectedYear.endDate);

    let rangeStart = startOfDay(baseStart);
    let rangeEnd = endOfDay(baseEnd);

    if (filterBulan !== "all") {
      const monthIndex = Number(filterBulan);
      const startMonth = baseStart.getMonth();
      const yearForMonth = monthIndex >= startMonth ? baseStart.getFullYear() : baseEnd.getFullYear();
      const monthStart = new Date(yearForMonth, monthIndex, 1);
      const monthEnd = new Date(yearForMonth, monthIndex + 1, 0);
      rangeStart = startOfDay(monthStart);
      rangeEnd = endOfDay(monthEnd);
    }

    if (filterMinggu !== "all" && filterBulan !== "all") {
      const weekNumber = Number(filterMinggu);
      const weekStartDay = (weekNumber - 1) * 7 + 1;
      const monthIndex = Number(filterBulan);
      const yearForMonth = rangeStart.getFullYear();
      const lastDay = new Date(yearForMonth, monthIndex + 1, 0).getDate();
      const weekEndDay = Math.min(weekStartDay + 6, lastDay);
      const weekStart = new Date(yearForMonth, monthIndex, weekStartDay);
      const weekEnd = new Date(yearForMonth, monthIndex, weekEndDay);
      rangeStart = startOfDay(weekStart);
      rangeEnd = endOfDay(weekEnd);
    }

    rangeStart = clampDate(rangeStart, baseStart, baseEnd);
    rangeEnd = clampDate(rangeEnd, baseStart, baseEnd);

    return { start: rangeStart, end: rangeEnd };
  }, [selectedYear, selectedSemester, filterBulan, filterMinggu]);

  useEffect(() => {
    const loadReport = async () => {
      if (!dateRange) return;
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/reports/attendance?start=${dateRange.start.toISOString()}&end=${dateRange.end.toISOString()}`,
        );
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error ?? "Gagal memuat laporan");
        }

        setSummary(data.summary);
        setChartData(data.chart);
        setRankingData(data.ranking);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Gagal memuat laporan";
        toast({
          title: "Gagal memuat laporan",
          description: message,
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadReport();
  }, [dateRange, toast]);

  const handleExport = () => {
    if (!dateRange || rankingData.length === 0) {
      toast({
        title: "Tidak ada data",
        description: "Laporan belum tersedia untuk diexport.",
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

      const rows = [
        ["No", "Nama", "Kelas", "Hadir", "Sakit", "Izin", "Persentase"],
        ...rankingData.map((item, index) => [
          String(index + 1),
          item.nama,
          item.kelas,
          String(item.hadir),
          String(item.sakit),
          String(item.izin),
          `${item.persentase.toFixed(1)}%`,
        ]),
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
      link.download = `laporan-kehadiran-${start}-sampai-${end}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DashboardLayout title="Laporan Kehadiran" subtitle="Visualisasi dan analisis data kehadiran siswa">
      <div className="space-y-6">
        {/* Filters */}
        <Card className="border-0 shadow-card">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">Filter:</span>
              </div>
              <Select value={filterMinggu} onValueChange={setFilterMinggu}>
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
              <Select value={filterBulan} onValueChange={setFilterBulan}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Bulan" />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((month) => (
                    <SelectItem key={month.value} value={month.value}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterSemester} onValueChange={setFilterSemester}>
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
              <Select value={filterTahunAjaran} onValueChange={setFilterTahunAjaran}>
                <SelectTrigger className="w-[140px]">
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
              <Button
                variant="gradient"
                size="sm"
                className="ml-auto gap-2"
                onClick={handleExport}
                disabled={isExporting}
              >
                {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Export
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-0 shadow-card">
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 rounded-full gradient-primary mx-auto flex items-center justify-center mb-4">
                <TrendingUp className="w-8 h-8 text-primary-foreground" />
              </div>
              <p className="text-4xl font-bold text-foreground mb-1">
                {isLoading ? "-" : formatPercent(summary.averageAttendance)}
              </p>
              <p className="text-sm text-muted-foreground">Rata-rata Kehadiran</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-card">
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-success/10 mx-auto flex items-center justify-center mb-4">
                <BarChart3 className="w-8 h-8 text-success" />
              </div>
              <p className="text-4xl font-bold text-success mb-1">
                {isLoading ? "-" : summary.totalStudents}
              </p>
              <p className="text-sm text-muted-foreground">Total Siswa Aktif</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-card">
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-accent/30 mx-auto flex items-center justify-center mb-4">
                <Medal className="w-8 h-8 text-accent-foreground" />
              </div>
              <p className="text-4xl font-bold text-foreground mb-1">
                {isLoading ? "-" : summary.perfectAttendance}
              </p>
              <p className="text-sm text-muted-foreground">Kehadiran Sempurna</p>
            </CardContent>
          </Card>
        </div>

        {/* Chart */}
        <Card className="border-0 shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Grafik Kehadiran Bulanan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-end justify-between gap-4 px-4">
              {chartData.length === 0 && !isLoading && (
                <p className="text-sm text-muted-foreground">Belum ada data di periode ini.</p>
              )}
              {chartData.map((data) => (
                <div key={data.bulan} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full flex flex-col gap-1" style={{ height: "200px" }}>
                    <div 
                      className="w-full bg-success rounded-t transition-all"
                      style={{ height: `${data.hadir * 2}px` }}
                      title={`Hadir: ${data.hadir.toFixed(1)}%`}
                    />
                    <div 
                      className="w-full bg-destructive transition-all"
                      style={{ height: `${data.sakit * 8}px` }}
                      title={`Sakit: ${data.sakit.toFixed(1)}%`}
                    />
                    <div 
                      className="w-full bg-warning rounded-b transition-all"
                      style={{ height: `${data.izin * 8}px` }}
                      title={`Izin: ${data.izin.toFixed(1)}%`}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground font-medium">{data.bulan}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-center gap-6 mt-6">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-success" />
                <span className="text-sm text-muted-foreground">Hadir</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-destructive" />
                <span className="text-sm text-muted-foreground">Sakit</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-warning" />
                <span className="text-sm text-muted-foreground">Izin</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Ranking Table */}
        <Card className="border-0 shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Medal className="w-5 h-5" />
              Ranking Kehadiran Siswa
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {rankingData.length === 0 && !isLoading && (
                <p className="text-sm text-muted-foreground">Belum ada data peringkat di periode ini.</p>
              )}
              {rankingData.map((siswa, index) => (
                <div 
                  key={siswa.id} 
                  className={`flex items-center gap-4 p-4 rounded-xl transition-all hover:shadow-card ${
                    index + 1 <= 3 ? "bg-gradient-to-r from-accent/20 to-transparent" : "bg-muted/50"
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                    index + 1 === 1 ? "gradient-primary text-primary-foreground" :
                    index + 1 === 2 ? "bg-secondary text-secondary-foreground" :
                    index + 1 === 3 ? "bg-accent text-accent-foreground" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-foreground">{siswa.nama}</h4>
                    <p className="text-sm text-muted-foreground">{siswa.kelas}</p>
                  </div>
                  <div className="hidden sm:flex gap-6 text-center">
                    <div>
                      <p className="text-lg font-bold text-success">{siswa.hadir}</p>
                      <p className="text-xs text-muted-foreground">Hadir</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-destructive">{siswa.sakit}</p>
                      <p className="text-xs text-muted-foreground">Sakit</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-warning">{siswa.izin}</p>
                      <p className="text-xs text-muted-foreground">Izin</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-gradient">{siswa.persentase.toFixed(1)}%</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Laporan;
