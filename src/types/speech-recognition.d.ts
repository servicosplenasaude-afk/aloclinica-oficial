// Tipos da Web Speech API que faltam no lib.dom padrão do TypeScript.
// Usados por src/components/consultation/SpeechToText.tsx e
// src/components/ai/tabs/AIChatTab.tsx. Auto-contido (sem dependência externa)
// para resolver os erros de tipo do type-check (C7).

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: {
    readonly length: number;
    item(index: number): SpeechRecognitionResult;
    [index: number]: {
      readonly isFinal: boolean;
      readonly length: number;
      item(index: number): { readonly transcript: string; readonly confidence: number };
      [index: number]: { readonly transcript: string; readonly confidence: number };
    };
  };
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}
