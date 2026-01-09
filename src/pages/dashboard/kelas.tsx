import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import type { CheckedState } from "@radix-ui/react-checkbox";

type AcademicYear = {
  id: string;
  name: string;
};

type Semester = {
  id: string;
  name: "GANJIL" | "GENAP";
  academicYearId: string;
};

type Teacher = {
  id: string;
  fullName: string;
};

type Student = {
  id: string;
  fullName: string;
  studentNumber: string | null;
  gender: "MALE" | "FEMALE";
};

type ClassItem = {
  id: string;
  name: string;
  academicYear: AcademicYear;
  semester: Semester;
  homeroomTeacher: Teacher | null;
  _count: { students: number };
};

const formatSemester = (value: "GANJIL" | "GENAP") => (value === "GANJIL" ? "Ganjil" : "Genap");

const Kelas = () => {
  const { toast } = useToast();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [unassignedStudents, setUnassignedStudents] = useState<Student[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ClassItem | null>(null);
  const [editTarget, setEditTarget] = useState<ClassItem | null>(null);
  const [form, setForm] = useState({
    name: "",
    academicYearId: "",
    semesterId: "",
    homeroomTeacherId: "none",
  });
  const [editForm, setEditForm] = useState({
    homeroomTeacherId: "none",
    studentIds: [] as string[],
  });

  const filteredSemesters = useMemo(
    () => semesters.filter((semester) => semester.academicYearId === form.academicYearId),
    [semesters, form.academicYearId],
  );

  const filteredClasses = useMemo(() => {
    if (!searchQuery) return classes;
    const query = searchQuery.toLowerCase();
    return classes.filter((item) => {
      const teacherName = item.homeroomTeacher?.fullName?.toLowerCase() ?? "";
      return item.name.toLowerCase().includes(query) || teacherName.includes(query);
    });
  }, [classes, searchQuery]);

  const sortedTeachers = useMemo(
    () => [...teachers].sort((a, b) => a.fullName.localeCompare(b.fullName)),
    [teachers],
  );

  const stats = useMemo(() => {
    const totalStudents = classes.reduce((acc, item) => acc + (item._count?.students ?? 0), 0);
    const average = classes.length > 0 ? Math.round(totalStudents / classes.length) : 0;
    return {
      totalClasses: classes.length,
      totalStudents,
      average,
    };
  }, [classes]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [classRes, yearRes, semesterRes, teacherRes] = await Promise.all([
        fetch("/api/classes"),
        fetch("/api/academic-years"),
        fetch("/api/semesters"),
        fetch("/api/teachers"),
      ]);

      const classData = await classRes.json();
      const yearData = await yearRes.json();
      const semesterData = await semesterRes.json();
      const teacherData = await teacherRes.json();

      if (classRes.ok) setClasses(classData);
      if (yearRes.ok) setYears(yearData);
      if (semesterRes.ok) setSemesters(semesterData);
      if (teacherRes.ok) setTeachers(teacherData);
    } catch (error) {
      toast({
        title: "Gagal memuat data",
        description: "Tidak bisa mengambil data kelas",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadUnassignedStudents = async () => {
    setIsLoadingStudents(true);
    try {
      const response = await fetch("/api/students?unassigned=true");
      const data = await response.json();

      if (response.ok) {
        setUnassignedStudents(data);
      } else {
        setUnassignedStudents([]);
        toast({
          title: "Gagal memuat siswa",
          description: data?.error ?? "Terjadi kesalahan",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Gagal memuat siswa",
        description: "Tidak bisa terhubung ke server",
        variant: "destructive",
      });
    } finally {
      setIsLoadingStudents(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!form.academicYearId && years.length > 0) {
      setForm((prev) => ({ ...prev, academicYearId: years[0].id }));
    }
  }, [years, form.academicYearId]);

  useEffect(() => {
    if (filteredSemesters.length === 0) {
      setForm((prev) => ({ ...prev, semesterId: "" }));
      return;
    }
    const hasSelected = filteredSemesters.some((semester) => semester.id === form.semesterId);
    if (!hasSelected) {
      setForm((prev) => ({ ...prev, semesterId: filteredSemesters[0].id }));
    }
  }, [filteredSemesters, form.semesterId]);

  useEffect(() => {
    if (isDialogOpen) {
      loadData();
    }
  }, [isDialogOpen]);

  useEffect(() => {
    if (isEditOpen) {
      loadUnassignedStudents();
    }
  }, [isEditOpen]);

  const openEditDialog = (kelas: ClassItem) => {
    setEditTarget(kelas);
    setEditForm({
      homeroomTeacherId: kelas.homeroomTeacher?.id ?? "none",
      studentIds: [],
    });
    setIsEditOpen(true);
  };

  const handleEditOpenChange = (open: boolean) => {
    setIsEditOpen(open);
    if (!open) {
      setEditTarget(null);
      setEditForm({ homeroomTeacherId: "none", studentIds: [] });
      setUnassignedStudents([]);
    }
  };

  const handleToggleStudent = (studentId: string, checked: CheckedState) => {
    setEditForm((prev) => {
      const selected = new Set(prev.studentIds);
      if (checked === true) {
        selected.add(studentId);
      } else {
        selected.delete(studentId);
      }
      return { ...prev, studentIds: Array.from(selected) };
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!form.name || !form.academicYearId || !form.semesterId) {
      toast({
        title: "Data belum lengkap",
        description: "Nama kelas, tahun ajaran, dan semester wajib diisi",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          academicYearId: form.academicYearId,
          semesterId: form.semesterId,
          homeroomTeacherId: form.homeroomTeacherId === "none" ? null : form.homeroomTeacherId,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        toast({
          title: "Gagal menyimpan",
          description: payload?.error ?? "Terjadi kesalahan",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Berhasil",
        description: "Kelas berhasil ditambahkan",
      });

      setForm((prev) => ({ ...prev, name: "", homeroomTeacherId: "none" }));
      setIsDialogOpen(false);
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

    setIsUpdating(true);
    try {
      const response = await fetch(`/api/classes/${editTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          homeroomTeacherId: editForm.homeroomTeacherId === "none" ? null : editForm.homeroomTeacherId,
          studentIds: editForm.studentIds,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        toast({
          title: "Gagal memperbarui kelas",
          description: payload?.error ?? "Terjadi kesalahan",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Berhasil",
        description: "Kelas berhasil diperbarui",
      });
      handleEditOpenChange(false);
      loadData();
    } catch (error) {
      toast({
        title: "Gagal memperbarui kelas",
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
      const response = await fetch(`/api/classes/${deleteTarget.id}`, { method: "DELETE" });
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
        description: "Kelas berhasil dihapus",
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
    <DashboardLayout title="Manajemen Kelas" subtitle="Kelola data kelas dan wali kelas">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Cari kelas atau wali kelas..."
              className="pl-10"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="gradient">
                <Plus className="w-4 h-4" />
                Tambah Kelas
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Tambah Kelas Baru</DialogTitle>
                <DialogDescription>Masukkan informasi kelas baru di bawah ini.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nama Kelas</Label>
                  <Input
                    id="name"
                    placeholder="Contoh: TK A1"
                    value={form.name}
                    onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tahun Ajaran</Label>
                  <Select
                    value={form.academicYearId}
                    onValueChange={(value) => setForm((prev) => ({ ...prev, academicYearId: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih tahun ajaran" />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map((year) => (
                        <SelectItem key={year.id} value={year.id}>
                          {year.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Semester</Label>
                  <Select
                    value={form.semesterId}
                    onValueChange={(value) => setForm((prev) => ({ ...prev, semesterId: value }))}
                  >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih semester" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredSemesters.length === 0 ? (
                      <SelectItem value="empty" disabled>
                        Belum ada semester
                      </SelectItem>
                    ) : (
                      filteredSemesters.map((semester) => (
                        <SelectItem key={semester.id} value={semester.id}>
                          {formatSemester(semester.name)}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
                <div className="space-y-2">
                  <Label>Wali Kelas (opsional)</Label>
                  <Select
                    value={form.homeroomTeacherId}
                    onValueChange={(value) => setForm((prev) => ({ ...prev, homeroomTeacherId: value }))}
                  >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih wali kelas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Belum ditentukan</SelectItem>
                    {sortedTeachers.length === 0 ? (
                      <SelectItem value="empty" disabled>
                        Belum ada wali kelas
                      </SelectItem>
                    ) : (
                      sortedTeachers.map((teacher) => (
                        <SelectItem key={teacher.id} value={teacher.id}>
                          {teacher.fullName}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
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

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-0 shadow-card">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center">
                <Users className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.totalClasses}</p>
                <p className="text-sm text-muted-foreground">Total Kelas</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-card">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center">
                <Users className="w-6 h-6 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.totalStudents}</p>
                <p className="text-sm text-muted-foreground">Total Siswa</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-card">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-accent/30 flex items-center justify-center">
                <Users className="w-6 h-6 text-accent-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.average}</p>
                <p className="text-sm text-muted-foreground">Rata-rata/Kelas</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-0 shadow-card">
          <CardHeader>
            <CardTitle>Daftar Kelas</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No</TableHead>
                  <TableHead>Nama Kelas</TableHead>
                  <TableHead>Wali Kelas</TableHead>
                  <TableHead>Tahun Ajaran</TableHead>
                  <TableHead>Semester</TableHead>
                  <TableHead className="text-center">Total Siswa</TableHead>
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
                {!isLoading && filteredClasses.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      Belum ada kelas.
                    </TableCell>
                  </TableRow>
                )}
                {filteredClasses.map((kelas, index) => (
                  <TableRow key={kelas.id}>
                    <TableCell className="font-medium">{index + 1}</TableCell>
                    <TableCell className="font-semibold text-foreground">{kelas.name}</TableCell>
                    <TableCell>{kelas.homeroomTeacher?.fullName ?? "-"}</TableCell>
                    <TableCell>{kelas.academicYear?.name ?? "-"}</TableCell>
                    <TableCell>
                      <Badge className="border-transparent bg-primary/10 text-primary">
                        {formatSemester(kelas.semester.name)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-muted text-foreground font-semibold text-sm">
                        {kelas._count?.students ?? 0}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(kelas)}
                          aria-label={`Edit kelas ${kelas.name}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteTarget(kelas)}
                          aria-label={`Hapus kelas ${kelas.name}`}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isEditOpen} onOpenChange={handleEditOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Kelas</DialogTitle>
            <DialogDescription>
              Atur wali kelas dan tambahkan siswa baru untuk {editTarget?.name ?? "kelas ini"}.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nama Kelas</Label>
              <Input value={editTarget?.name ?? ""} disabled />
            </div>
            <div className="space-y-2">
              <Label>Wali Kelas</Label>
              <Select
                value={editForm.homeroomTeacherId}
                onValueChange={(value) => setEditForm((prev) => ({ ...prev, homeroomTeacherId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih wali kelas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Belum ditentukan</SelectItem>
                  {sortedTeachers.length === 0 ? (
                    <SelectItem value="empty" disabled>
                      Belum ada wali kelas
                    </SelectItem>
                  ) : (
                    sortedTeachers.map((teacher) => (
                      <SelectItem key={teacher.id} value={teacher.id}>
                        {teacher.fullName}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tambah Siswa (belum punya kelas)</Label>
              <ScrollArea className="h-56 rounded-md border">
                <div className="space-y-2 p-2">
                  {isLoadingStudents ? (
                    <p className="text-sm text-muted-foreground px-2 py-1">Memuat data siswa...</p>
                  ) : unassignedStudents.length === 0 ? (
                    <p className="text-sm text-muted-foreground px-2 py-1">
                      Semua siswa sudah memiliki kelas.
                    </p>
                  ) : (
                    unassignedStudents.map((student) => (
                      <label
                        key={student.id}
                        className="flex items-start gap-3 rounded-md px-2 py-2 hover:bg-muted/50"
                      >
                        <Checkbox
                          checked={editForm.studentIds.includes(student.id)}
                          onCheckedChange={(checked) => handleToggleStudent(student.id, checked)}
                        />
                        <div className="space-y-1">
                          <p className="text-sm font-medium leading-none">{student.fullName}</p>
                          <p className="text-xs text-muted-foreground">
                            {student.studentNumber ? `NIS: ${student.studentNumber}` : "NIS belum ada"} -{" "}
                            {student.gender === "MALE" ? "Laki-laki" : "Perempuan"}
                          </p>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </ScrollArea>
              <p className="text-xs text-muted-foreground">Dipilih: {editForm.studentIds.length} siswa.</p>
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
            <AlertDialogTitle>Hapus Kelas</AlertDialogTitle>
            <AlertDialogDescription>
              Kelas{" "}
              <span className="font-semibold text-foreground">{deleteTarget?.name}</span> akan dihapus. Siswa
              tetap tersimpan, tetapi tidak memiliki kelas.
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

export default Kelas;
