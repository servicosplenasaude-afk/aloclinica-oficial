/**
 * ConsultationChatPanel — Chat isolado para consultas
 *
 * Responsabilidades:
 * - Renderizar mensagens
 * - Input de chat
 * - Histórico
 * - File uploads
 */

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Send, Paperclip, Image as ImageIcon, X, FileText, FileCheck } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

// Respostas rápidas do médico no chat da consulta.
// (O QUICK_REPLIES do ChatPage não é exportado e é voltado ao paciente; replicamos um set de frases de médico.)
const DOCTOR_QUICK_REPLIES = [
  "Olá! Vou iniciar seu atendimento.",
  "Pode descrever seus sintomas?",
  "Há quanto tempo sente isso?",
  "Enviando sua receita.",
  "Receita disponível no app.",
  "Mais alguma dúvida?",
];

interface ChatMessage {
  id: string;
  sender: "patient" | "doctor";
  text: string;
  time: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: "image" | "document";
}

interface ConsultationChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => Promise<void>;
  onUploadFile?: (file: File) => Promise<string>;
  isSending?: boolean;
  isReadOnly?: boolean;
  userRole?: "doctor" | "patient";
}

export function ConsultationChatPanel({
  messages,
  onSendMessage,
  onUploadFile,
  isSending = false,
  isReadOnly = false,
  userRole = "patient",
}: ConsultationChatPanelProps) {
  const [input, setInput] = useState("");
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ALLOWED_MIME_TYPES = [
    "image/jpeg", "image/png", "image/gif", "image/webp",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith("image/")) return <ImageIcon className="w-4 h-4" />;
    if (mimeType === "application/pdf") return <FileText className="w-4 h-4" />;
    return <FileCheck className="w-4 h-4" />;
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() && !attachedFile) return;

    let fileUrl: string | undefined;
    if (attachedFile && onUploadFile) {
      setUploadingFile(true);
      try {
        fileUrl = await onUploadFile(attachedFile);
      } catch (err) {
        console.error("File upload failed:", err);
        toast.error("Falha ao enviar arquivo");
      }
      setUploadingFile(false);
      // Limpar arquivo e preview após envio
      if (filePreview && filePreview.startsWith("blob:")) {
        URL.revokeObjectURL(filePreview);
      }
      setAttachedFile(null);
      setFilePreview(null);
    }

    await onSendMessage(input);
    setInput("");
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validar tamanho
      if (file.size > 10 * 1024 * 1024) {
        toast.error("Arquivo muito grande (máx. 10MB)");
        return;
      }

      // Validar MIME type
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        toast.error("Tipo de arquivo não permitido. Use: imagem, PDF ou documento Word");
        return;
      }

      setAttachedFile(file);

      // Gerar preview para imagens
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (event) => {
          setFilePreview(event.target?.result as string);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Mensagens</CardTitle>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto space-y-3 pb-3">
        <AnimatePresence>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-2 ${msg.sender === userRole ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-xs rounded-lg p-3 ${
                  msg.sender === userRole
                    ? "bg-blue-500 text-white"
                    : "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
                }`}
              >
                {msg.text && <p className="text-sm">{msg.text}</p>}
                {msg.fileUrl && (
                  <div className="mt-2">
                    {msg.fileType === "image" ? (
                      <img
                        src={msg.fileUrl}
                        alt="Attached"
                        className="rounded max-w-full max-h-40"
                      />
                    ) : (
                      <a
                        href={msg.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs underline"
                      >
                        {msg.fileName}
                      </a>
                    )}
                  </div>
                )}
                <p className="text-xs opacity-70 mt-1">{msg.time}</p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={chatEndRef} />
      </CardContent>

      {!isReadOnly && (
        <div className="border-t p-3 space-y-2">
          {attachedFile && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="space-y-2 overflow-hidden"
            >
              {filePreview && (
                <div className="max-w-[100px] h-[100px] rounded-lg border-2 border-primary/30 overflow-hidden shadow-md">
                  <img
                    src={filePreview}
                    alt="Preview"
                    className="w-full h-full object-cover rounded-lg"
                  />
                </div>
              )}
              <div className="flex items-center gap-2 bg-primary/10 dark:bg-primary/20 p-3 rounded-lg border border-primary/20 text-sm">
                <div className="flex-shrink-0 text-primary">
                  {getFileIcon(attachedFile.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate text-foreground">
                    {attachedFile.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(attachedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <button
                  onClick={() => {
                    if (filePreview && filePreview.startsWith("blob:")) {
                      URL.revokeObjectURL(filePreview);
                    }
                    setAttachedFile(null);
                    setFilePreview(null);
                  }}
                  className="flex-shrink-0 text-destructive hover:text-destructive/80 transition-colors"
                  aria-label="Remover arquivo"
                  title="Remover arquivo"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

          {userRole === "doctor" && (
            <div className="flex flex-wrap gap-1.5">
              {DOCTOR_QUICK_REPLIES.map((phrase) => (
                <button
                  key={phrase}
                  type="button"
                  onClick={() => setInput((prev) => (prev.trim() ? `${prev.trim()} ${phrase}` : phrase))}
                  disabled={isSending || uploadingFile}
                  className="text-[11px] font-medium px-2.5 py-1 rounded-full border border-border bg-muted/40 text-muted-foreground hover:bg-primary/10 hover:border-primary/30 hover:text-foreground transition-colors disabled:opacity-50"
                >
                  {phrase}
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === "Enter" && e.ctrlKey) {
                  handleSend();
                }
              }}
              placeholder="Escreva uma mensagem..."
              rows={2}
              disabled={isSending || uploadingFile}
              className="resize-none"
            />
            <div className="flex flex-col gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingFile}
                aria-label="Anexar arquivo"
                title="Anexar arquivo"
              >
                <Paperclip className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                onClick={handleSend}
                disabled={isSending || uploadingFile || (!input.trim() && !attachedFile)}
                aria-label="Enviar mensagem"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            hidden
            onChange={handleFileSelect}
            accept="image/*,.pdf,.doc,.docx"
          />
        </div>
      )}
    </Card>
  );
}
