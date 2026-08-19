/**
 * useSOAPNotes — Hook para gerenciar notas estruturadas SOAP
 *
 * S = Subjective (relato do paciente)
 * O = Objective (observações clínicas)
 * A = Assessment (avaliação/diagnóstico)
 * P = Plan (plano de tratamento)
 */

import { useState, useCallback, useEffect } from "react";
import { db } from "@/integrations/supabase/untyped";
import { logError } from "@/lib/logger";

export interface SOAPNotes {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

export interface SOAPState {
  notes: SOAPNotes;
  activeSection: keyof SOAPNotes;
  lastSaved: string | null;
  isSaving: boolean;
  isDirty: boolean;
}

export function useSOAPNotes(appointmentId: string, isDoctor: boolean) {
  const [state, setState] = useState<SOAPState>({
    notes: { subjective: "", objective: "", assessment: "", plan: "" },
    activeSection: "subjective",
    lastSaved: null,
    isSaving: false,
    isDirty: false,
  });

  // ─── Carregar notas existentes ────────────────────────────────────────────
  useEffect(() => {
    if (!appointmentId) return;

    const loadNotes = async () => {
      try {
        const { data } = await (db as any)
          .from("appointment_notes")
          .select("*")
          .eq("appointment_id", appointmentId)
          .eq("type", "soap")
          .maybeSingle();

        if (data) {
          const notes = data.content as SOAPNotes;
          setState(prev => ({
            ...prev,
            notes,
            lastSaved: data.updated_at,
            isDirty: false,
          }));
        }
      } catch (err) {
        // Note não existe, começar vazio
        console.info("No existing SOAP notes");
      }
    };

    loadNotes();
  }, [appointmentId]);

  // ─── Atualizar uma seção ──────────────────────────────────────────────────
  const updateSection = useCallback((
    section: keyof SOAPNotes,
    content: string
  ) => {
    setState(prev => ({
      ...prev,
      notes: { ...prev.notes, [section]: content },
      isDirty: true,
    }));
  }, []);

  const updateAllSections = useCallback((updates: Partial<SOAPNotes>) => {
    setState(prev => ({
      ...prev,
      notes: { ...prev.notes, ...updates },
      isDirty: true,
    }));
  }, []);

  const setActiveSection = useCallback((section: keyof SOAPNotes) => {
    setState(prev => ({ ...prev, activeSection: section }));
  }, []);

  // ─── Salvar notas ────────────────────────────────────────────────────────
  const saveNotes = useCallback(async () => {
    if (!appointmentId || !isDoctor || !state.isDirty) {
      return false;
    }

    setState(prev => ({ ...prev, isSaving: true }));

    try {
      const { error } = await (db as any).from("appointment_notes").upsert({
        appointment_id: appointmentId,
        type: "soap",
        content: state.notes,
        updated_at: new Date().toISOString(),
      });

      if (error) throw error;

      setState(prev => ({
        ...prev,
        isDirty: false,
        lastSaved: new Date().toISOString(),
        isSaving: false,
      }));

      return true;
    } catch (err) {
      logError("saveSOAPNotes failed", err);
      setState(prev => ({ ...prev, isSaving: false }));
      return false;
    }
  }, [appointmentId, isDoctor, state.notes, state.isDirty]);

  // ─── Auto-save a cada mudança (debounced em VideoRoom) ───────────────────
  const autoSave = useCallback(async () => {
    return saveNotes();
  }, [saveNotes]);

  // ─── Gerar texto formatado para PDF ────────────────────────────────────────
  const formatForPDF = useCallback((): string => {
    const { subjective, objective, assessment, plan } = state.notes;
    return `SUBJECTIVE:\n${subjective}\n\nOBJECTIVE:\n${objective}\n\nASSESSMENT:\n${assessment}\n\nPLAN:\n${plan}`;
  }, [state.notes]);

  // ─── Exportar como JSON ───────────────────────────────────────────────────
  const exportJSON = useCallback((): string => {
    return JSON.stringify(state.notes, null, 2);
  }, [state.notes]);

  // ─── Limpar tudo ────────────────────────────────────────────────────────
  const clear = useCallback(() => {
    setState(prev => ({
      ...prev,
      notes: { subjective: "", objective: "", assessment: "", plan: "" },
      activeSection: "subjective",
      isDirty: true,
    }));
  }, []);

  return {
    ...state,
    updateSection,
    updateAllSections,
    setActiveSection,
    saveNotes,
    autoSave,
    formatForPDF,
    exportJSON,
    clear,
    canEdit: isDoctor,
  };
}
