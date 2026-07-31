import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ImagePlus } from "lucide-react";
import type { BlockField } from "@/lib/site-blocks";
import { RichTextEditor } from "@/components/admin/studio/RichTextEditor";

type Props = {
  fields: BlockField[];
  value: Record<string, any>;
  onChange: (next: Record<string, any>) => void;
  onPickImage?: (cb: (url: string) => void) => void;
};

export function BlockFieldsForm({ fields, value, onChange, onPickImage }: Props) {
  const setField = (k: string, v: any) => onChange({ ...value, [k]: v });

  // Se o schema for vazio mas houver dados, gera campos automaticamente
  const autoFields = useMemo<BlockField[]>(() => {
    if (fields?.length) return fields;
    return Object.entries(value || {}).map(([k, v]) => ({
      key: k,
      label: k,
      type: typeof v === "boolean" ? "switch"
          : typeof v === "number" ? "number"
          : Array.isArray(v) ? "list"
          : (typeof v === "string" && v.length > 120) ? "textarea"
          : "text",
    }));
  }, [fields, value]);

  if (autoFields.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Este bloco ainda não tem campos definidos.</p>;
  }

  return (
    <div className="space-y-4">
      {autoFields.map((f) => (
        <FieldRow
          key={f.key}
          field={f}
          value={value?.[f.key]}
          onChange={(v) => setField(f.key, v)}
          onPickImage={onPickImage}
        />
      ))}
    </div>
  );
}

function FieldRow({ field, value, onChange, onPickImage }: {
  field: BlockField;
  value: any;
  onChange: (v: any) => void;
  onPickImage?: (cb: (url: string) => void) => void;
}) {
  const lbl = <Label className="text-[13px] font-semibold">{field.label}</Label>;

  switch (field.type) {
    case "richtext":
      return (
        <div className="space-y-1.5">{lbl}
          <RichTextEditor value={value ?? ""} onChange={onChange} placeholder={field.placeholder} />
        </div>
      );
    case "textarea":
      return (
        <div className="space-y-1.5">{lbl}
          <Textarea rows={4} value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} />
        </div>
      );
    case "switch":
      return (
        <div className="flex items-center justify-between rounded-lg border p-3">
          {lbl}
          <Switch checked={!!value} onCheckedChange={onChange} />
        </div>
      );
    case "number":
      return (
        <div className="space-y-1.5">{lbl}
          <Input type="number" value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} />
        </div>
      );
    case "color":
      return (
        <div className="space-y-1.5">{lbl}
          <div className="flex gap-2">
            <Input type="color" value={value ?? "#000000"} onChange={(e) => onChange(e.target.value)} className="w-16 p-1 h-10" />
            <Input value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder="#000000 ou 215 75% 32%" />
          </div>
        </div>
      );
    case "select":
      return (
        <div className="space-y-1.5">{lbl}
          <Select value={value ?? ""} onValueChange={onChange}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>{(field.options ?? []).map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      );
    case "image":
      return (
        <div className="space-y-1.5">{lbl}
          <div className="flex gap-2">
            <Input value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder="https://… ou /caminho" />
            {onPickImage && (
              <Button type="button" variant="outline" size="icon" onClick={() => onPickImage(onChange)}>
                <ImagePlus className="w-4 h-4" />
              </Button>
            )}
          </div>
          {value && <img src={value} alt="" className="mt-2 max-h-32 rounded border" />}
        </div>
      );
    case "list":
    case "array": // alias — alguns schemas antigos usam "array" para listas repetíveis
      return <ListField field={field} value={value ?? []} onChange={onChange} onPickImage={onPickImage} />;
    default:
      return (
        <div className="space-y-1.5">{lbl}
          <Input value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} />
        </div>
      );
  }
}

function ListField({ field, value, onChange, onPickImage }: any) {
  const items: any[] = Array.isArray(value) ? value : [];
  // Aceita variações de schema: item_schema.fields | items.fields | fields | item_fields
  const itemFields: BlockField[] = field.item_schema?.fields ?? field.items?.fields ?? field.item_fields ?? field.fields ?? [];
  const add = () => {
    const blank: Record<string, any> = {};
    itemFields.forEach((f) => { blank[f.key] = ""; });
    onChange([...items, blank]);
  };
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const update = (i: number, v: any) => onChange(items.map((it, idx) => idx === i ? v : it));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-[13px] font-semibold">{field.label}</Label>
        <Button type="button" variant="outline" size="sm" onClick={add}><Plus className="w-3.5 h-3.5 mr-1" />Item</Button>
      </div>
      <div className="space-y-3">
        {items.map((item, i) => (
          <div key={i} className="rounded-lg border p-3 space-y-3 bg-muted/30">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">#{i + 1}</span>
              <Button type="button" variant="ghost" size="icon" onClick={() => remove(i)}>
                <Trash2 className="w-3.5 h-3.5 text-destructive" />
              </Button>
            </div>
            {itemFields.length > 0 ? (
              <BlockFieldsForm fields={itemFields} value={item} onChange={(v) => update(i, v)} onPickImage={onPickImage} />
            ) : (
              <Textarea rows={2} value={typeof item === "string" ? item : JSON.stringify(item)} onChange={(e) => update(i, e.target.value)} />
            )}
          </div>
        ))}
        {items.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">Nenhum item. Clique em "Item" para adicionar.</p>}
      </div>
    </div>
  );
}