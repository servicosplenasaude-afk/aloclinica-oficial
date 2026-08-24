
import pingoAcupuntura from "@/assets/pingo-acupunturista.jpg";
import pingoAlergia from "@/assets/specialties/pingo-alergologia.webp";
import pingoAnestesiologia from "@/assets/pingo-anestesiologista.jpg";
import pingoCardiologia from "@/assets/specialties/pingo-cardiologia.webp";
import pingoClinicoGeral from "@/assets/specialties/pingo-clinico-geral.webp";
import pingoDermatologia from "@/assets/specialties/pingo-dermatologia.webp";
import pingoEndocrinologia from "@/assets/specialties/pingo-endocrinologia.webp";
import pingoFisiatra from "@/assets/pingo-fisiatra.jpg";
import pingoGastro from "@/assets/specialties/pingo-gastroenterologia.webp";
import pingoGeriatria from "@/assets/pingo-geriatra.jpg";
import pingoGinecologia from "@/assets/specialties/pingo-ginecologia.webp";
import pingoInfectologia from "@/assets/specialties/pingo-infectologia.webp";
import pingoNefrologia from "@/assets/pingo-nefrologia.jpg";
import pingoNeurologia from "@/assets/specialties/pingo-neurologia.webp";
import pingoNutricionista from "@/assets/specialties/pingo-nutricao.webp";
import pingoOncologia from "@/assets/pingo-cirurgiao-onco.jpg";
import pingoOrtopedia from "@/assets/specialties/pingo-ortopedia.webp";
import pingoOtorrino from "@/assets/specialties/pingo-otorrinolaringologia.webp";
import pingoPediatria from "@/assets/specialties/pingo-pediatria.webp";
import pingoPneumologia from "@/assets/specialties/pingo-pneumologia.webp";
import pingoPsiquiatria from "@/assets/pingo-psiquiatra.jpg";
import pingoReumatologia from "@/assets/specialties/pingo-reumatologia.webp";
import pingoUrologia from "@/assets/specialties/pingo-urologia.webp";
import pingoFisioterapia from "@/assets/pingo-fisioterapeuta.jpg";
import pingoFonoaudiologia from "@/assets/specialties/pingo-fonoaudiologia.webp";
import pingoPlastica from "@/assets/pingo-cirurgiao-plastico.jpg";
import pingoVascular from "@/assets/pingo-cirurgiao-vascular.jpg";
import pingoCirurgiaGeral from "@/assets/pingo-cirurgiao-geral.jpg";
import pingoDentista from "@/assets/pingo-cirurgiao-dentista.jpg";
import pingoHomeopata from "@/assets/pingo-homeopata.jpg";

// New spec- prefixed ones
import specAngiologia from "@/assets/spec-angiologia.jpg";
import specColoproctologia from "@/assets/spec-coloproctologia.jpg";
import specHematologia from "@/assets/spec-hematologia.jpg";
import specMastologia from "@/assets/spec-mastologia.jpg";
import specRadiologia from "@/assets/spec-radiologia.jpg";
import specHomeopatia from "@/assets/spec-homeopatia.png";
import specEndoscopia from "@/assets/spec-endoscopia.jpg";
import specMedicoFamilia from "@/assets/spec-medico-familia.jpg";
import specEsporte from "@/assets/spec-esporte.jpg";
import specGenetica from "@/assets/spec-genetica.jpg";
import specIntensiva from "@/assets/spec-intensiva.jpg";
import specCabecaPescoco from "@/assets/spec-cabeca-pescoco.jpg";
import specCardiovascular from "@/assets/spec-cirurgia-cardio.jpg";

export const PINGO_SPECIALTIES: Record<string, string> = {
  "Cardiologia": pingoCardiologia,
  "Neurologia": pingoNeurologia,
  "Pediatria": pingoPediatria,
  "Ortopedia": pingoOrtopedia,
  "Dermatologia": pingoDermatologia,
  "Clínico Geral": pingoClinicoGeral,
  "Clínico geral": pingoClinicoGeral,
  "Endocrinologia": pingoEndocrinologia,
  "Acupuntura": pingoAcupuntura,
  "Alergia e Imunologia": pingoAlergia,
  "Alergologista": pingoAlergia,
  "Angiologia": specAngiologia,
  "Cirurgia Geral": pingoCirurgiaGeral,
  "Coloproctologia": specColoproctologia,
  "Gastroenterologia": pingoGastro,
  "Geriatria": pingoGeriatria,
  "Ginecologia e Obstetrícia": pingoGinecologia,
  "Ginecologista-obstetra": pingoGinecologia,
  "Hematologia": specHematologia,
  "Infectologia": pingoInfectologia,
  "Mastologia": specMastologia,
  "Med. Família": specMedicoFamilia,
  "Médico de família": specMedicoFamilia,
  "Med. do Esporte": specEsporte,
  "Nefrologia": pingoNefrologia,
  "Nutrologia": pingoNutricionista,
  "Nutricionista": pingoNutricionista,
  "Oncologia": pingoOncologia,
  "Otorrinolaringologia": pingoOtorrino,
  "Pneumologia": pingoPneumologia,
  "Psiquiatria": pingoPsiquiatria,
  "Radiologia": specRadiologia,
  "Reumatologia": pingoReumatologia,
  "Urologia": pingoUrologia,
  "Anestesiologia": pingoAnestesiologia,
  "Endoscopia": specEndoscopia,
  "Genética Médica": specGenetica,
  "Homeopatia": pingoHomeopata,
  "Cirurgia Plástica": pingoPlastica,
  "Cir. Cardiovascular": specCardiovascular,
  "Med. Intensiva": specIntensiva,
  "Cir. Cabeça e Pescoço": specCabecaPescoco,
  "Fisioterapia": pingoFisioterapia,
  "Fonoaudiologia": pingoFonoaudiologia,
  "Cirurgia Vascular": pingoVascular,
  "Fisiatra": pingoFisiatra,
  "Cirurgião Dentista": pingoDentista,
};
