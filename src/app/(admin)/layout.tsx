"use client";

import { useSidebar } from "@/context/SidebarContext";
import { ModalOverlayProvider } from "@/context/ModalOverlayContext";
import AppHeader from "@/layout/AppHeader";
import AppSidebar from "@/layout/AppSidebar";
import Backdrop from "@/layout/Backdrop";
import AdminAuthGuard from "@/components/auth/AdminAuthGuard";
import React from "react";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();

  // Dynamic class for main content margin based on sidebar state
  const mainContentMargin = isMobileOpen
    ? "ml-0"
    : isExpanded || isHovered
    ? "lg:ml-[290px]"
    : "lg:ml-[90px]";

  return (
    <AdminAuthGuard>
      <ModalOverlayProvider>
      <div className="min-h-screen w-full min-w-0 overflow-x-clip xl:flex">
        {/* Sidebar and Backdrop */}
        <AppSidebar />
        <Backdrop />
        {/* Main Content Area */}
        <div
          className={`flex min-h-0 min-w-0 flex-1 flex-col transition-all duration-300 ease-in-out ${mainContentMargin}`}
        >
          {/* Header */}
          <AppHeader />
          {/* Page Content */}
          <div className="mx-auto w-full min-w-0 max-w-(--breakpoint-2xl) p-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:p-6">
            {children}
          </div>
        </div>
      </div>
      </ModalOverlayProvider>
    </AdminAuthGuard>
  );
}
