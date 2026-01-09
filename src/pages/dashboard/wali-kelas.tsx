import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Trash2, Users } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
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
import { useToast } from "@/hooks/use-toast";

type Teacher = {
  id: string;
  fullName: string;
  phone: string | null;
  createdAt: string;
  classes: { id: string; name: string }[];
};

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });

const WaliKelasPage = () => {
  const { toast } = useToast();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editTarget, setEditTarget] = useState<Teacher | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Teacher | null>(null);
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
  });
  const [editForm, setEditForm] = useState({
    fullName: "",
    phone: "",
  });

  const stats = useMemo(() => {
    const assigned = teachers.filter((teacher) => teacher.classes.length > 0).length;
    return {
      total: teachers.length,
      assigned,
      unassigned: teachers.length - assigned,
    };
  }, [teachers]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/teachers");
      const teacherData = await response.json();

      if (response.ok) setTeachers(teacherData);
    } catch (error) {
      toast({
        title: "Gagal memuat data",
        description: "Tidak bisa mengambil data wali kelas",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openEditDialog = (teacher: Teacher) => {
    setEditTarget(teacher);
    setEditForm({
      fullName: teacher.fullName,
      phone: teacher.phone ?? "",
    });
    setIsEditOpen(true);
  };

  const handleEditOpenChange = (open: boolean) => {
    setIsEditOpen(open);
    if (!open) {
      setEditTarget(null);
      setEditForm({ fullName: "", phone: "" });
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!form.fullName) {
      toast({
        title: "Data belum lengkap",
        description: "Nama wali kelas wajib diisi",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/teachers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: form.fullName,
          phone: form.phone,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast({
          title: "Gagal menyimpan",
          description: data?.error ?? "Terjadi kesalahan",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Berhasil",
        description: "Data wali kelas berhasil ditambahkan",
      });

      setForm({ fullName: "", phone: "" });
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

    if (!editForm.fullName) {
      toast({
        title: "Data belum lengkap",
        description: "Nama wali kelas wajib diisi",
        variant: "destructive",
      });
      return;
    }

    setIsUpdating(true);
    try {
      const response = await fetch(`/api/teachers/${editTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: editForm.fullName,
          phone: editForm.phone,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast({
          title: "Gagal memperbarui",
          description: data?.error ?? "Terjadi kesalahan",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Berhasil",
        description: "Data wali kelas berhasil diperbarui",
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
      const response = await fetch(`/api/teachers/${deleteTarget.id}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast({
          title: "Gagal menghapus",
          description: data?.error ?? "Terjadi kesalahan",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Berhasil",
        description: "Wali kelas berhasil dihapus",
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
    <DashboardLayout title="Wali Kelas" subtitle="Kelola data wali kelas dan kelasnya">
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row gap-4 justify-between">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full lg:max-w-2xl">
            <Card className="border-0 shadow-card">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
                  <Users className="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Wali</p>
                  <p className="text-xl font-bold text-foreground">{stats.total}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-card">
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Sudah Terpasang</p>
                <p className="text-xl font-bold text-foreground">{stats.assigned}</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-card">
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Belum Ada Kelas</p>
                <p className="text-xl font-bold text-foreground">{stats.unassigned}</p>
              </CardContent>
            </Card>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="gradient">
                <Plus className="w-4 h-4" />
                Tambah Wali Kelas
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Tambah Wali Kelas</DialogTitle>
                <DialogDescription>Masukkan data wali kelas baru.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Nama Lengkap</Label>
                  <Input
                    id="fullName"
                    placeholder="Nama wali kelas"
                    value={form.fullName}
                    onChange={(event) => setForm((prev) => ({ ...prev, fullName: event.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Nomor HP (opsional)</Label>
                  <Input
                    id="phone"
                    placeholder="08xxxxxxxxxx"
                    value={form.phone}
                    onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
                  />
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

        <Card className="border-0 shadow-card">
          <CardHeader>
            <CardTitle>Daftar Wali Kelas</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>Nomor HP</TableHead>
                  <TableHead>Kelas</TableHead>
                  <TableHead>Dibuat</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
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
                {!isLoading && teachers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Belum ada wali kelas.
                    </TableCell>
                  </TableRow>
                )}
                {teachers.map((teacher) => (
                  <TableRow key={teacher.id}>
                    <TableCell className="font-semibold text-foreground">{teacher.fullName}</TableCell>
                    <TableCell>{teacher.phone || "-"}</TableCell>
                    <TableCell>
                      {teacher.classes.length > 0
                        ? teacher.classes.map((item) => item.name).join(", ")
                        : "-"}
                    </TableCell>
                    <TableCell>{formatDate(teacher.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(teacher)}
                          aria-label={`Edit ${teacher.fullName}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteTarget(teacher)}
                          aria-label={`Hapus ${teacher.fullName}`}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Wali Kelas</DialogTitle>
            <DialogDescription>Perbarui data wali kelas yang dipilih.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-fullName">Nama Lengkap</Label>
              <Input
                id="edit-fullName"
                placeholder="Nama wali kelas"
                value={editForm.fullName}
                onChange={(event) => setEditForm((prev) => ({ ...prev, fullName: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-phone">Nomor HP (opsional)</Label>
              <Input
                id="edit-phone"
                placeholder="08xxxxxxxxxx"
                value={editForm.phone}
                onChange={(event) => setEditForm((prev) => ({ ...prev, phone: event.target.value }))}
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
            <AlertDialogTitle>Hapus Wali Kelas</AlertDialogTitle>
            <AlertDialogDescription>
              Wali kelas{" "}
              <span className="font-semibold text-foreground">{deleteTarget?.fullName}</span> akan dihapus. Kelas
              yang terhubung akan menjadi tanpa wali kelas.
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

export default WaliKelasPage;
