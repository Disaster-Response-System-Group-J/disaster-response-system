import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();

describe("IncidentAuditLog", function () {
  it("Should create a manual incident audit event", async function () {
    const auditLog = await ethers.deployContract("IncidentAuditLog");

    await expect(
      auditLog.createManualIncident(
        "evt-001",
        "inc-001",
        "user-001",
        "operator",
        "Colombo",
        "Manual incident created from phone call",
        "corr-001",
      ),
    )
      .to.emit(auditLog, "ManualIncidentCreated")
      .withArgs(1n, 0n, "inc-001", "user-001", "Colombo");

    expect(await auditLog.getEventCount()).to.equal(1n);
    expect(await auditLog.doesCaseExist(1)).to.equal(true);

    const auditEvent = await auditLog.getFunction("getEvent").staticCall(0);

    expect(auditEvent.id).to.equal(0n);
    expect(auditEvent.caseId).to.equal(1n);
    expect(auditEvent.eventType).to.equal("MANUAL_INCIDENT_CREATED");
    expect(auditEvent.incidentId).to.equal("inc-001");
    expect(auditEvent.performedBy).to.equal("user-001");
    expect(auditEvent.performedRole).to.equal("operator");
    expect(auditEvent.previousStatus).to.equal("");
    expect(auditEvent.newStatus).to.equal("new");
    expect(auditEvent.district).to.equal("Colombo");
    expect(auditEvent.metadata).to.equal("");

    expect(await auditLog.getEventIdsByCaseId(1)).to.deep.equal([0n]);
    expect(
      await auditLog.getEventIdsByType("MANUAL_INCIDENT_CREATED"),
    ).to.deep.equal([0n]);
  });

  it("Should log an INCIDENT_ASSIGNED audit event under an existing case", async function () {
    const auditLog = await ethers.deployContract("IncidentAuditLog");

    await auditLog.createManualIncident(
      "evt-001",
      "inc-001",
      "user-001",
      "operator",
      "Colombo",
      "Manual incident created from phone call",
      "corr-001",
    );

    await expect(
      auditLog.logAuditEvent(
        1,
        "evt-002",
        "INCIDENT_ASSIGNED",
        "inc-001",
        "",
        "",
        "user-002",
        "operator",
        "new",
        "assigned",
        "Colombo",
        "Incident assigned to operator user-002",
        "corr-001",
      ),
    )
      .to.emit(auditLog, "AuditEventLogged")
      .withArgs(1n, 1n, "INCIDENT_ASSIGNED", "inc-001", "user-002");

    expect(await auditLog.getEventCount()).to.equal(2n);

    const auditEvent = await auditLog.getFunction("getEvent").staticCall(1);

    expect(auditEvent.id).to.equal(1n);
    expect(auditEvent.caseId).to.equal(1n);
    expect(auditEvent.eventType).to.equal("INCIDENT_ASSIGNED");
    expect(auditEvent.incidentId).to.equal("inc-001");
    expect(auditEvent.performedBy).to.equal("user-002");
    expect(auditEvent.previousStatus).to.equal("new");
    expect(auditEvent.newStatus).to.equal("assigned");
    expect(auditEvent.metadata).to.equal("");

    expect(await auditLog.getEventIdsByCaseId(1)).to.deep.equal([0n, 1n]);
    expect(await auditLog.getEventIdsByType("INCIDENT_ASSIGNED")).to.deep.equal([
      1n,
    ]);
  });

  it("Should store metadata for a manual incident audit event", async function () {
    const auditLog = await ethers.deployContract("IncidentAuditLog");
    const metadata =
      '{"table":"public.ConfirmedIncident","columns":{"title":"Flood in Colombo","disasterType":"FLOOD","severity":"HIGH"}}';

    await auditLog.createManualIncidentWithMetadata(
      "evt-003",
      "inc-003",
      "user-003",
      "operator",
      "Colombo",
      "Manual incident created with DB snapshot",
      "corr-003",
      metadata,
    );

    const auditEvent = await auditLog.getFunction("getEvent").staticCall(0);

    expect(auditEvent.metadata).to.equal(metadata);
  });
});
