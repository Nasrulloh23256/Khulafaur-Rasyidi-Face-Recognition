import { useEffect, useMemo, useState } from "react";
import { 
  LayoutDashboard, 
  Users, 
  GraduationCap, 
  ClipboardCheck, 
  BarChart3, 
  Calendar, 
  Settings, 
  LogOut,
  BookOpen,
  UserCog,
  FileText,
  ChevronLeft,
  ChevronRight,
  Menu,
  Bell,
  Search,
  TrendingUp,
  TrendingDown,
  Camera
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
const logo = "/logo.png";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard", active: true },
  { icon: BookOpen, label: "Kelas", path: "/dashboard/kelas" },
  { icon: GraduationCap, label: "Siswa", path: "/dashboard/siswa" },
  { icon: Users, label: "Wali Kelas", path: "/dashboard/wali-kelas" },
  { icon: Camera, label: "Kehadiran", path: "/dashboard/kehadiran" },
  { icon: FileText, label: "Laporan", path: "/dashboard/laporan" },
  { icon: ClipboardCheck, label: "Rekap Absensi", path: "/dashboard/rekap" },
  { icon: Calendar, label: "Semester", path: "/dashboard/semester" },
  { icon: Settings, label: "Tahun Ajaran", path: "/dashboard/tahun-ajaran" },
  { icon: UserCog, label: "Super Admin", path: "/dashboard/admin" },
];

type StatTrend = "up" | "down" | "neutral";

type StatItem = {
  title: string;
  value: string;
  change: string;
  trend: StatTrend;
  icon: typeof BookOpen;
  color: string;
};

type WeeklyAttendanceItem = {
  label: string;
  present: number;
  total: number;
};

type RecentAttendanceItem = {
  name: string;
  className: string;
  status: string;
  time: string;
};

const initialStatsData: StatItem[] = [
  { 
    title: "Total Kelas", 
    value: "0", 
    change: "0", 
    trend: "neutral",
    icon: BookOpen,
    color: "primary"
  },
  { 
    title: "Wali Kelas", 
    value: "0", 
    change: "0", 
    trend: "neutral",
    icon: Users,
    color: "secondary"
  },
  { 
    title: "Total Siswa", 
    value: "0", 
    change: "0", 
    trend: "neutral",
    icon: GraduationCap,
    color: "success"
  },
  { 
    title: "Admin", 
    value: "0", 
    change: "0", 
    trend: "neutral",
    icon: UserCog,
    color: "warning"
  },
];

const initialWeeklyAttendance: WeeklyAttendanceItem[] = [
  { label: "Sen", present: 0, total: 0 },
  { label: "Sel", present: 0, total: 0 },
  { label: "Rab", present: 0, total: 0 },
  { label: "Kam", present: 0, total: 0 },
  { label: "Jum", present: 0, total: 0 },
  { label: "Sab", present: 0, total: 0 },
];

const Dashboard = () => {
  const { toast } = useToast();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [statsData, setStatsData] = useState<StatItem[]>(initialStatsData);
  const [weeklyAttendance, setWeeklyAttendance] = useState<WeeklyAttendanceItem[]>(initialWeeklyAttendance);
  const [recentAttendance, setRecentAttendance] = useState<RecentAttendanceItem[]>([]);
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);
  const router = useRouter();

  const handleLogout = () => {
    router.push("/");
  };

  const loadSummary = async () => {
    setIsLoadingSummary(true);
    try {
      const response = await fetch("/api/dashboard/summary");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error ?? "Gagal memuat data dashboard");
      }

      setStatsData([
        {
          title: "Total Kelas",
          value: String(data?.stats?.classes?.total ?? 0),
          change: data?.stats?.classes?.change ?? "0",
          trend: data?.stats?.classes?.trend ?? "neutral",
          icon: BookOpen,
          color: "primary",
        },
        {
          title: "Wali Kelas",
          value: String(data?.stats?.teachers?.total ?? 0),
          change: data?.stats?.teachers?.change ?? "0",
          trend: data?.stats?.teachers?.trend ?? "neutral",
          icon: Users,
          color: "secondary",
        },
        {
          title: "Total Siswa",
          value: String(data?.stats?.students?.total ?? 0),
          change: data?.stats?.students?.change ?? "0",
          trend: data?.stats?.students?.trend ?? "neutral",
          icon: GraduationCap,
          color: "success",
        },
        {
          title: "Admin",
          value: String(data?.stats?.admins?.total ?? 0),
          change: data?.stats?.admins?.change ?? "0",
          trend: data?.stats?.admins?.trend ?? "neutral",
          icon: UserCog,
          color: "warning",
        },
      ]);

      setWeeklyAttendance(
        Array.isArray(data?.weeklyAttendance) && data.weeklyAttendance.length > 0
          ? data.weeklyAttendance
          : initialWeeklyAttendance,
      );
      setRecentAttendance(Array.isArray(data?.recentAttendance) ? data.recentAttendance : []);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal memuat data dashboard";
      toast({
        title: "Gagal memuat data",
        description: message,
        variant: "destructive",
      });
      setWeeklyAttendance(initialWeeklyAttendance);
      setRecentAttendance([]);
    } finally {
      setIsLoadingSummary(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, []);

  const chartHeights = useMemo(() => {
    const maxPresent = Math.max(...weeklyAttendance.map((item) => item.present), 0);
    if (maxPresent === 0) return weeklyAttendance.map(() => 0);
    return weeklyAttendance.map((item) => Math.round((item.present / maxPresent) * 100));
  }, [weeklyAttendance]);

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside 
        className={`fixed lg:static inset-y-0 left-0 z-50 flex flex-col gradient-sidebar transition-all duration-300 ${
          sidebarCollapsed ? "w-20" : "w-64"
        } ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        {/* Logo Section */}
        <div className="p-4 flex items-center gap-3 border-b border-sidebar-border">
          <img src={logo} alt="Logo" className="w-12 h-12 object-contain flex-shrink-0" />
          {!sidebarCollapsed && (
            <div className="overflow-hidden">
              <h2 className="font-bold text-sidebar-foreground text-sm leading-tight">
                TK Khulafaur Arrasyidin
              </h2>
              <p className="text-xs text-sidebar-foreground/70">Sistem Absensi</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {menuItems.map((item) => (
            <Link
              key={item.label}
              href={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
                item.active 
                  ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              }`}
            >
              <item.icon className={`w-5 h-5 flex-shrink-0 ${item.active ? "text-sidebar-primary" : ""}`} />
              {!sidebarCollapsed && (
                <span className="text-sm font-medium">{item.label}</span>
              )}
            </Link>
          ))}
        </nav>

        {/* Logout Button */}
        <div className="p-4 border-t border-sidebar-border">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sidebar-foreground/80 hover:bg-destructive/20 hover:text-destructive transition-all duration-200"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {!sidebarCollapsed && <span className="text-sm font-medium">Log Out</span>}
          </button>
        </div>

        {/* Collapse Toggle */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="hidden lg:flex absolute -right-3 top-20 w-6 h-6 rounded-full bg-card shadow-md items-center justify-center text-foreground hover:bg-muted transition-colors"
        >
          {sidebarCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </aside>

      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-foreground/50 z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-card/80 backdrop-blur-md border-b border-border">
          <div className="flex items-center justify-between px-4 lg:px-6 py-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden p-2 rounded-lg hover:bg-muted transition-colors"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-foreground">Dashboard</h1>
                <p className="text-sm text-muted-foreground">Selamat datang di sistem absensi</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden md:flex relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Cari..." 
                  className="pl-10 w-64 bg-muted/50 border-0"
                />
              </div>
              <button className="relative p-2 rounded-lg hover:bg-muted transition-colors">
                <Bell className="w-5 h-5 text-muted-foreground" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full" />
              </button>
              <div className="flex items-center gap-2 pl-3 border-l border-border">
                <div className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-semibold">
                  A
                </div>
                <div className="hidden sm:block">
                  <p className="text-sm font-medium text-foreground">Admin</p>
                  <p className="text-xs text-muted-foreground">Super Admin</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <main className="flex-1 p-4 lg:p-6 space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {statsData.map((stat, index) => (
              <Card key={stat.title} className="border-0 shadow-card hover:shadow-soft transition-all duration-300 animate-fade-in" style={{ animationDelay: `${index * 0.1}s` }}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">{stat.title}</p>
                      <p className="text-3xl font-bold text-foreground">{stat.value}</p>
                      <div className="flex items-center gap-1 mt-2">
                        {stat.trend === "up" && (
                          <>
                            <TrendingUp className="w-4 h-4 text-success" />
                            <span className="text-xs text-success font-medium">{stat.change}</span>
                          </>
                        )}
                        {stat.trend === "down" && (
                          <>
                            <TrendingDown className="w-4 h-4 text-destructive" />
                            <span className="text-xs text-destructive font-medium">{stat.change}</span>
                          </>
                        )}
                        {stat.trend === "neutral" && (
                          <span className="text-xs text-muted-foreground">Tidak ada perubahan</span>
                        )}
                      </div>
                    </div>
                    <div className={`w-12 h-12 rounded-xl gradient-primary flex items-center justify-center`}>
                      <stat.icon className="w-6 h-6 text-primary-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Charts and Recent Activity */}
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Attendance Chart */}
            <Card className="lg:col-span-2 border-0 shadow-card">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-semibold">Statistik Kehadiran Minggu Ini</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-end justify-between gap-2">
                  {weeklyAttendance.map((item, index) => (
                    <div key={`${item.label}-${index}`} className="flex-1 flex flex-col items-center gap-2">
                      <div className="w-full bg-muted rounded-t-lg relative" style={{ height: "200px" }}>
                        <div 
                          className="absolute bottom-0 w-full gradient-primary rounded-t-lg transition-all duration-500"
                          style={{ height: `${chartHeights[index]}%` }}
                          title={`Hadir: ${item.present}`}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground font-medium">{item.label}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Recent Attendance */}
            <Card className="border-0 shadow-card">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold">Absensi Terbaru</CardTitle>
                  <Button asChild variant="ghost" size="sm" className="text-primary">
                    <Link href="/dashboard/kehadiran">Lihat Semua</Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {isLoadingSummary && (
                  <p className="text-sm text-muted-foreground">Memuat data absensi...</p>
                )}
                {!isLoadingSummary && recentAttendance.length === 0 && (
                  <p className="text-sm text-muted-foreground">Belum ada data absensi.</p>
                )}
                {recentAttendance.map((item, index) => (
                  <div 
                    key={`${item.name}-${index}`} 
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-semibold text-sm">
                        {item.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{item.className}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                        item.status === "Hadir" 
                          ? "bg-success/10 text-success" 
                          : item.status === "Izin" 
                            ? "bg-warning/10 text-warning" 
                            : "bg-destructive/10 text-destructive"
                      }`}>
                        {item.status}
                      </span>
                      <p className="text-xs text-muted-foreground mt-1">{item.time}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card className="border-0 shadow-card">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Aksi Cepat</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Button asChild variant="outline" className="w-full h-auto py-4 flex flex-col gap-2">
                  <Link href="/dashboard/kehadiran">
                    <Camera className="w-6 h-6 text-primary" />
                    <span className="text-sm">Mulai Absensi</span>
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full h-auto py-4 flex flex-col gap-2">
                  <Link href="/dashboard/siswa">
                    <GraduationCap className="w-6 h-6 text-primary" />
                    <span className="text-sm">Tambah Siswa</span>
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full h-auto py-4 flex flex-col gap-2">
                  <Link href="/dashboard/kelas">
                    <BookOpen className="w-6 h-6 text-primary" />
                    <span className="text-sm">Kelola Kelas</span>
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full h-auto py-4 flex flex-col gap-2">
                  <Link href="/dashboard/laporan">
                    <BarChart3 className="w-6 h-6 text-primary" />
                    <span className="text-sm">Lihat Laporan</span>
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
