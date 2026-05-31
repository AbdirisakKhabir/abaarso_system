"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type ModalOverlayContextValue = {
  /** True when at least one modal / overlay is open */
  isModalOpen: boolean;
  /** Call on mount when a modal opens; returned cleanup runs on unmount */
  registerModal: () => () => void;
};

const ModalOverlayContext = createContext<ModalOverlayContextValue | null>(
  null
);

export function ModalOverlayProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [openCount, setOpenCount] = useState(0);

  const registerModal = useCallback(() => {
    setOpenCount((c) => c + 1);
    return () => setOpenCount((c) => Math.max(0, c - 1));
  }, []);

  const value = useMemo(
    () => ({
      isModalOpen: openCount > 0,
      registerModal,
    }),
    [openCount, registerModal]
  );

  return (
    <ModalOverlayContext.Provider value={value}>
      {children}
    </ModalOverlayContext.Provider>
  );
}

export function useModalOverlay() {
  const ctx = useContext(ModalOverlayContext);
  if (!ctx) {
    return { isModalOpen: false, registerModal: () => () => {} };
  }
  return ctx;
}

/** Mount when a modal is visible; registers so the app header can hide */
export function ModalOverlayGate({ children }: { children: React.ReactNode }) {
  const { registerModal } = useModalOverlay();
  useEffect(() => {
    return registerModal();
  }, [registerModal]);
  return <>{children}</>;
}
