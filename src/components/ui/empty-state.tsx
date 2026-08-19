/**
 * EmptyState — padrão único para empty/erro/sem-resultado em todos os painéis.
 *
 * Exemplos:
 *  <EmptyState icon={FileText} title="Nenhuma receita emitida"
 *    description="Emita receitas digitais direto pela plataforma."
 *    action={{ label: "Nova Receita", onClick: () => navigate("/dashboard/prescribe") }} />
 *
 *  <EmptyState variant="error" icon={AlertCircle} title="Não foi possível carregar"
 *    description="Verifique a conexão." action={{ label: "Recarregar", onClick: reload }} />
 */
import { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Variant = "default" | "error" | "subtle";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: { label: string; onClick: () => void; icon?: LucideIcon };
  secondaryAction?: { label: string; onClick: () => void };
  variant?: Variant;
  className?: string;
}

const variantStyles: Record<Variant, { wrap: string; iconWrap: string; iconColor: string }> = {
  default: {
    wrap: "border-dashed border-border/40",
    iconWrap: "bg-primary/10",
    iconColor: "text-primary/70",
  },
  error: {
    wrap: "border-destructive/40 bg-destructive/[0.02]",
    iconWrap: "bg-destructive/10",
    iconColor: "text-destructive/70",
  },
  subtle: {
    wrap: "border-border/20",
    iconWrap: "bg-muted/40",
    iconColor: "text-muted-foreground/70",
  },
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  variant = "default",
  className,
}: EmptyStateProps) {
  const s = variantStyles[variant];
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      aria-live={variant === "error" ? "assertive" : "polite"}
      className={cn("rounded-2xl border p-8 sm:p-10 text-center", s.wrap, className)}
    >
      {Icon && (
        <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3", s.iconWrap)}>
          <Icon className={cn("w-7 h-7", s.iconColor)} aria-hidden="true" />
        </div>
      )}
      <p className="font-semibold text-foreground mb-1">{title}</p>
      {description && <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">{description}</p>}
      {(action || secondaryAction) && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {action && (
            <Button size="sm" className="rounded-xl gap-1.5" onClick={action.onClick}>
              {action.icon && <action.icon className="w-4 h-4" aria-hidden="true" />}
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button variant="outline" size="sm" className="rounded-xl" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export default EmptyState;
