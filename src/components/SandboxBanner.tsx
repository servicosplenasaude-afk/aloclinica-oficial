import { FlaskConical } from "lucide-react";
import { isSandbox } from "@/lib/app-environment";

const SandboxBanner = () => {
  if (!isSandbox) return null;

  return (
    <div
      role="status"
      className="sticky top-0 z-[10000] flex min-h-8 items-center justify-center gap-2 bg-amber-400 px-3 py-1 text-center text-xs font-bold tracking-wide text-amber-950 shadow-sm"
    >
      <FlaskConical className="h-4 w-4 shrink-0" aria-hidden="true" />
      AMBIENTE DE HOMOLOGAÇÃO — use somente dados fictícios
    </div>
  );
};

export default SandboxBanner;
