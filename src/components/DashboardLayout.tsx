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
  Camera
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
const logo = "/logo.png";

const adminMenuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: BookOpen, label: "Kelas", path: "/dashboard/kelas" },
  { icon: GraduationCap, label: "Siswa", path: "/dashboard/siswa" },
  { icon: Camera, label: "Enroll Wajah", path: "/dashboard/enroll-wajah" },
  { icon: Users, label: "Wali Kelas", path: "/dashboard/wali-kelas" },
  { icon: Camera, label: "Kehadiran", path: "/dashboard/kehadiran" },
  { icon: FileText, label: "Laporan", path: "/dashboard/laporan" },
  { icon: ClipboardCheck, label: "Rekap Absensi", path: "/dashboard/rekap" },
  { icon: Calendar, label: "Semester", path: "/dashboard/semester" },
  { icon: Settings, label: "Tahun Ajaran", path: "/dashboard/tahun-ajaran" },
  { icon: UserCog, label: "Super Admin", path: "/dashboard/admin" },
];

const teacherMenuItems = [
  { icon: Camera, label: "Kehadiran", path: "/dashboard/kehadiran" },
  { icon: BookOpen, label: "Kelas", path: "/dashboard/kelas" },
  { icon: GraduationCap, label: "Siswa", path: "/dashboard/siswa" },
  { icon: Camera, label: "Enroll Wajah", path: "/dashboard/enroll-wajah" },
  { icon: Users, label: "Wali Kelas", path: "/dashboard/wali-kelas" },
];

type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "TEACHER";
};

interface DashboardLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

const DashboardLayout = ({ children, title, subtitle }: DashboardLayoutProps) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const router = useRouter();
  const pathname = router.asPath.split("?")[0];

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("auth_user");
    if (!stored) {
      setIsAuthReady(true);
      router.push("/login");
      return;
    }
    try {
      const parsed = JSON.parse(stored) as AuthUser;
      if (!parsed?.role) {
        window.localStorage.removeItem("auth_user");
        setIsAuthReady(true);
        router.push("/login");
        return;
      }
      setCurrentUser(parsed);
    } catch {
      window.localStorage.removeItem("auth_user");
      router.push("/login");
    } finally {
      setIsAuthReady(true);
    }
  }, [router]);

  const menuItems = useMemo(() => {
    if (currentUser?.role === "TEACHER") return teacherMenuItems;
    return adminMenuItems;
  }, [currentUser?.role]);

  useEffect(() => {
    if (!isAuthReady || !currentUser) return;
    if (currentUser.role === "TEACHER") {
      const allowedPaths = teacherMenuItems.map((item) => item.path);
      if (!allowedPaths.includes(pathname)) {
        router.push("/dashboard/kehadiran");
      }
    }
  }, [currentUser, isAuthReady, pathname, router]);

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("auth_user");
    }
    router.push("/");
  };

  const isActive = (path: string) => pathname === path;

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Memuat...
      </div>
    );
  }

  const userInitial = currentUser?.name?.charAt(0).toUpperCase() ?? "A";
  const roleLabel = currentUser?.role === "TEACHER" ? "Guru" : "Super Admin";

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
                isActive(item.path)
                  ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              }`}
            >
              <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive(item.path) ? "text-sidebar-primary" : ""}`} />
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
                <h1 className="text-xl font-bold text-foreground">{title}</h1>
                {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
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
                  {userInitial}
                </div>
                <div className="hidden sm:block">
                  <p className="text-sm font-medium text-foreground">{currentUser?.name ?? "Admin"}</p>
                  <p className="text-xs text-muted-foreground">{roleLabel}</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
