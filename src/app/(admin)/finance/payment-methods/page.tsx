"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
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
import { ChevronLeftIcon, PlusIcon, TrashBinIcon } from "@/icons";

type Bank = { id: number; name: string; code: string; isActive?: boolean };
type PaymentMethod = {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
  bank: { id: number; name: string; code: string } | null;
};

const inputClass =
  "h-11 w-full rounded-lg border border-gray-200 bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:text-white dark:focus:border-brand-500/40";

export default function PaymentMethodsPage() {
  const { hasPermission } = useAuth();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [editing, setEditing] = useState<PaymentMethod | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [formName, setFormName] = useState("");
  const [formBankId, setFormBankId] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formActive, setFormActive] = useState(true);
  const [formError, setFormError] = useState("");
  const [formSubmitting, setFormSubmitting] = useState(false);

  const canManage = hasPermission("banks.create");
  const canDelete = hasPermission("banks.delete");

  async function loadMethods() {
    setLoading(true);
    const res = await authFetch("/api/payment-methods?all=true");
    if (res.ok) setMethods(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    loadMethods();
    authFetch("/api/banks").then((r) => {
      if (r.ok) r.json().then((d: Bank[]) => setBanks(Array.isArray(d) ? d : []));
    });
  }, []);

  const openAdd = () => {
    setEditing(null);
    setFormName("");
    setFormBankId(banks[0] ? String(banks[0].id) : "");
    setFormDescription("");
    setFormActive(true);
    setFormError("");
    setModal("add");
  };

  const openEdit = (m: PaymentMethod) => {
    setEditing(m);
    setFormName(m.name);
    setFormBankId(m.bank ? String(m.bank.id) : "");
    setFormDescription(m.description ?? "");
    setFormActive(m.isActive);
    setFormError("");
    setModal("edit");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormSubmitting(true);
    try {
      const isEdit = modal === "edit" && editing;
      const url = isEdit ? `/api/payment-methods/${editing.id}` : "/api/payment-methods";
      const res = await authFetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          bankId: Number(formBankId),
          description: formDescription.trim() || undefined,
          ...(isEdit ? { isActive: formActive } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "Failed to save payment method");
        return;
      }
      await loadMethods();
      setModal(null);
      setEditing(null);
    } catch {
      setFormError("Network error");
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleToggleActive = async (m: PaymentMethod) => {
    try {
      const res = await authFetch(`/api/payment-methods/${m.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !m.isActive }),
      });
      if (res.ok) await loadMethods();
    } catch {
      // ignore
    }
  };

  const handleDelete = async (m: PaymentMethod) => {
    if (
      !confirm(
        `Delete payment method “${m.name}”? Only methods with no recorded payments can be removed — otherwise deactivate it instead.`
      )
    ) {
      return;
    }
    setDeletingId(m.id);
    try {
      const res = await authFetch(`/api/payment-methods/${m.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Could not delete payment method");
        return;
      }
      await loadMethods();
    } catch {
      alert("Could not delete payment method");
    } finally {
      setDeletingId(null);
    }
  };

  const {
    paginatedItems,
    page,
    setPage,
    pageSize,
    setPageSize,
    totalPages,
    total,
    from,
    to,
  } = usePagination(methods, [methods]);

  return (
    <div>
      <PageBreadCrumb pageTitle="Payment Methods" />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <Link
          href="/finance"
          className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
        >
          <ChevronLeftIcon className="h-4 w-4" />
          Back to Finance
        </Link>
        {canManage && (
          <Button size="sm" startIcon={<PlusIcon />} onClick={openAdd} disabled={banks.length === 0}>
            Add Payment Method
          </Button>
        )}
      </div>

      <div className="min-w-0 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/5">
        <div className="border-b border-gray-200 px-5 py-4 dark:border-gray-800">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            System Payment Methods
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Each payment method is linked to a bank. When recording a payment, staff pick a method
            and the deposit is credited to its bank.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-brand-500" />
          </div>
        ) : banks.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Add a bank first, then create payment methods linked to it.
            </p>
            <Link href="/finance/banks" className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400">
              Manage banks
            </Link>
          </div>
        ) : methods.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <p className="text-sm text-gray-500 dark:text-gray-400">No payment methods yet.</p>
            {canManage && (
              <Button className="mt-3" size="sm" onClick={openAdd}>
                Add Payment Method
              </Button>
            )}
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="bg-transparent! hover:bg-transparent!">
                  <TableCell isHeader>Name</TableCell>
                  <TableCell isHeader>Linked Bank</TableCell>
                  <TableCell isHeader>Description</TableCell>
                  <TableCell isHeader>Status</TableCell>
                  <TableCell isHeader className="text-right">Actions</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedItems.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium text-gray-800 dark:text-white/90">
                      {m.name}
                    </TableCell>
                    <TableCell>
                      {m.bank ? (
                        <span>
                          <span className="font-mono">{m.bank.code}</span> — {m.bank.name}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-gray-600 dark:text-gray-300">
                      {m.description || "—"}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          m.isActive
                            ? "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400"
                            : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
                        }`}
                      >
                        {m.isActive ? "Active" : "Inactive"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex flex-wrap items-center justify-end gap-1">
                        {canManage && (
                          <>
                            <Button variant="outline" size="sm" onClick={() => openEdit(m)}>
                              Edit
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => void handleToggleActive(m)}>
                              {m.isActive ? "Deactivate" : "Activate"}
                            </Button>
                          </>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => void handleDelete(m)}
                            disabled={deletingId === m.id}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-error-50 hover:text-error-500 disabled:opacity-50 dark:hover:bg-error-500/10"
                            aria-label={`Delete payment method ${m.name}`}
                            title="Delete payment method (only if unused)"
                          >
                            <TrashBinIcon className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <TablePagination
              page={page}
              totalPages={totalPages}
              total={total}
              from={from}
              to={to}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </>
        )}
      </div>

      {(modal === "add" || modal === "edit") && (
        <ModalOverlayGate>
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white px-6 py-5 shadow-xl dark:border-gray-700 dark:bg-gray-900">
              <h2 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">
                {modal === "edit" ? "Edit Payment Method" : "Add Payment Method"}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                {formError && (
                  <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">
                    {formError}
                  </div>
                )}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. eDahab, Cash on hand, Premier Transfer"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Linked bank</label>
                  <select
                    required
                    value={formBankId}
                    onChange={(e) => setFormBankId(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Select bank</option>
                    {banks.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.code} — {b.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
                  <input
                    type="text"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Optional"
                    className={inputClass}
                  />
                </div>
                {modal === "edit" && (
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={formActive}
                      onChange={(e) => setFormActive(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    Active (available when recording payments)
                  </label>
                )}
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setModal(null)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={formSubmitting} size="sm">
                    {formSubmitting
                      ? "Saving..."
                      : modal === "edit"
                        ? "Save Changes"
                        : "Create Method"}
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
