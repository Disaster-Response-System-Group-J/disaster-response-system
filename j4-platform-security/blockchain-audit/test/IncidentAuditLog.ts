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

    expect(await auditLog.getEventIdsByCaseId(1)).to.deep.equal([0n]);
    expect(
      await auditLog.getEventIdsByType("MANUAL_INCIDENT_CREATED"),
    ).to.deep.equal([0n]);
  });
});
