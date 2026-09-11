"use client";

import { useState, useEffect } from "react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/modal";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";
import { Plus, Trash2, Save } from "lucide-react";

interface Subject {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
}

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({ name: "", description: "" });

  // Edit modal
  const [editSubject, setEditSubject] = useState<Subject | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);

  useEffect(() => {
    loadSubjects();
  }, []);

  const loadSubjects = async () => {
    setLoading(true);
    try {
      setSubjects(await apiGet<Subject[]>("/subjects"));
    } catch (error) {
      console.error("Failed to load subjects:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiPost("/subjects", formData);
      setFormData({ name: "", description: "" });
      setIsModalOpen(false);
      loadSubjects();
    } catch (error) {
      console.error("Failed to create subject:", error);
      alert("Не удалось создать предмет");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Удалить предмет «${name}»?`)) return;
    try {
      await apiDelete(`/subjects/${id}`);
      loadSubjects();
    } catch (error) {
      console.error("Failed to delete subject:", error);
      alert("Не удалось удалить предмет");
    }
  };

  const openEdit = (subject: Subject) => {
    setEditSubject(subject);
    setEditName(subject.name);
    setEditDescription(subject.description || "");
    setEditActive(subject.isActive);
  };

  const handleSaveEdit = async () => {
    if (!editSubject) return;
    setSaveLoading(true);
    try {
      await apiPatch(`/subjects/${editSubject.id}`, {
        name: editName,
        description: editDescription || undefined,
        isActive: editActive
      });
      setEditSubject(null);
      loadSubjects();
    } catch (error) {
      console.error("Failed to update subject:", error);
      alert("Не удалось обновить предмет");
    } finally {
      setSaveLoading(false);
    }
  };

  return (
    <AppShell allowedRoles={["ADMIN"]}>
      <div className="flex items-start justify-between gap-4">
        <PageHeader title="Предметы" description="Математика, английский и другие направления." />
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus size={18} />
          New subject
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-slate-500">Загрузка...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50">
                <th className="px-4 py-3 text-left font-medium text-slate-600">Name</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Description</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Status</th>
                <th className="px-4 py-3 text-right font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((s) => (
                <tr key={s.id} className="border-b hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <button onClick={() => openEdit(s)} className="font-medium text-blue-600 hover:underline text-left">
                      {s.name}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{s.description || "-"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${s.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}
                    >
                      {s.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(s.id, s.name)}
                      className="p-1.5 rounded hover:bg-red-50 text-red-500"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Subject Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add Subject" footer={null}>
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="English"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <Input
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="General English course"
            />
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Create</Button>
          </div>
        </form>
      </Modal>

      {/* Edit Subject Modal */}
      <Modal
        isOpen={!!editSubject}
        onClose={() => setEditSubject(null)}
        title={`Edit: ${editSubject?.name || ""}`}
        footer={null}
      >
        {editSubject && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <Input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
            </div>
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editActive}
                  onChange={(e) => setEditActive(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm text-slate-700">Active</span>
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setEditSubject(null)}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdit} disabled={saveLoading}>
                <Save size={16} className="mr-1" />
                {saveLoading ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </AppShell>
  );
}
