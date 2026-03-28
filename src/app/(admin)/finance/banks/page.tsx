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
  TableRow,
} from "@/components/ui/table";
import { authFetch } from "@/lib/api";
import { ModalOverlayGate } from "@/context/ModalOverlayContext";
import { useAuth } from "@/context/AuthContext";
import { ChevronLeftIcon, PlusIcon } from "@/icons";

type Bank = { id: number; name: string; code: string; balance: number; accountNumber?: string | null; isActive: boolean };

export default function BanksPage() {
  const { hasPermission } = useAuth();
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"add" | "withdraw" | "transfer" | null>(null);
  const [selectedBankId, setSelectedBankId] = useState<number | null>(null);

  // Add bank form
  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formAccountNumber, setFormAccountNumber] = useState("");
  const [formError, setFormError] = useState("");
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Withdraw form
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawReason, setWithdrawReason] = useState("");
  const [withdrawError, setWithdrawError] = useState("");
  const [withdrawSubmitting, setWithdrawSubmitting] = useState(false);

  // Transfer form
  const [transferFromId, setTransferFromId] = useState("");
  const [transferToId, setTransferToId] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [transferError, setTransferError] = useState("");
  const [transferSubmitting, setTransferSubmitting] = useState(false);

  const canCreate = hasPermission("banks.create");
  const canWithdraw = hasPermission("banks.withdraw");
  const canTransfer = hasPermission("banks.transfer");

  async function loadBanks() {
    setLoading(true);
    const res = await authFetch("/api/banks");
    if (res.ok) {
      const data = await res.json();
      setBanks(data);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadBanks();
  }, []);

  const handleAddBank = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormSubmitting(true);
    try {
      const res = await authFetch("/api/banks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          code: formCode.trim(),
          accountNumber: formAccountNumber.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "Failed to create bank");
        return;
      }
      await loadBanks();
      setModal(null);
      setFormName("");
      setFormCode("");
      setFormAccountNumber("");
    } catch {
      setFormError("Network error");
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBankId) return;
    setWithdrawError("");
    setWithdrawSubmitting(true);
    try {
      const res = await authFetch("/api/banks/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bankId: selectedBankId,
          amount: Number(withdrawAmount),
          reason: withdrawReason.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setWithdrawError(data.error || "Withdrawal failed");
        return;
      }
      await loadBanks();
      setModal(null);
      setSelectedBankId(null);
      setWithdrawAmount("");
      setWithdrawReason("");
    } catch {
      setWithdrawError("Network error");
    } finally {
      setWithdrawSubmitting(false);
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setTransferError("");
    setTransferSubmitting(true);
    try {
      const res = await authFetch("/api/banks/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromBankId: Number(transferFromId),
          toBankId: Number(transferToId),
          amount: Number(transferAmount),
          reason: transferReason.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTransferError(data.error || "Transfer failed");
        return;
      }
      await loadBanks();
      setModal(null);
      setTransferFromId("");
      setTransferToId("");
      setTransferAmount("");
      setTransferReason("");
    } catch {
      setTransferError("Network error");
    } finally {
      setTransferSubmitting(false);
    }
  };

  const handleOpenWithdraw = (bankId: number) => {
    setSelectedBankId(bankId);
    setWithdrawAmount("");
    setWithdrawReason("");
    setWithdrawError("");
    setModal("withdraw");
  };

  const totalBalance = banks.reduce((sum, b) => sum + (b.balance ?? 0), 0);

  return (
    <div>
      <PageBreadCrumb pageTitle="Banks" />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <Link
          href="/finance"
          className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
        >
          <ChevronLeftIcon className="h-4 w-4" />
          Back to Finance
        </Link>
        <div className="flex gap-2">
          {canWithdraw && banks.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setModal("withdraw");
                setSelectedBankId(banks[0]?.id ?? null);
              }}
            >
              Withdraw
            </Button>
          )}
          {canTransfer && banks.length >= 2 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setModal("transfer");
                setTransferFromId(String(banks[0]?.id ?? ""));
                setTransferToId(String(banks[1]?.id ?? ""));
              }}
            >
              Transfer
            </Button>
          )}
          {canCreate && (
            <Button size="sm" startIcon={<PlusIcon />} onClick={() => setModal("add")}>
              Add Bank
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/5">
          <h3 className="mb-2 text-sm font-medium text-gray-500 dark:text-gray-400">Total Bank Balance</h3>
          <p className="text-3xl font-bold text-green-600 dark:text-green-400">
            ${totalBalance.toLocaleString()}
          </p>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/5">
        <div className="border-b border-gray-200 px-5 py-4 dark:border-gray-800">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">Bank Accounts</h3>
        </div>
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-brand-500" />
          </div>
        ) : banks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <p className="text-sm text-gray-500 dark:text-gray-400">No banks yet.</p>
            {canCreate && (
              <Button className="mt-3" size="sm" onClick={() => setModal("add")}>
                Add Bank
              </Button>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-transparent! hover:bg-transparent!">
                <TableCell isHeader>Code</TableCell>
                <TableCell isHeader>Name</TableCell>
                <TableCell isHeader>Account Number</TableCell>
                <TableCell isHeader className="text-right">Balance</TableCell>
                <TableCell isHeader className="text-right">Actions</TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {banks.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-mono font-medium">{b.code}</TableCell>
                  <TableCell>{b.name}</TableCell>
                  <TableCell>{b.accountNumber || "—"}</TableCell>
                  <TableCell className="text-right font-semibold text-green-600 dark:text-green-400">
                    ${(b.balance ?? 0).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {canWithdraw && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenWithdraw(b.id)}
                      >
                        Withdraw
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Add Bank Modal */}
      {modal === "add" && (
        <ModalOverlayGate>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white px-6 py-5 shadow-xl dark:border-gray-700 dark:bg-gray-900">
            <h2 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">Add Bank</h2>
            <form onSubmit={handleAddBank} className="space-y-4">
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
                  placeholder="e.g. Dahabshiil - Main"
                  className="h-11 w-full rounded-lg border border-gray-200 bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:text-white dark:focus:border-brand-500/40"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Code</label>
                <input
                  type="text"
                  required
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                  placeholder="e.g. DHB-001"
                  className="h-11 w-full rounded-lg border border-gray-200 bg-transparent px-4 py-2.5 text-sm font-mono text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:text-white dark:focus:border-brand-500/40"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Account Number</label>
                <input
                  type="text"
                  value={formAccountNumber}
                  onChange={(e) => setFormAccountNumber(e.target.value)}
                  placeholder="Optional"
                  className="h-11 w-full rounded-lg border border-gray-200 bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:text-white dark:focus:border-brand-500/40"
                />
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setModal(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={formSubmitting} size="sm">
                  {formSubmitting ? "Creating..." : "Create Bank"}
                </Button>
              </div>
            </form>
          </div>
        </div>
        </ModalOverlayGate>
      )}

      {/* Withdraw Modal */}
      {modal === "withdraw" && selectedBankId && (
        <ModalOverlayGate>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white px-6 py-5 shadow-xl dark:border-gray-700 dark:bg-gray-900">
            <h2 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">Withdraw from Bank</h2>
            <form onSubmit={handleWithdraw} className="space-y-4">
              {withdrawError && (
                <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">
                  {withdrawError}
                </div>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Bank</label>
                <select
                  value={selectedBankId}
                  onChange={(e) => setSelectedBankId(Number(e.target.value))}
                  className="h-11 w-full rounded-lg border border-gray-200 bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:text-white dark:focus:border-brand-500/40"
                >
                  {banks.map((b) => (
                    <option key={b.id} value={b.id}>{b.code} - {b.name} (${(b.balance ?? 0).toLocaleString()})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Amount</label>
                <input
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="0.00"
                  className="h-11 w-full rounded-lg border border-gray-200 bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:text-white dark:focus:border-brand-500/40"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Reason</label>
                <input
                  type="text"
                  value={withdrawReason}
                  onChange={(e) => setWithdrawReason(e.target.value)}
                  placeholder="Optional"
                  className="h-11 w-full rounded-lg border border-gray-200 bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:text-white dark:focus:border-brand-500/40"
                />
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setModal(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={withdrawSubmitting} size="sm">
                  {withdrawSubmitting ? "Processing..." : "Withdraw"}
                </Button>
              </div>
            </form>
          </div>
        </div>
        </ModalOverlayGate>
      )}

      {/* Transfer Modal */}
      {modal === "transfer" && (
        <ModalOverlayGate>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white px-6 py-5 shadow-xl dark:border-gray-700 dark:bg-gray-900">
            <h2 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">Transfer Between Banks</h2>
            <form onSubmit={handleTransfer} className="space-y-4">
              {transferError && (
                <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">
                  {transferError}
                </div>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">From Bank</label>
                <select
                  value={transferFromId}
                  onChange={(e) => setTransferFromId(e.target.value)}
                  className="h-11 w-full rounded-lg border border-gray-200 bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:text-white dark:focus:border-brand-500/40"
                >
                  {banks.map((b) => (
                    <option key={b.id} value={b.id}>{b.code} - {b.name} (${(b.balance ?? 0).toLocaleString()})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">To Bank</label>
                <select
                  value={transferToId}
                  onChange={(e) => setTransferToId(e.target.value)}
                  className="h-11 w-full rounded-lg border border-gray-200 bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:text-white dark:focus:border-brand-500/40"
                >
                  {banks.map((b) => (
                    <option key={b.id} value={b.id}>{b.code} - {b.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Amount</label>
                <input
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  placeholder="0.00"
                  className="h-11 w-full rounded-lg border border-gray-200 bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:text-white dark:focus:border-brand-500/40"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Reason</label>
                <input
                  type="text"
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  placeholder="Optional"
                  className="h-11 w-full rounded-lg border border-gray-200 bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:text-white dark:focus:border-brand-500/40"
                />
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setModal(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={transferSubmitting} size="sm">
                  {transferSubmitting ? "Processing..." : "Transfer"}
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
