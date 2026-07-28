 import { useState, useEffect } from "react";
 import { db } from "@/integrations/supabase/untyped";
 import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
 import { Button } from "@/components/ui/button";
 import { Input } from "@/components/ui/input";
 import { Label } from "@/components/ui/label";
 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
 import { Textarea } from "@/components/ui/textarea";
 import { Search, UserPlus, Link as LinkIcon, Check, Copy, Stethoscope } from "lucide-react";
 import { toast } from "sonner";
 import { Badge } from "@/components/ui/badge";
 
 interface ReferralSystemProps {
   patientId?: string;
   patientName?: string;
   onClose?: () => void;
 }
 
 export const ReferralSystem = ({ patientId, patientName, onClose }: ReferralSystemProps) => {
   const [specialties, setSpecialties] = useState<any[]>([]);
   const [selectedSpecialty, setSelectedSpecialty] = useState("");
   const [loading, setLoading] = useState(true);
   const [reason, setReason] = useState("");
   const [referralLink, setReferralLink] = useState("");
   const [copied, setCopied] = useState(false);
 
   useEffect(() => {
     const fetchSpecialties = async () => {
       const { data } = await db.from("specialties").select("*").eq("is_active", true).order("name");
       if (data) setSpecialties(data);
       setLoading(false);
     };
     fetchSpecialties();
   }, []);
 
   const generateReferral = () => {
     if (!selectedSpecialty) {
       toast.error("Selecione uma especialidade");
       return;
     }
 
     const specialty = specialties.find(s => s.id === selectedSpecialty);
     const baseUrl = window.location.origin;
     // Create a booking link with pre-filled specialty
     const link = `${baseUrl}/dashboard/schedule?specialty=${specialty?.slug || specialty?.id}`;
     
     setReferralLink(link);
     toast.success("Encaminhamento gerado com sucesso!");
   };
 
   const copyToClipboard = () => {
     navigator.clipboard.writeText(referralLink);
     setCopied(true);
     toast.success("Link copiado para a área de transferência");
     setTimeout(() => setCopied(false), 2000);
   };
 
   return (
     <Card className="w-full border-border/50 shadow-lg">
       <CardHeader className="pb-3">
         <CardTitle className="text-lg flex items-center gap-2">
           <UserPlus className="w-5 h-5 text-primary" />
           Encaminhar Paciente
         </CardTitle>
       </CardHeader>
       <CardContent className="space-y-4">
         {patientName && (
           <div className="p-3 bg-primary/5 rounded-lg border border-primary/10 flex items-center justify-between">
             <div className="flex items-center gap-2">
               <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">
                 {patientName.charAt(0)}
               </div>
               <div>
                 <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Paciente</p>
                 <p className="text-sm font-bold text-foreground">{patientName}</p>
               </div>
             </div>
             <Badge variant="outline" className="text-[10px]">ID: {patientId?.slice(0, 8)}</Badge>
           </div>
         )}
 
         <div className="space-y-2">
           <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Especialidade Recomendada</Label>
           <Select value={selectedSpecialty} onValueChange={setSelectedSpecialty}>
             <SelectTrigger className="h-11 rounded-xl">
               <SelectValue placeholder="Selecione a especialidade" />
             </SelectTrigger>
             <SelectContent>
               {specialties.map((s) => (
                 <SelectItem key={s.id} value={s.id}>
                   <div className="flex items-center gap-2">
                     <Stethoscope className="w-3.5 h-3.5 opacity-50" />
                     {s.name}
                   </div>
                 </SelectItem>
               ))}
             </SelectContent>
           </Select>
         </div>
 
         <div className="space-y-2">
           <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Motivo / Observações</Label>
           <Textarea 
             placeholder="Descreva o motivo do encaminhamento para o outro profissional..."
             className="rounded-xl min-h-[100px] resize-none"
             value={reason}
             onChange={(e) => setReason(e.target.value)}
           />
         </div>
 
         {!referralLink ? (
           <Button 
             className="w-full h-11 rounded-xl font-bold gap-2" 
             onClick={generateReferral}
             disabled={!selectedSpecialty}
           >
             <Check className="w-4 h-4" /> Gerar Encaminhamento
           </Button>
         ) : (
           <div className="space-y-3 pt-2">
             <Label className="text-xs font-bold uppercase tracking-wider text-primary">Link de Agendamento Gerado</Label>
             <div className="flex gap-2">
               <Input 
                 readOnly 
                 value={referralLink} 
                 className="h-11 rounded-xl bg-muted/30 font-mono text-xs" 
               />
               <Button 
                 variant={copied ? "outline" : "default"} 
                 className="h-11 w-11 p-0 shrink-0 rounded-xl"
                 onClick={copyToClipboard}
                 aria-label="Copiar link"
               >
                 {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
               </Button>
             </div>
             <p className="text-[10px] text-muted-foreground text-center italic">
               Envie este link para o paciente realizar o agendamento direto com a especialidade sugerida.
             </p>
             <Button variant="ghost" className="w-full text-xs" onClick={() => setReferralLink("")}>
               Gerar novo
             </Button>
           </div>
         )}
       </CardContent>
     </Card>
   );
 };