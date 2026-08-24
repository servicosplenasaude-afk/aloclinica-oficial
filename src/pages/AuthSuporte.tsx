import AuthSimpleRole from "./AuthSimpleRole";
import { HeadphonesIcon } from "lucide-react";
import pingoSupport from "@/assets/states/pingo-acesso-suporte.webp";

const AuthSuporte = () => (
  <AuthSimpleRole
    role="support"
    title="Portal do Suporte"
    subtitle="Equipe de atendimento"
    description="Atenda tickets de pacientes, resolva problemas e acompanhe a satisfação dos usuários."
    seoDescription="Acesse o painel de suporte da AloClinica."
    icon={HeadphonesIcon}
    gradientFrom="secondary/70"
    gradientTo="accent/70"
    features={["Inbox de tickets em tempo real", "Chat com pacientes", "Escalação para administradores", "Métricas de atendimento"]}
    placeholder="suporte@aloclinica.com"
    bottomLabel="Suporte 24h"
    bottomIcon={HeadphonesIcon}
    bottomIconColor="text-secondary"
    mascotSrc={pingoSupport}
  />
);

export default AuthSuporte;
