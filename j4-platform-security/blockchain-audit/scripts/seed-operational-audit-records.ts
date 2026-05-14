type ApiResponse<T> = {
  success: boolean;
  data: T | null;
  error: string | null;
};

type CreateCaseResult = {
  caseId: string;
  auditEventId: string;
  eventType: string;
  incidentId: string;
  transactionHash: string;
};

type LogEventResult = {
  caseId: string;
  auditEventId: string;
  eventType: string;
  incidentId: string;
  transactionHash: string;
};

type CreateCasePayload = {
  eventId: string;
  incidentId: string;
  performedBy: string;
  performedRole: string;
  district: string;
  notes: string;
  correlationId: string;
  metadata: string;
};

type LogEventPayload = {
  caseId: string;
  eventId: string;
  eventType: string;
  incidentId: string;
  resourceId: string;
  alertId: string;
  performedBy: string;
  performedRole: string;
  previousStatus: string;
  newStatus: string;
  district: string;
  notes: string;
  correlationId: string;
  metadata: string;
};

const auditApiBaseUrl =
  process.env.AUDIT_API_BASE_URL || "http://localhost:8084/api/v1/audit";

const retryCount = Number(process.env.AUDIT_SEED_RETRY_COUNT || 30);
const retryDelayMs = Number(process.env.AUDIT_SEED_RETRY_DELAY_MS || 3000);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function urlFor(path: string): string {
  return `${auditApiBaseUrl.replace(/\/$/, "")}${path}`;
}

function buildMetadata(table: string, columns: Record<string, unknown>): string {
  return JSON.stringify({
    table,
    columns,
  });
}

async function readResponseBody(response: Response): Promise<string> {
  const text = await response.text();
  return text || "<empty response body>";
}

async function postJson<T>(path: string, body: object): Promise<T> {
  const url = urlFor(path);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const responseBody = await readResponseBody(response);

  if (!response.ok) {
    throw new Error(
      [
        "Audit API request failed",
        `Request URL: ${url}`,
        `Status code: ${response.status}`,
        `Response body: ${responseBody}`,
      ].join("\n"),
    );
  }

  const parsed = JSON.parse(responseBody) as ApiResponse<T>;

  if (!parsed.success || !parsed.data) {
    throw new Error(
      [
        "Audit API returned an error response",
        `Request URL: ${url}`,
        `Status code: ${response.status}`,
        `Response body: ${responseBody}`,
      ].join("\n"),
    );
  }

  return parsed.data;
}

async function waitForAuditApi(): Promise<void> {
  console.log("Waiting for audit API...");

  const url = urlFor("/cases");

  for (let attempt = 1; attempt <= retryCount; attempt += 1) {
    try {
      const response = await fetch(url);

      if (response.ok) {
        return;
      }

      const responseBody = await readResponseBody(response);
      console.log(
        `Audit API not ready yet (${attempt}/${retryCount}). Status ${response.status}: ${responseBody}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(
        `Audit API not ready yet (${attempt}/${retryCount}). ${message}`,
      );
    }

    await sleep(retryDelayMs);
  }

  throw new Error(
    `Audit API was not reachable after ${retryCount} attempts. Request URL: ${url}`,
  );
}

async function createCase(payload: CreateCasePayload): Promise<string> {
  const result = await postJson<CreateCaseResult>("/cases", payload);
  console.log(`Created blockchain caseId: ${result.caseId}`);
  return result.caseId;
}

async function logEvent(payload: LogEventPayload): Promise<void> {
  await postJson<LogEventResult>("/events", payload);
}

async function seedOperationalAuditRecords(): Promise<void> {
  await waitForAuditApi();

  console.log("Creating operational incident audit records...");

  const caseId1 = await createCase({
    eventId: "evt-col-flood-001",
    incidentId: "INC-COL-2026-001",
    performedBy: "operator_01",
    performedRole: "operator",
    district: "Colombo",
    notes: "Flood reported by phone call from Wellampitiya area",
    correlationId: "corr-col-flood-001",
    metadata: buildMetadata("public.ConfirmedIncident", {
      id: "INC-COL-2026-001",
      title: "Flood reported in Wellampitiya",
      disasterType: "FLOOD",
      district: "Colombo",
      severity: "HIGH",
      status: "ACTIVE",
      latitude: 6.9438,
      longitude: 79.8989,
      description: "Flood reported by phone call from Wellampitiya area",
      publicVisibility: true,
      affectedPeople: 42,
      division_id: null,
      blockchain_case_id: null,
    }),
  });

  console.log("Logging resource assignment...");
  await logEvent({
    caseId: caseId1,
    eventId: "evt-col-flood-002",
    eventType: "RESOURCE_ASSIGNED",
    incidentId: "INC-COL-2026-001",
    resourceId: "AMB-COL-003",
    alertId: "",
    performedBy: "dispatcher_01",
    performedRole: "dispatcher",
    previousStatus: "assigned",
    newStatus: "resource_allocated",
    district: "Colombo",
    notes: "Ambulance AMB-COL-003 assigned to flood response",
    correlationId: "corr-col-flood-001",
    metadata: buildMetadata("public.ResourceRequest", {
      incident_id: "INC-COL-2026-001",
      resource_id: "AMB-COL-003",
      resource_type: "AMBULANCE",
      status: "APPROVED",
      reviewed_by: "dispatcher_01",
    }),
  });

  console.log("Logging rescue dispatch...");
  await logEvent({
    caseId: caseId1,
    eventId: "evt-col-flood-003",
    eventType: "RESCUE_DISPATCHED",
    incidentId: "INC-COL-2026-001",
    resourceId: "AMB-COL-003",
    alertId: "",
    performedBy: "dispatcher_01",
    performedRole: "dispatcher",
    previousStatus: "resource_allocated",
    newStatus: "dispatched",
    district: "Colombo",
    notes: "Ambulance dispatched to Wellampitiya flood affected area",
    correlationId: "corr-col-flood-001",
    metadata: buildMetadata("public.LogisticsDeployment", {
      incident_id: "INC-COL-2026-001",
      resource_id: "AMB-COL-003",
      deployment_status: "EN_ROUTE",
      dispatched_by: "dispatcher_01",
    }),
  });

  console.log("Logging resource deallocation...");
  await logEvent({
    caseId: caseId1,
    eventId: "evt-col-flood-004",
    eventType: "RESOURCE_DEALLOCATED",
    incidentId: "INC-COL-2026-001",
    resourceId: "AMB-COL-003",
    alertId: "",
    performedBy: "supervisor_01",
    performedRole: "supervisor",
    previousStatus: "dispatched",
    newStatus: "available",
    district: "Colombo",
    notes: "Ambulance released after completing flood response task",
    correlationId: "corr-col-flood-001",
    metadata: buildMetadata("public.DeployableAsset", {
      resource_id: "AMB-COL-003",
      previous_status: "DISPATCHED",
      new_status: "AVAILABLE",
      released_by: "supervisor_01",
    }),
  });

  const caseId2 = await createCase({
    eventId: "evt-kan-landslide-001",
    incidentId: "INC-KAN-2026-002",
    performedBy: "operator_02",
    performedRole: "operator",
    district: "Kandy",
    notes: "Landslide reported by field officer near Kadugannawa",
    correlationId: "corr-kan-landslide-002",
    metadata: buildMetadata("public.ConfirmedIncident", {
      id: "INC-KAN-2026-002",
      title: "Landslide near Kadugannawa",
      disasterType: "LANDSLIDE",
      district: "Kandy",
      severity: "CRITICAL",
      status: "ACTIVE",
      latitude: 7.2569,
      longitude: 80.5271,
      description: "Landslide reported by field officer near Kadugannawa",
      publicVisibility: true,
      affectedPeople: 18,
      division_id: null,
      blockchain_case_id: null,
    }),
  });

  console.log("Logging resource assignment...");
  await logEvent({
    caseId: caseId2,
    eventId: "evt-kan-landslide-002",
    eventType: "RESOURCE_ASSIGNED",
    incidentId: "INC-KAN-2026-002",
    resourceId: "TEAM-KAN-RES-002",
    alertId: "",
    performedBy: "dispatcher_02",
    performedRole: "dispatcher",
    previousStatus: "assigned",
    newStatus: "resource_allocated",
    district: "Kandy",
    notes: "Rescue team TEAM-KAN-RES-002 assigned to landslide incident",
    correlationId: "corr-kan-landslide-002",
    metadata: buildMetadata("public.PersonnelAssignment", {
      incident_id: "INC-KAN-2026-002",
      resource_id: "TEAM-KAN-RES-002",
      assigned_role: "RESCUE_TEAM",
      status: "ASSIGNED",
      assigned_by: "dispatcher_02",
    }),
  });

  console.log("Logging rescue dispatch...");
  await logEvent({
    caseId: caseId2,
    eventId: "evt-kan-landslide-003",
    eventType: "RESCUE_DISPATCHED",
    incidentId: "INC-KAN-2026-002",
    resourceId: "TEAM-KAN-RES-002",
    alertId: "",
    performedBy: "dispatcher_02",
    performedRole: "dispatcher",
    previousStatus: "resource_allocated",
    newStatus: "dispatched",
    district: "Kandy",
    notes: "Rescue team dispatched to Kadugannawa landslide location",
    correlationId: "corr-kan-landslide-002",
    metadata: buildMetadata("public.LogisticsDeployment", {
      incident_id: "INC-KAN-2026-002",
      resource_id: "TEAM-KAN-RES-002",
      deployment_status: "EN_ROUTE",
      dispatched_by: "dispatcher_02",
    }),
  });

  console.log("Logging resource deallocation...");
  await logEvent({
    caseId: caseId2,
    eventId: "evt-kan-landslide-004",
    eventType: "RESOURCE_DEALLOCATED",
    incidentId: "INC-KAN-2026-002",
    resourceId: "TEAM-KAN-RES-002",
    alertId: "",
    performedBy: "supervisor_02",
    performedRole: "supervisor",
    previousStatus: "dispatched",
    newStatus: "available",
    district: "Kandy",
    notes: "Rescue team released after landslide response was completed",
    correlationId: "corr-kan-landslide-002",
    metadata: buildMetadata("public.DeployableAsset", {
      resource_id: "TEAM-KAN-RES-002",
      previous_status: "DISPATCHED",
      new_status: "AVAILABLE",
      released_by: "supervisor_02",
    }),
  });

  const caseId3 = await createCase({
    eventId: "evt-gal-coastal-001",
    incidentId: "INC-GAL-2026-003",
    performedBy: "operator_03",
    performedRole: "operator",
    district: "Galle",
    notes: "Coastal flooding reported near Galle Fort area",
    correlationId: "corr-gal-coastal-003",
    metadata: buildMetadata("public.ConfirmedIncident", {
      id: "INC-GAL-2026-003",
      title: "Coastal flooding near Galle Fort",
      disasterType: "FLOOD",
      district: "Galle",
      severity: "MEDIUM",
      status: "ACTIVE",
      latitude: 6.0329,
      longitude: 80.2168,
      description: "Coastal flooding reported near Galle Fort area",
      publicVisibility: true,
      affectedPeople: 27,
      division_id: null,
      blockchain_case_id: null,
    }),
  });

  console.log("Logging resource assignment...");
  await logEvent({
    caseId: caseId3,
    eventId: "evt-gal-coastal-002",
    eventType: "RESOURCE_ASSIGNED",
    incidentId: "INC-GAL-2026-003",
    resourceId: "BOAT-GAL-001",
    alertId: "",
    performedBy: "dispatcher_03",
    performedRole: "dispatcher",
    previousStatus: "assigned",
    newStatus: "resource_allocated",
    district: "Galle",
    notes: "Rescue boat BOAT-GAL-001 assigned to coastal flooding incident",
    correlationId: "corr-gal-coastal-003",
    metadata: buildMetadata("public.ResourceRequest", {
      incident_id: "INC-GAL-2026-003",
      resource_id: "BOAT-GAL-001",
      resource_type: "BOAT",
      status: "APPROVED",
      reviewed_by: "dispatcher_03",
    }),
  });

  console.log("Logging rescue dispatch...");
  await logEvent({
    caseId: caseId3,
    eventId: "evt-gal-coastal-003",
    eventType: "RESCUE_DISPATCHED",
    incidentId: "INC-GAL-2026-003",
    resourceId: "BOAT-GAL-001",
    alertId: "",
    performedBy: "dispatcher_03",
    performedRole: "dispatcher",
    previousStatus: "resource_allocated",
    newStatus: "dispatched",
    district: "Galle",
    notes: "Rescue boat dispatched to assist coastal flooding response",
    correlationId: "corr-gal-coastal-003",
    metadata: buildMetadata("public.LogisticsDeployment", {
      incident_id: "INC-GAL-2026-003",
      resource_id: "BOAT-GAL-001",
      deployment_status: "EN_ROUTE",
      dispatched_by: "dispatcher_03",
    }),
  });

  console.log("Logging resource assignment...");
  await logEvent({
    caseId: caseId3,
    eventId: "evt-gal-coastal-004",
    eventType: "RESOURCE_ASSIGNED",
    incidentId: "INC-GAL-2026-003",
    resourceId: "SUP-GAL-004",
    alertId: "",
    performedBy: "dispatcher_03",
    performedRole: "dispatcher",
    previousStatus: "dispatched",
    newStatus: "additional_resource_allocated",
    district: "Galle",
    notes: "Emergency supply unit assigned for temporary relief support",
    correlationId: "corr-gal-coastal-003",
    metadata: buildMetadata("public.ResourceRequest", {
      incident_id: "INC-GAL-2026-003",
      resource_id: "SUP-GAL-004",
      resource_type: "EMERGENCY_SUPPLY",
      status: "APPROVED",
      reviewed_by: "dispatcher_03",
    }),
  });

  console.log("Logging resource deallocation...");
  await logEvent({
    caseId: caseId3,
    eventId: "evt-gal-coastal-005",
    eventType: "RESOURCE_DEALLOCATED",
    incidentId: "INC-GAL-2026-003",
    resourceId: "BOAT-GAL-001",
    alertId: "",
    performedBy: "supervisor_03",
    performedRole: "supervisor",
    previousStatus: "dispatched",
    newStatus: "available",
    district: "Galle",
    notes: "Rescue boat released after coastal flooding response was completed",
    correlationId: "corr-gal-coastal-003",
    metadata: buildMetadata("public.DeployableAsset", {
      resource_id: "BOAT-GAL-001",
      previous_status: "DISPATCHED",
      new_status: "AVAILABLE",
      released_by: "supervisor_03",
    }),
  });

  console.log("Operational audit records seeded successfully.");
}

seedOperationalAuditRecords().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
