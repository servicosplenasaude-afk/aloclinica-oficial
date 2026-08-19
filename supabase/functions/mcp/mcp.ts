import { defineMcp } from "npm:@lovable.dev/mcp-js@0.20.1";
import listSpecialties from "./tools/list-specialties.ts";
import platformInfo from "./tools/platform-info.ts";
import searchDoctors from "./tools/search-doctors.ts";

export default defineMcp({
  name: "aloclinica-mcp",
  title: "AloClínica MCP",
  version: "0.1.0",
  instructions:
    "Public read-only tools for the AloClínica telemedicine platform. Use platform_info to introduce the service, list_specialties to discover medical specialties, and search_doctors to find publicly-listed approved doctors. No patient, appointment, or medical-record data is exposed.",
  tools: [platformInfo, listSpecialties, searchDoctors],
});
