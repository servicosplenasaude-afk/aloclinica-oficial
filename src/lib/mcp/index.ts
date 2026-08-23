import { defineMcp } from "@lovable.dev/mcp-js";
import listSpecialties from "./tools/list-specialties";
import searchDoctors from "./tools/search-doctors";
import platformInfo from "./tools/platform-info";

export default defineMcp({
  name: "aloclinica-mcp",
  title: "AloClínica MCP",
  version: "0.1.0",
  instructions:
    "Public read-only tools for the AloClínica telemedicine platform. Use platform_info to introduce the service, list_specialties to discover medical specialties, and search_doctors to find publicly-listed approved doctors. No patient, appointment, or medical-record data is exposed.",
  tools: [platformInfo, listSpecialties, searchDoctors],
});
