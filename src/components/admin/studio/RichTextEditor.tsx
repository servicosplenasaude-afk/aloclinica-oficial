/**
 * RichTextEditor — editor de texto rico (WYSIWYG) leve para campos `richtext`.
 * Usa contentEditable + comandos nativos do navegador (sem dependência externa,
 * compatível com a CSP). Emite HTML. Barra: negrito, itálico, sublinhado, título,
 * listas e link.
 */
import { useEffect, useRef } from "react";
import { Bold, Italic, Underline, Heading2, List, ListOrdered, Link2, Eraser } from "lucide-react";

export function RichTextEditor({ value, onChange, placeholder }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Sincroniza conteúdo externo → editor sem quebrar o cursor durante a digitação.
  useEffect(() => {
    const el = ref.current;
    if (el && document.activeElement !== el && el.innerHTML !== (value ?? "")) {
      el.innerHTML = value ?? "";
    }
  }, [value]);

  const emit = () => onChange(ref.current?.innerHTML ?? "");
  const exec = (cmd: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(cmd, false, arg);
    emit();
  };
  const addLink = () => {
    const url = window.prompt("URL do link (ex.: https://…):", "https://");
    if (url) exec("createLink", url);
  };

  const Btn = ({ icon: Icon, title, onClick }: { icon: any; title: string; onClick: () => void }) => (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
    >
      <Icon className="w-3.5 h-3.5" />
    </button>
  );

  return (
    <div className="rounded-md border bg-background overflow-hidden">
      <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/30 px-1 py-1">
        <Btn icon={Bold} title="Negrito" onClick={() => exec("bold")} />
        <Btn icon={Italic} title="Itálico" onClick={() => exec("italic")} />
        <Btn icon={Underline} title="Sublinhado" onClick={() => exec("underline")} />
        <span className="w-px h-4 bg-border mx-0.5" />
        <Btn icon={Heading2} title="Subtítulo" onClick={() => exec("formatBlock", "<h3>")} />
        <Btn icon={List} title="Lista com marcadores" onClick={() => exec("insertUnorderedList")} />
        <Btn icon={ListOrdered} title="Lista numerada" onClick={() => exec("insertOrderedList")} />
        <Btn icon={Link2} title="Inserir link" onClick={addLink} />
        <span className="w-px h-4 bg-border mx-0.5" />
        <Btn icon={Eraser} title="Limpar formatação" onClick={() => exec("removeFormat")} />
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        onBlur={emit}
        data-placeholder={placeholder || "Escreva aqui…"}
        className="prose prose-sm max-w-none min-h-[140px] px-3 py-2 text-sm focus:outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/60"
      />
    </div>
  );
}

export default RichTextEditor;
