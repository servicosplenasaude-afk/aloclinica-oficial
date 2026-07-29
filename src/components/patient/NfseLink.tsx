import { useEffect, useState } from "react";
import { db } from "@/integrations/supabase/untyped";
import { FileText, Download } from "lucide-react";

interface NfseLinkProps {
  appointmentId: string;
  className?: string;
}

interface NfseData {
  status: string | null;
  pdf_url: string | null;
  numero: string | null;
}

/**
 * Mostra a NFS-e de uma consulta paga para o paciente.
 * - autorizado + pdf_url → botão "Baixar Nota Fiscal (PDF)" (abre em nova aba)
 * - processando → linha discreta informando que o link chega em instantes
 * - sem nota / erro / cancelado → não renderiza nada (feature invisível até existir nota real)
 *
 * A leitura é escopada por RLS (paciente só lê nfse_invoices onde patient_id = auth.uid()).
 */
const NfseLink = ({ appointmentId, className = "" }: NfseLinkProps) => {
  const [nfse, setNfse] = useState<NfseData | null>(null);

  useEffect(() => {
    let active = true;
    const fetchNfse = async () => {
      try {
        const { data } = await db
          .from("nfse_invoices")
          .select("status, pdf_url, numero")
          .eq("resource_type", "appointment")
          .eq("resource_id", appointmentId)
          .maybeSingle();
        if (active) setNfse((data as NfseData) ?? null);
      } catch {
        if (active) setNfse(null);
      }
    };
    if (appointmentId) fetchNfse();
    return () => { active = false; };
  }, [appointmentId]);

  if (!nfse) return null;

  if (nfse.status === "autorizado" && nfse.pdf_url) {
    return (
      <a
        href={nfse.pdf_url}
        target="_blank"
        rel="noopener noreferrer"
        className={`flex items-center justify-between gap-3 p-3 rounded-xl border border-border/40 hover:border-primary/30 hover:bg-primary/[0.04] transition-colors group ${className}`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <FileText className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-foreground">Baixar Nota Fiscal (PDF)</p>
            {nfse.numero && (
              <p className="text-[11px] text-muted-foreground">NFS-e nº {nfse.numero}</p>
            )}
          </div>
        </div>
        <Download className="w-4 h-4 text-muted-foreground group-hover:text-primary shrink-0" />
      </a>
    );
  }

  if (nfse.status === "processando") {
    return (
      <p className={`text-[12px] text-muted-foreground ${className}`}>
        Nota fiscal em processamento — o link chega em instantes.
      </p>
    );
  }

  return null;
};

export default NfseLink;
