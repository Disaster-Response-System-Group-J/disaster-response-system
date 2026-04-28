// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

contract IncidentAuditLog {

  //AuditEvent struct to store details of each audit event
  struct AuditEvent {
    uint256 id;
    uint256 caseId;
    string eventId;
    string eventType;
    string incidentId;
    string resourceId;
    string alertId;
    string performedBy;
    string performedRole;
    string previousStatus;
    string newStatus;
    string district;
    string notes;
    string correlationId;
    uint256 timestamp;
  }

  // Array to store all audit events
  AuditEvent[] private auditEvents;
  uint256 private nextCaseId = 1;

  // Mapping to track existing caseIds
  mapping(uint256 => bool) private caseExists;  
  // Mapping from caseId to array of auditEventIds
  mapping(uint256 => uint256[]) private eventIdsByCaseId;
  // Mapping from eventType to array of auditEventIds 
  mapping(string => uint256[]) private eventIdsByType; 

  event ManualIncidentCreated(
    uint256 indexed caseId,
    uint256 indexed auditEventId,
    string incidentId,
    string performedBy,
    string district
  );

  event AuditEventLogged(
    uint256 indexed caseId,
    uint256 indexed auditEventId,
    string eventType,
    string incidentId,
    string performedBy
  );

  function createManualIncident(
    string memory eventId,
    string memory incidentId,
    string memory performedBy,
    string memory performedRole,
    string memory district,
    string memory notes,
    string memory correlationId
  ) public returns (uint256 caseId, uint256 auditEventId) {
    caseId = nextCaseId;
    nextCaseId++;
    caseExists[caseId] = true;

    auditEventId = auditEvents.length;
    auditEvents.push();

    {
      AuditEvent storage auditEvent = auditEvents[auditEventId];
      auditEvent.id = auditEventId;
      auditEvent.caseId = caseId;
      auditEvent.eventId = eventId;
      auditEvent.eventType = "MANUAL_INCIDENT_CREATED";
      auditEvent.incidentId = incidentId;
      auditEvent.resourceId = "";
      auditEvent.alertId = "";
      auditEvent.performedBy = performedBy;
      auditEvent.performedRole = performedRole;
      auditEvent.previousStatus = "";
      auditEvent.newStatus = "new";
      auditEvent.district = district;
      auditEvent.notes = notes;
      auditEvent.correlationId = correlationId;
      auditEvent.timestamp = block.timestamp;
    }

    eventIdsByCaseId[caseId].push(auditEventId);
    eventIdsByType["MANUAL_INCIDENT_CREATED"].push(auditEventId);

    emit ManualIncidentCreated(
      caseId,
      auditEventId,
      incidentId,
      performedBy,
      district
    );

    emit AuditEventLogged(
      caseId,
      auditEventId,
      "MANUAL_INCIDENT_CREATED",
      incidentId,
      performedBy
    );
  }

  function logAuditEvent(
    uint256 caseId,
    string memory eventId,
    string memory eventType,
    string memory incidentId,
    string memory resourceId,
    string memory alertId,
    string memory performedBy,
    string memory performedRole,
    string memory previousStatus,
    string memory newStatus,
    string memory district,
    string memory notes,
    string memory correlationId
  ) public returns (uint256 auditEventId) {
    require(caseExists[caseId], "logAuditEvent: caseId does not exist");

    auditEventId = auditEvents.length;
    auditEvents.push();

    {
      AuditEvent storage auditEvent = auditEvents[auditEventId];
      auditEvent.id = auditEventId;
      auditEvent.caseId = caseId;
      auditEvent.eventId = eventId;
      auditEvent.eventType = eventType;
      auditEvent.incidentId = incidentId;
      auditEvent.resourceId = resourceId;
      auditEvent.alertId = alertId;
      auditEvent.performedBy = performedBy;
      auditEvent.performedRole = performedRole;
      auditEvent.previousStatus = previousStatus;
      auditEvent.newStatus = newStatus;
      auditEvent.district = district;
      auditEvent.notes = notes;
      auditEvent.correlationId = correlationId;
      auditEvent.timestamp = block.timestamp;
    }

    eventIdsByCaseId[caseId].push(auditEventId);
    eventIdsByType[eventType].push(auditEventId);

    emit AuditEventLogged(
      caseId,
      auditEventId,
      eventType,
      incidentId,
      performedBy
    );
  }

  function getEvent(
    uint256 auditEventId
  ) public view returns (AuditEvent memory) {
    require(auditEventId < auditEvents.length, "getEvent: auditEventId does not exist");
    return auditEvents[auditEventId];
  }

  function getEventCount() public view returns (uint256) {
    return auditEvents.length;
  }

  function getEventIdsByCaseId(
    uint256 caseId
  ) public view returns (uint256[] memory) {
    return eventIdsByCaseId[caseId];
  }

  function getEventIdsByType(
    string memory eventType
  ) public view returns (uint256[] memory) {
    return eventIdsByType[eventType];
  }

  function doesCaseExist(uint256 caseId) public view returns (bool) {
    return caseExists[caseId];
  }
}
