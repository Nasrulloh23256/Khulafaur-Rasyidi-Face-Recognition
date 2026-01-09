import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  Eye,
  Pencil,
  Trash2,
  Filter,
  MoreHorizontal,
  GraduationCap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import DashboardLayout from "@/components/DashboardLayout";
import { useToast } from "@/hooks/use-toast";

type ClassItem = {
  id: string;
  name: string;
};

type StudentItem = {
  id: string;
  studentNumber: string | null;
  fullName: string;
  gender: "MALE" | "FEMALE";
  guardianName: string | null;
  classId: string | null;
  faceImageUrl: string | null;
  class: ClassItem | null;
};

const formatGender = (gender: StudentItem["gender"]) => (gender === "MALE" ? "Laki-laki" : "Perempuan");

const Siswa = () => {
  const { toast } = useToast();
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterKelas, setFilterKelas] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StudentItem | null>(null);
  const [editTarget, setEditTarget] = useState<StudentItem | null>(null);
  const [form, setForm] = useState({
    studentNumber: "",
    fullName: "",
    classId: "",
    gender: "",
    guardianName: "",
  });
  const [editForm, setEditForm] = useState({
    studentNumber: "",
    fullName: "",
    classId: "",
    gender: "" as StudentItem["gender"] | "",
    guardianName: "",
  });

  const sortedClasses = useMemo(
    () => [...classes].sort((a, b) => a.name.localeCompare(b.name)),
    [classes],
  );

  const filteredSiswa = useMemo(() => {
    if (!searchQuery && filterKelas === "all") return students;
    const query = searchQuery.toLowerCase();
    return students.filter((siswa) => {
      const className = siswa.class?.name?.toLowerCase() ?? "";
      const matchesSearch =
        siswa.fullName.toLowerCase().includes(query) ||
        (siswa.studentNumber ?? "").toLowerCase().includes(query) ||
        className.includes(query);
      const matchesKelas =
        filterKelas === "all" ||
        (filterKelas === "unassigned" && !siswa.classId) ||
        siswa.classId === filterKelas;
      return matchesSearch && matchesKelas;
    });
  }, [students, searchQuery, filterKelas]);

  const stats = useMemo(() => {
    const total = students.length;
    const male = students.filter((item) => item.gender === "MALE").length;
    const female = students.filter((item) => item.gender === "FEMALE").length;
    const activeClasses = new Set(students.map((item) => item.classId).filter(Boolean)).size;
    return { total, male, female, activeClasses };
  }, [students]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [studentRes, classRes] = await Promise.all([fetch("/api/students"), fetch("/api/classes")]);
      const studentData = await studentRes.json();
      const classData = await classRes.json();

      if (studentRes.ok) setStudents(studentData);
      if (classRes.ok) setClasses(classData);
    } catch (error) {
      toast({
        title: "Gagal memuat data",
        description: "Tidak bisa mengambil data siswa",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDialogOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setForm({
        studentNumber: "",
        fullName: "",
        classId: "",
        gender: "",
        guardianName: "",
      });
    }
  };

  const handleEditOpenChange = (open: boolean) => {
    setIsEditOpen(open);
    if (!open) {
      setEditTarget(null);
      setEditForm({
        studentNumber: "",
        fullName: "",
        classId: "",
        gender: "",
        guardianName: "",
      });
    }
  };

  const openEditDialog = (siswa: StudentItem) => {
    setEditTarget(siswa);
    setEditForm({
      studentNumber: siswa.studentNumber ?? "",
      fullName: siswa.fullName,
      classId: siswa.classId ?? "",
      gender: siswa.gender,
      guardianName: siswa.guardianName ?? "",
    });
    setIsEditOpen(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!form.fullName || !form.gender || !form.classId) {
      toast({
        title: "Data belum lengkap",
        description: "Nama siswa, kelas, dan jenis kelamin wajib diisi",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        studentNumber: form.studentNumber,
        fullName: form.fullName,
        classId: form.classId,
        gender: form.gender,
        guardianName: form.guardianName,
      };

      const response = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const responsePayload = await response.json();

      if (!response.ok) {
        const message =
          responsePayload?.detail && responsePayload?.error
            ? `${responsePayload.error}: ${responsePayload.detail}`
            : responsePayload?.detail ?? responsePayload?.error ?? "Terjadi kesalahan";
        toast({
          title: "Gagal menyimpan",
          description: message,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Berhasil",
        description: "Siswa berhasil ditambahkan",
      });

      handleDialogOpenChange(false);
      loadData();
    } catch (error) {
      toast({
        title: "Gagal menyimpan",
        description: "Tidak bisa terhubung ke server",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editTarget) return;

    if (!editForm.fullName || !editForm.gender) {
      toast({
        title: "Data belum lengkap",
        description: "Nama siswa dan jenis kelamin wajib diisi",
        variant: "destructive",
      });
      return;
    }

    setIsUpdating(true);
    try {
      const payload = {
        studentNumber: editForm.studentNumber,
        fullName: editForm.fullName,
        gender: editForm.gender,
        guardianName: editForm.guardianName,
        ...(editForm.classId ? { classId: editForm.classId } : {}),
      };

      const response = await fetch(`/api/students/${editTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const responsePayload = await response.json();

      if (!response.ok) {
        const message =
          responsePayload?.detail && responsePayload?.error
            ? `${responsePayload.error}: ${responsePayload.detail}`
            : responsePayload?.detail ?? responsePayload?.error ?? "Terjadi kesalahan";
        toast({
          title: "Gagal memperbarui",
          description: message,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Berhasil",
        description: "Data siswa berhasil diperbarui",
      });

      handleEditOpenChange(false);
      loadData();
    } catch (error) {
      toast({
        title: "Gagal memperbarui",
        description: "Tidak bisa terhubung ke server",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/students/${deleteTarget.id}`, { method: "DELETE" });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const message =
          payload?.detail && payload?.error
            ? `${payload.error}: ${payload.detail}`
            : payload?.detail ?? payload?.error ?? "Terjadi kesalahan";
        toast({
          title: "Gagal menghapus",
          description: message,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Berhasil",
        description: "Siswa berhasil dihapus",
      });
      setDeleteTarget(null);
      loadData();
    } catch (error) {
      toast({
        title: "Gagal menghapus",
        description: "Tidak bisa terhubung ke server",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <DashboardLayout title="Manajemen Siswa" subtitle="Kelola data siswa TK Khulafaur Arrasyidin">
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex flex-col lg:flex-row gap-4 justify-between">
          <div className="flex flex-col sm:flex-row gap-4 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Cari nama atau NIS..." 
                className="pl-10"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>
            <Select value={filterKelas} onValueChange={setFilterKelas}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filter Kelas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kelas</SelectItem>
                <SelectItem value="unassigned">Belum ada kelas</SelectItem>
                {sortedClasses.map((kelas) => (
                  <SelectItem key={kelas.id} value={kelas.id}>
                    {kelas.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
            <DialogTrigger asChild>
              <Button variant="gradient">
                <Plus className="w-4 h-4" />
                Tambah Siswa
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Tambah Siswa Baru</DialogTitle>
                <DialogDescription>
                  Masukkan data siswa baru di bawah ini.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="nis">NIS</Label>
                  <Input
                    id="nis"
                    placeholder="Nomor Induk Siswa"
                    value={form.studentNumber}
                    onChange={(event) => setForm((prev) => ({ ...prev, studentNumber: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nama">Nama Lengkap</Label>
                  <Input
                    id="nama"
                    placeholder="Nama lengkap siswa"
                    value={form.fullName}
                    onChange={(event) => setForm((prev) => ({ ...prev, fullName: event.target.value }))}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="kelas">Kelas</Label>
                    <Select
                      value={form.classId}
                      onValueChange={(value) => setForm((prev) => ({ ...prev, classId: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih kelas" />
                      </SelectTrigger>
                      <SelectContent>
                        {sortedClasses.length === 0 ? (
                          <SelectItem value="empty" disabled>
                            Belum ada kelas terdaftar
                          </SelectItem>
                        ) : (
                          sortedClasses.map((kelas) => (
                            <SelectItem key={kelas.id} value={kelas.id}>
                              {kelas.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="jenisKelamin">Jenis Kelamin</Label>
                    <Select
                      value={form.gender}
                      onValueChange={(value) => setForm((prev) => ({ ...prev, gender: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MALE">Laki-laki</SelectItem>
                        <SelectItem value="FEMALE">Perempuan</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="orangTua">Nama Orang Tua</Label>
                  <Input
                    id="orangTua"
                    placeholder="Nama orang tua/wali"
                    value={form.guardianName}
                    onChange={(event) => setForm((prev) => ({ ...prev, guardianName: event.target.value }))}
                  />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => handleDialogOpenChange(false)}>
                    Batal
                  </Button>
                  <Button type="submit" variant="gradient" disabled={isSaving}>
                    {isSaving ? "Menyimpan..." : "Simpan"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Card className="border-0 shadow-card">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center">
                <GraduationCap className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Total Siswa</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-card">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-info/10 flex items-center justify-center">
                <GraduationCap className="w-6 h-6 text-info" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {stats.male}
                </p>
                <p className="text-sm text-muted-foreground">Laki-laki</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-card">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-secondary/20 flex items-center justify-center">
                <GraduationCap className="w-6 h-6 text-secondary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {stats.female}
                </p>
                <p className="text-sm text-muted-foreground">Perempuan</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-card">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-accent/30 flex items-center justify-center">
                <GraduationCap className="w-6 h-6 text-accent-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.activeClasses}</p>
                <p className="text-sm text-muted-foreground">Kelas Aktif</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card className="border-0 shadow-card">
          <CardHeader>
            <CardTitle>Daftar Siswa</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No</TableHead>
                  <TableHead>NIS</TableHead>
                  <TableHead>Nama Siswa</TableHead>
                  <TableHead>Kelas</TableHead>
                  <TableHead>Jenis Kelamin</TableHead>
                  <TableHead>Orang Tua</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
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
                {!isLoading && filteredSiswa.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      Belum ada siswa.
                    </TableCell>
                  </TableRow>
                )}
                {filteredSiswa.map((siswa, index) => (
                  <TableRow key={siswa.id}>
                    <TableCell className="font-medium">{index + 1}</TableCell>
                    <TableCell className="font-mono text-sm">{siswa.studentNumber ?? "-"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {siswa.faceImageUrl ? (
                          <img
                            src={siswa.faceImageUrl}
                            alt={`Foto ${siswa.fullName}`}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-semibold text-sm">
                            {siswa.fullName.charAt(0)}
                          </div>
                        )}
                        <span className="font-medium">{siswa.fullName}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          siswa.class?.name ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {siswa.class?.name ?? "Belum ada kelas"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          siswa.gender === "MALE" ? "bg-info/10 text-info" : "bg-secondary/20 text-secondary"
                        }`}
                      >
                        {formatGender(siswa.gender)}
                      </span>
                    </TableCell>
                    <TableCell>{siswa.guardianName ?? "-"}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem className="gap-2" onClick={() => openEditDialog(siswa)}>
                            <Eye className="w-4 h-4" /> Lihat Detail
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2" onClick={() => openEditDialog(siswa)}>
                            <Pencil className="w-4 h-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2 text-destructive" onClick={() => setDeleteTarget(siswa)}>
                            <Trash2 className="w-4 h-4" /> Hapus
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isEditOpen} onOpenChange={handleEditOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Siswa</DialogTitle>
            <DialogDescription>Perbarui data siswa yang dipilih.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-nis">NIS</Label>
              <Input
                id="edit-nis"
                placeholder="Nomor Induk Siswa"
                value={editForm.studentNumber}
                onChange={(event) => setEditForm((prev) => ({ ...prev, studentNumber: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-nama">Nama Lengkap</Label>
              <Input
                id="edit-nama"
                placeholder="Nama lengkap siswa"
                value={editForm.fullName}
                onChange={(event) => setEditForm((prev) => ({ ...prev, fullName: event.target.value }))}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-kelas">Kelas</Label>
                <Select
                  value={editForm.classId}
                  onValueChange={(value) => setEditForm((prev) => ({ ...prev, classId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih kelas" />
                  </SelectTrigger>
                  <SelectContent>
                    {sortedClasses.length === 0 ? (
                      <SelectItem value="empty" disabled>
                        Belum ada kelas terdaftar
                      </SelectItem>
                    ) : (
                      sortedClasses.map((kelas) => (
                        <SelectItem key={kelas.id} value={kelas.id}>
                          {kelas.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-kelamin">Jenis Kelamin</Label>
                <Select
                  value={editForm.gender}
                  onValueChange={(value) => setEditForm((prev) => ({ ...prev, gender: value as StudentItem["gender"] }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MALE">Laki-laki</SelectItem>
                    <SelectItem value="FEMALE">Perempuan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-orangTua">Nama Orang Tua</Label>
              <Input
                id="edit-orangTua"
                placeholder="Nama orang tua/wali"
                value={editForm.guardianName}
                onChange={(event) => setEditForm((prev) => ({ ...prev, guardianName: event.target.value }))}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleEditOpenChange(false)}>
                Batal
              </Button>
              <Button type="submit" variant="gradient" disabled={isUpdating}>
                {isUpdating ? "Menyimpan..." : "Simpan Perubahan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Siswa</AlertDialogTitle>
            <AlertDialogDescription>
              Siswa <span className="font-semibold text-foreground">{deleteTarget?.fullName}</span> akan dihapus
              permanen. Data absensi yang terkait juga ikut terhapus.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTarget(null)}>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Menghapus..." : "Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default Siswa;
