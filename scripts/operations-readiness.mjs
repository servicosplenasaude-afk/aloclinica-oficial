import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFile(resolve(root, path), "utf8");
const failures = [];
const checks = [];

function assert(name, condition) {
  checks.push(name);
  if (!condition) failures.push(name);
}

const [compose, envExample, backup, databaseDump, databaseConfig, restore, hostReadiness, hostTimer, dockerDaemon, install, deployRunner, postInstall, remoteDeploy, workflow, monitorWorkflow, health, readme] = await Promise.all([
  read("deploy/operations/compose.yml"),
  read("deploy/operations/.env.example"),
  read("deploy/operations/scripts/backup.sh"),
  read("deploy/operations/scripts/consistent-dump.sh"),
  read("deploy/operations/backup-databases.conf.example"),
  read("deploy/operations/scripts/restore-drill.sh"),
  read("deploy/operations/scripts/host-readiness.sh"),
  read("deploy/operations/systemd/aloclinica-host-readiness.timer"),
  read("deploy/operations/docker-daemon.example.json"),
  read("deploy/operations/scripts/install.sh"),
  read("deploy/operations/scripts/install-deploy-runner.sh"),
  read("deploy/operations/scripts/post-install-check.sh"),
  read("deploy/operations/scripts/remote-deploy.sh"),
  read(".github/workflows/deploy-operations.yml"),
  read(".github/workflows/production-readiness.yml"),
  read("scripts/production-health.mjs"),
  read("deploy/operations/README.md"),
]);

for (const service of ["docker-socket-proxy", "uptime-kuma", "alloy", "crowdsec", "diun", "restic"]) {
  assert(`service ${service}`, compose.includes(`${service}:`));
}
assert("Docker socket is read-only", compose.includes("/var/run/docker.sock:/var/run/docker.sock:ro"));
assert("Only localhost publishes admin ports", !/^\s*-\s*["']?(?!127\.0\.0\.1:)[0-9]+:/m.test(compose));
assert("Containers drop privileges", (compose.match(/no-new-privileges:true/g) ?? []).length >= 5);
assert("Restic source mounts are read-only", ["/etc/easypanel", "/etc/traefik", "/opt/aloclinica", "/var/lib/docker/volumes"].every((p) => compose.includes(`${p}:${p.replace(/^\//, "/backup/").replaceAll("/", "-")}:ro`) || compose.includes(`${p}:/backup/`)));
assert("No latest image tags", !/IMAGE=.*:latest\s*$/m.test(envExample));
assert("R2 repository prepared", envExample.includes("r2.cloudflarestorage.com"));
assert("Retention policy active", backup.includes("forget") && backup.includes("--prune"));
assert("Repository integrity check active", backup.includes("check --read-data-subset"));
assert("Database dumps run before Restic", backup.indexOf("consistent-dump.sh") < backup.indexOf("restic backup"));
assert("Database dumps are catalog-validated", databaseDump.includes("pg_dump --format=custom") && databaseDump.includes("pg_restore --list") && databaseDump.includes("sha256sum"));
assert("Database backup inventory is prepared", databaseConfig.includes("container|usuario|banco"));
assert("Restore drill checks output", restore.includes("restore produced no files"));
assert("Restore drill verifies database checksums", restore.includes("sha256sum --check") && restore.includes("/backup/database-dumps"));
assert("Host audit covers core resources", ["Docker", "disco raiz", "memória", "NTP", "firewall", "SSH", "atualizações automáticas"].every((term) => hostReadiness.includes(term)));
assert("Host audit runs daily", hostTimer.includes("OnCalendar=*-*-* 06:10:00"));
assert("Docker log rotation is prepared", dockerDaemon.includes('"max-size": "20m"') && dockerDaemon.includes('"max-file": "5"'));
assert("Installer is idempotent in target directory", install.includes('SOURCE_REAL') && install.includes('SOURCE_REAL" != "$TARGET_REAL'));
assert("Post-install validates services", ["uptime-kuma", "alloy", "crowdsec", "diun"].every((service) => postInstall.includes(service)));
assert("Remote deploy has rollback trap", remoteDeploy.includes("trap rollback ERR") && remoteDeploy.includes("deployment failed; rolling back"));
assert("Sudo is restricted to root-owned runner", deployRunner.includes("/etc/sudoers.d/aloclinica-operations-deploy") && workflow.includes("/usr/local/libexec/aloclinica-operations-deploy"));
assert("Deployment is manual and protected", workflow.includes("workflow_dispatch:") && workflow.includes("environment: production"));
assert("Deployment verifies SSH host key", workflow.includes("VPS_OPERATIONS_HOST_KEY") && !workflow.includes("StrictHostKeyChecking=no"));
assert("Deployment never echoes protected values", !workflow.includes('echo "$OPERATIONS_ENV_B64"') && !workflow.includes('echo "$RESTIC_PASSWORD_B64"'));
assert("External monitor runs every 15 minutes", monitorWorkflow.includes('cron: "*/15 * * * *"'));
assert("External monitor preserves evidence", monitorWorkflow.includes("actions/upload-artifact@v4") && monitorWorkflow.includes("retention-days: 30"));
assert("External monitor opens and recovers incidents", monitorWorkflow.includes("gh issue create") && monitorWorkflow.includes("gh issue close"));
assert("External monitor cannot overlap", monitorWorkflow.includes("group: production-external-monitor") && monitorWorkflow.includes("cancel-in-progress: false"));
assert("Current face endpoint", health.includes("https://face.aloclinica.com.br/"));
assert("Current WhatsApp endpoint", health.includes("https://whatsapp.telemedicinaaloclinica.sbs/"));
assert("No stale Easypanel endpoints", !health.includes("fqr8ne.easypanel.host"));
assert("Detect-only CrowdSec limitation documented", readme.toLowerCase().includes("detect-only"));

for (const name of checks) console.log(`${failures.includes(name) ? "FAIL" : "PASS"} ${name}`);
if (failures.length) {
  console.error(`Operations readiness failed: ${failures.length} finding(s).`);
  process.exit(1);
}
console.log(`Operations readiness passed: ${checks.length}/${checks.length}.`);
