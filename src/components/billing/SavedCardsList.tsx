/**
 * SavedCardsList — lista cartões salvos com:
 *   - escolha (radio) — controlado por selectedId/onSelect
 *   - definir como padrão
 *   - remover
 *   - botão "Adicionar novo cartão"
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Star, CreditCard } from "lucide-react";
import { useSavedCards } from "./useSavedCards";
import AddCardForm from "./AddCardForm";

type Props = {
  selectedId?: string | null;
  onSelect?: (cardId: string) => void;
  /** Esconde ações de gestão (default/remover) — usado em pure-pick mode */
  pickOnly?: boolean;
};

const brandColor: Record<string, string> = {
  VISA: "bg-blue-600 text-white",
  MASTERCARD: "bg-orange-600 text-white",
  AMEX: "bg-emerald-600 text-white",
  ELO: "bg-yellow-500 text-yellow-950",
  HIPERCARD: "bg-red-600 text-white",
  UNKNOWN: "bg-muted text-muted-foreground",
};

export function SavedCardsList({ selectedId, onSelect, pickOnly = false }: Props) {
  const { cards, loading, remove, setDefault } = useSavedCards();
  const [showAdd, setShowAdd] = useState(false);

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2].map((i) => (
          <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {cards.length === 0 && !showAdd && (
        <div className="text-center py-8 border-2 border-dashed rounded-xl">
          <CreditCard className="w-10 h-10 mx-auto mb-2 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground mb-3">Nenhum cartão salvo</p>
          <Button onClick={() => setShowAdd(true)} variant="outline" size="sm">
            <Plus className="w-4 h-4 mr-1.5" /> Adicionar cartão
          </Button>
        </div>
      )}

      {cards.length > 0 && (
        <div className="space-y-2">
          {cards.map((c) => {
            const selected = selectedId === c.id;
            return (
              <Card
                key={c.id}
                className={`cursor-pointer transition-all ${selected ? "ring-2 ring-primary border-primary" : "hover:border-primary/30"}`}
                onClick={() => onSelect?.(c.id)}
              >
                <CardContent className="p-3 flex items-center gap-3">
                  <div className={`w-10 h-7 rounded flex items-center justify-center text-[10px] font-bold ${brandColor[c.brand] ?? brandColor.UNKNOWN}`}>
                    {c.brand?.slice(0, 4)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm">•••• {c.last4}</span>
                      {c.is_default && (
                        <Badge variant="outline" className="text-[10px] gap-0.5 border-amber-200 text-amber-700">
                          <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" /> padrão
                        </Badge>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {c.holder_name} · {c.expiry_month}/{c.expiry_year.slice(-2)}
                    </div>
                  </div>
                  {!pickOnly && (
                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {!c.is_default && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          aria-label="Definir como padrão"
                          title="Definir como padrão"
                          onClick={() => setDefault(c.id)}
                        >
                          <Star className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        aria-label="Remover cartão"
                        title="Remover"
                        onClick={() => {
                          if (confirm(`Remover o cartão final ${c.last4}?`)) remove(c.id);
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {showAdd ? (
        <Card>
          <CardContent className="p-4">
            <h4 className="text-sm font-semibold mb-3">Adicionar novo cartão</h4>
            <AddCardForm
              onSaved={(id) => { setShowAdd(false); onSelect?.(id); }}
              onCancel={() => setShowAdd(false)}
              defaultIsDefault={cards.length === 0}
            />
          </CardContent>
        </Card>
      ) : (
        cards.length > 0 && (
          <Button
            onClick={() => setShowAdd(true)}
            variant="outline"
            size="sm"
            className="w-full gap-1.5"
          >
            <Plus className="w-4 h-4" /> Adicionar novo cartão
          </Button>
        )
      )}
    </div>
  );
}

export default SavedCardsList;
