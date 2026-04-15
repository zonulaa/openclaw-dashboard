"use client";

import { useEffect } from "react";
import { registerGSAPPlugins } from "@/lib/gsap-utils";

/**
 * GSAP Provider — registers plugins once on mount.
 * Wrap children in layout.tsx.
 */
export default function GsapProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    registerGSAPPlugins();
  }, []);

  return <>{children}</>;
}
