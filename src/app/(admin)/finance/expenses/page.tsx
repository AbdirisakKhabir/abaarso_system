"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import Badge from "@/components/ui/badge/Badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TablePagination,
  TableRow,
} from "@/components/ui/table";
import { usePagination } from "@/hooks/usePagination";
import { authFetch } from "@/lib/api";
import { ModalOverlayGate } from "@/context/ModalOverlayContext";
import { useAuth } from "@/context/AuthContext";
import { useFormDraft } from "@/hooks/useFormDraft";
import { ChevronLeft, FolderOpen, Pencil, Plus, Trash2 } from "lucide-react";

type ExpenseCategory = {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
};

type Expense = {
  id: number;
  amount: number;
  description: string;
  category: string | null;
  status: string;
  requestedBy: { id: number; name: string | null; email: string };
  approvedBy: { id: number; name: string | null; email: string } | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  bank: { id: number; name: string; code: string } | null;
  createdAt: string;
};

type Bank = { id: number; name: string; code: string; balance: number };

const STATUS_COLOR: Record<string, "warning" | "success" | "error"> = {
  pending: "warning",
  approved: "success",
  rejected: "error",
};

const CURRENT_YEAR = new Date().getFullYear();

type ExpenseDraft = {
  formAmount: string;
  formDescription: string;
  formCategoryId: string;
  formBankId: string;
};

const expenseDraftInitial: ExpenseDraft = {
  formAmount: "",
  formDescription: "",
  formCategoryId: "",
  formBankId: "",
};

export default function ExpensesPage() {
  const { hasPermission } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [yearFilter, setYearFilter] = useState(String(CURRENT_YEAR));
  const [modal, setModal] = useState<"add" | "reject" | "category" | null>(null);
  const [rejectExpenseId, setRejectExpenseId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const {
    values: draft,
    setField: setDraftField,
    clearDraft,
    discardDraft,
    hasDraft,
  } = useFormDraft<ExpenseDraft>("expense-request", expenseDraftInitial);

  const formAmount = draft.formAmount;
  const formDescription = draft.formDescription;
  const formCategoryId = draft.formCategoryId;
  const formBankId = draft.formBankId;
  const setFormAmount = (v: string) => setDraftField("formAmount", v);
  const setFormDescription = (v: string) => setDraftField("formDescription", v);
  const setFormCategoryId = (v: string) => setDraftField("formCategoryId", v);
  const setFormBankId = (v: string) => setDraftField("formBankId", v);

  const [formError, setFormError] = useState("");
  const [formSubmitting, setFormSubmitting] = useState(false);

  const [editingCategory, setEditingCategory] = useState<ExpenseCategory | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [categoryDescription, setCategoryDescription] = useState("");
  const [categoryError, setCategoryError] = useState("");
  const [categorySubmitting, setCategorySubmitting] = useState(false);

  const canCreate = hasPermission("expenses.create");
  const canApprove = hasPermission("expenses.approve");
  const canView = hasPermission("expenses.view") || canCreate || canApprove;

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (yearFilter) params.set("year", yearFilter);
      const res = await authFetch(`/api/expenses?${params}`);
      if (res.ok) setExpenses(await res.json());
    } catch { /* empty */ }
    setLoading(false);
  }, [statusFilter, yearFilter]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  useEffect(() => {
    authFetch("/api/banks").then((r) => {
      if (r.ok) r.json().then((d: Bank[]) => {
        setBanks(d);
        if (d.length > 0 && !formBankId) setFormBankId(String(d[0].id));
      });
    });
    authFetch("/api/expense-categories").then((r) => {
      if (r.ok) r.json().then((d: ExpenseCategory[]) => setCategories(d));
    });
  }, []);

  const loadCategories = useCallback(async () => {
    const res = await authFetch("/api/expense-categories?active=false");
    if (res.ok) setCategories(await res.json());
  }, []);

  const openCategoryModal = (cat?: ExpenseCategory) => {
    setEditingCategory(cat ?? null);
    setCategoryName(cat?.name ?? "");
    setCategoryDescription(cat?.description ?? "");
    setCategoryError("");
    setModal("category");
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setCategoryError("");
    setCategorySubmitting(true);
    try {
      const url = editingCategory
        ? `/api/expense-categories/${editingCategory.id}`
        : "/api/expense-categories";
      const method = editingCategory ? "PATCH" : "POST";
      const res = await authFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: categoryName.trim(),
          description: categoryDescription.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCategoryError(data.error || "Failed to save category");
        return;
      }
      await loadCategories();
      setModal(null);
    } finally {
      setCategorySubmitting(false);
    }
  };

  const handleDeleteCategory = async (id: number) => {
    if (!confirm("Remove this category?")) return;
    const res = await authFetch(`/api/expense-categories/${id}`, { method: "DELETE" });
    if (res.ok) await loadCategories();
    else {
      const data = await res.json();
      alert(data.error || "Failed to delete");
    }
  };

  const handleToggleCategory = async (cat: ExpenseCategory) => {
    const res = await authFetch(`/api/expense-categories/${cat.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !cat.isActive }),
    });
    if (res.ok) await loadCategories();
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormSubmitting(true);
    try {
      const res = await authFetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(formAmount),
          description: formDescription.trim(),
          categoryId: formCategoryId ? Number(formCategoryId) : undefined,
          bankId: formBankId ? Number(formBankId) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "Failed to create expense");
        return;
      }
      await fetchExpenses();
      setModal(null);
      clearDraft();
    } catch {
      setFormError("Network error");
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleApprove = async (id: number) => {
    try {
      const res = await authFetch(`/api/expenses/${id}/approve`, { method: "PATCH" });
      if (res.ok) await fetchExpenses();
      else {
        const data = await res.json();
        alert(data.error || "Failed to approve");
      }
    } catch {
      alert("Network error");
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectExpenseId) return;
    try {
      const res = await authFetch(`/api/expenses/${rejectExpenseId}/reject`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rejectionReason: rejectReason.trim() || undefined }),
      });
      if (res.ok) {
        await fetchExpenses();
        setModal(null);
        setRejectExpenseId(null);
        setRejectReason("");
      } else {
        const data = await res.json();
        alert(data.error || "Failed to reject");
      }
    } catch {
      alert("Network error");
    }
  };

  const openRejectModal = (id: number) => {
    setRejectExpenseId(id);
    setRejectReason("");
    setModal("reject");
  };

  const {
    paginatedItems: paginatedExpenses,
    page,
    setPage,
    pageSize,
    setPageSize,
    totalPages,
    total: expensesTotal,
    from,
    to,
  } = usePagination(expenses, [statusFilter, yearFilter]);

  if (!canView) {
    return (
      <div>
        <PageBreadCrumb pageTitle="Expenses" />
        <p className="text-gray-500 dark:text-gray-400">You do not have permission to view expenses.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <PageBreadCrumb pageTitle="Expenses" />
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/finance">
            <Button variant="outline" size="sm" startIcon={<ChevronLeft className="h-4 w-4" />}>
              Back to Finance
            </Button>
          </Link>
          {canApprove && (
            <Button size="sm" variant="outline" startIcon={<FolderOpen className="h-4 w-4" />} onClick={() => openCategoryModal()}>
              Categories
            </Button>
          )}
          {canCreate && (
            <Button size="sm" startIcon={<Plus className="h-4 w-4" />} onClick={() => setModal("add")}>
              Request Expense
            </Button>
          )}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 rounded-lg border border-gray-200 px-3 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <select
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
          className="h-10 rounded-lg border border-gray-200 px-3 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
        >
          {[CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      <div className="min-w-0 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/5">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-brand-500" />
          </div>
        ) : (
          <>
          <Table>
            <TableHeader>
              <TableRow className="bg-transparent! hover:bg-transparent!">
                <TableCell isHeader>Date</TableCell>
                <TableCell isHeader>Description</TableCell>
                <TableCell isHeader>Category</TableCell>
                <TableCell isHeader>Bank</TableCell>
                <TableCell isHeader className="text-right">Amount</TableCell>
                <TableCell isHeader>Requested By</TableCell>
                <TableCell isHeader>Status</TableCell>
                {canApprove && <TableCell isHeader className="text-right">Actions</TableCell>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canApprove ? 8 : 7} className="py-12 text-center text-gray-500">
                    No expenses found.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedExpenses.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{new Date(e.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="max-w-[200px] truncate" title={e.description}>{e.description}</div>
                      {e.rejectionReason && (
                        <p className="mt-1 text-xs text-red-600 dark:text-red-400" title={e.rejectionReason}>
                          Reason: {e.rejectionReason}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>{e.category || "—"}</TableCell>
                    <TableCell>{e.bank ? `${e.bank.code} - ${e.bank.name}` : "—"}</TableCell>
                    <TableCell className="text-right font-semibold text-red-600 dark:text-red-400">
                      ${e.amount.toLocaleString()}
                    </TableCell>
                    <TableCell>{e.requestedBy?.name || e.requestedBy?.email || "—"}</TableCell>
                    <TableCell>
                      <Badge color={STATUS_COLOR[e.status] || "info"} size="sm">
                        {e.status}
                      </Badge>
                    </TableCell>
                    {canApprove && (
                      <TableCell className="text-right">
                        {e.status === "pending" && (
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" onClick={() => openRejectModal(e.id)}>
                              Reject
                            </Button>
                            <Button size="sm" onClick={() => handleApprove(e.id)}>
                              Approve
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <TablePagination
            page={page}
            totalPages={totalPages}
            total={expensesTotal}
            from={from}
            to={to}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
          </>
        )}
      </div>

      {/* Add Expense Modal */}
      {modal === "add" && (
        <ModalOverlayGate>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 dark:bg-gray-800">
            <h3 className="mb-4 text-lg font-semibold">Request Expense</h3>
            {hasDraft && (
              <div className="mb-4 flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
                <span>Draft restored from your last session.</span>
                <button type="button" onClick={discardDraft} className="font-medium underline">
                  Discard
                </button>
              </div>
            )}
            <form onSubmit={handleCreate} className="space-y-4">
              {formError && <p className="text-sm text-red-600">{formError}</p>}
              <div>
                <label className="mb-1 block text-sm font-medium">Amount ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Description</label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Category</label>
                <select
                  value={formCategoryId}
                  onChange={(e) => setFormCategoryId(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                >
                  <option value="">— Select category —</option>
                  {categories.filter((c) => c.isActive).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Bank (optional)</label>
                <select
                  value={formBankId}
                  onChange={(e) => setFormBankId(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                >
                  <option value="">— Select —</option>
                  {banks.map((b) => (
                    <option key={b.id} value={b.id}>{b.code} - {b.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <Button type="submit" disabled={formSubmitting}>
                  Submit Request
                </Button>
                <Button type="button" variant="outline" onClick={() => setModal(null)}>
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
        </ModalOverlayGate>
      )}

      {/* Category CRUD Modal */}
      {modal === "category" && (
        <ModalOverlayGate>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 dark:bg-gray-800">
            <h3 className="mb-4 text-lg font-semibold">
              {editingCategory ? "Edit category" : "Expense categories"}
            </h3>

            {canApprove && (
              <form onSubmit={handleSaveCategory} className="mb-5 space-y-3 rounded-xl border border-gray-100 p-4 dark:border-gray-700">
                {categoryError && <p className="text-sm text-red-600">{categoryError}</p>}
                <div>
                  <label className="mb-1 block text-sm font-medium">Name</label>
                  <input
                    value={categoryName}
                    onChange={(e) => setCategoryName(e.target.value)}
                    required
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Description (optional)</label>
                  <input
                    value={categoryDescription}
                    onChange={(e) => setCategoryDescription(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  />
                </div>
                <Button type="submit" size="sm" disabled={categorySubmitting}>
                  {categorySubmitting ? "Saving…" : editingCategory ? "Update" : "Add category"}
                </Button>
              </form>
            )}

            <div className="max-h-60 space-y-2 overflow-y-auto">
              {categories.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 dark:border-gray-700"
                >
                  <div>
                    <p className={`text-sm font-medium ${c.isActive ? "" : "text-gray-400 line-through"}`}>
                      {c.name}
                    </p>
                    {c.description && (
                      <p className="text-xs text-gray-500">{c.description}</p>
                    )}
                  </div>
                  {canApprove && (
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => openCategoryModal(c)}
                        className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/5"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleCategory(c)}
                        className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5"
                      >
                        {c.isActive ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCategory(c.id)}
                        className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-4 flex justify-end">
              <Button type="button" variant="outline" onClick={() => setModal(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
        </ModalOverlayGate>
      )}

      {/* Reject Modal */}
      {modal === "reject" && rejectExpenseId && (
        <ModalOverlayGate>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 dark:bg-gray-800">
            <h3 className="mb-4 text-lg font-semibold">Reject Expense</h3>
            <form onSubmit={handleReject} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Reason (optional)</label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                  placeholder="Provide a reason for rejection"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                />
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <Button type="submit" variant="outline" className="border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
                  Reject
                </Button>
                <Button type="button" variant="outline" onClick={() => { setModal(null); setRejectExpenseId(null); }}>
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
        </ModalOverlayGate>
      )}
    </div>
  );
}
