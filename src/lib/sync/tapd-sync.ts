import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/utils/logger';
import {
  RequirementStatus,
  RequirementPriority,
  RequirementComplexity,
  RequirementSource,
  DefectSeverity,
  DefectStatus,
  WorkHourSource,
  TaskType,
  SyncSource,
  SyncType,
  SyncStatus,
} from '@/generated/prisma/enums';
import {
  getRequirements,
  getDefects,
  getWorkHours,
  type TapdRequirement,
  type TapdDefect,
  type TapdWorkHour,
} from './tapd-client';

// ============================================================
// Status Mapping Helpers
// ============================================================

function mapRequirementStatus(tapdStatus: string): RequirementStatus {
  const status = tapdStatus.toLowerCase();
  if (status === 'draft' || status === 'open') return RequirementStatus.TODO;
  if (status === 'progressing') return RequirementStatus.IN_PROGRESS;
  if (status === 'done' || status === 'closed') return RequirementStatus.DONE;
  if (status === 'reject') return RequirementStatus.REJECTED;
  return RequirementStatus.BLOCKED;
}

function mapRequirementPriority(tapdPriority: string): RequirementPriority {
  const priority = tapdPriority.toLowerCase();
  if (priority === 'urgent' || priority === 'very_high') return RequirementPriority.URGENT;
  if (priority === 'high') return RequirementPriority.HIGH;
  if (priority === 'low') return RequirementPriority.LOW;
  return RequirementPriority.MEDIUM;
}

function mapDefectStatus(tapdStatus: string): DefectStatus {
  const status = tapdStatus.toLowerCase();
  if (status === 'new') return DefectStatus.OPEN;
  if (status === 'in_progress') return DefectStatus.IN_PROGRESS;
  if (status === 'fixed') return DefectStatus.RESOLVED;
  if (status === 'closed') return DefectStatus.CLOSED;
  if (status === 'rejected') return DefectStatus.REJECTED;
  if (status === 'reopened') return DefectStatus.OPEN;
  return DefectStatus.OPEN;
}

function mapDefectSeverity(tapdSeverity: string): DefectSeverity {
  const severity = tapdSeverity.toLowerCase();
  if (severity === 'fatal') return DefectSeverity.FATAL;
  if (severity === 'serious' || severity === 'major') return DefectSeverity.MAJOR;
  if (severity === 'minor' || severity === 'normal') return DefectSeverity.MINOR;
  return DefectSeverity.SUGGESTION;
}

function mapTaskType(tapdTaskType?: string): TaskType {
  if (!tapdTaskType) return TaskType.DEVELOPMENT;
  const type = tapdTaskType.toLowerCase();
  if (type === 'testing' || type === 'test') return TaskType.TESTING;
  if (type === 'review' || type === 'code_review') return TaskType.REVIEW;
  if (type === 'meeting') return TaskType.MEETING;
  return TaskType.DEVELOPMENT;
}

// ============================================================
// Sync Helpers
// ============================================================

async function syncRequirement(
  req: TapdRequirement,
  sprintIdByTapdId: Map<string, string>,
): Promise<void> {
  const localSprintId = sprintIdByTapdId.get(req.iteration_id);
  if (!localSprintId) {
    logger.warn(`Requirement ${req.id}: sprint not found for tapd iteration ${req.iteration_id}, skipping`);
    return;
  }

  await prisma.requirement.upsert({
    where: { tapdId: req.id },
    update: {
      title: req.name,
      status: mapRequirementStatus(req.status),
      priority: mapRequirementPriority(req.priority),
      complexity: RequirementComplexity.MEDIUM,
      createdInTapd: new Date(req.created),
      completedAt: req.completed ? new Date(req.completed) : null,
      source: RequirementSource.TAPD,
      sprintId: localSprintId,
    },
    create: {
      tapdId: req.id,
      title: req.name,
      status: mapRequirementStatus(req.status),
      priority: mapRequirementPriority(req.priority),
      complexity: RequirementComplexity.MEDIUM,
      createdInTapd: new Date(req.created),
      completedAt: req.completed ? new Date(req.completed) : null,
      source: RequirementSource.TAPD,
      sprintId: localSprintId,
    },
  });
}

async function syncDefect(
  defect: TapdDefect,
  sprintIdByTapdId: Map<string, string>,
  projectIdByTapdId: Map<string, string>,
): Promise<void> {
  const localSprintId = sprintIdByTapdId.get(defect.iteration_id);
  if (!localSprintId) {
    logger.warn(`Defect ${defect.id}: sprint not found for tapd iteration ${defect.iteration_id}, skipping`);
    return;
  }

  const localProjectId = projectIdByTapdId.get(defect.workspace_id);
  if (!localProjectId) {
    logger.warn(`Defect ${defect.id}: project not found for tapd workspace ${defect.workspace_id}, skipping`);
    return;
  }

  await prisma.defect.upsert({
    where: { tapdId: defect.id },
    update: {
      title: defect.title,
      severity: mapDefectSeverity(defect.severity),
      status: mapDefectStatus(defect.status),
      createdAt: new Date(defect.created),
      resolvedAt: defect.resolved ? new Date(defect.resolved) : null,
      projectId: localProjectId,
      sprintId: localSprintId,
    },
    create: {
      tapdId: defect.id,
      title: defect.title,
      severity: mapDefectSeverity(defect.severity),
      status: mapDefectStatus(defect.status),
      createdAt: new Date(defect.created),
      resolvedAt: defect.resolved ? new Date(defect.resolved) : null,
      projectId: localProjectId,
      sprintId: localSprintId,
    },
  });
}

async function syncWorkHour(
  wh: TapdWorkHour,
  memberIdByTapdUser: Map<string, string>,
  projectIdByTapdId: Map<string, string>,
  sprintIdByTapdId: Map<string, string>,
): Promise<void> {
  const localMemberId = memberIdByTapdUser.get(wh.owner);
  if (!localMemberId) {
    logger.warn(`WorkHour ${wh.id}: member not found for tapd user ${wh.owner}, skipping`);
    return;
  }

  const localProjectId = projectIdByTapdId.get(wh.workspace_id);
  if (!localProjectId) {
    logger.warn(`WorkHour ${wh.id}: project not found for tapd workspace ${wh.workspace_id}, skipping`);
    return;
  }

  const localSprintId = sprintIdByTapdId.get(wh.iteration_id);
  if (!localSprintId) {
    logger.warn(`WorkHour ${wh.id}: sprint not found for tapd iteration ${wh.iteration_id}, skipping`);
    return;
  }

  const existing = await prisma.workHour.findFirst({
    where: { tapdId: wh.id },
  });

  const workHourData = {
    memberId: localMemberId,
    projectId: localProjectId,
    sprintId: localSprintId,
    date: new Date(wh.entry_date),
    hours: wh.spent,
    taskType: mapTaskType(wh.category),
    source: WorkHourSource.TAPD,
  };

  if (existing) {
    await prisma.workHour.update({
      where: { id: existing.id },
      data: workHourData,
    });
  } else {
    await prisma.workHour.create({
      data: {
        tapdId: wh.id,
        ...workHourData,
      },
    });
  }
}

// ============================================================
// Sync Log Helper
// ============================================================

async function createSyncLog(
  syncType: SyncType,
): Promise<string> {
  const syncLog = await prisma.syncLog.create({
    data: {
      source: SyncSource.TAPD,
      syncType,
      status: SyncStatus.RUNNING,
    },
  });
  return syncLog.id;
}

async function completeSyncLog(
  syncLogId: string,
  recordsCount: number,
  status: SyncStatus,
  errorMessage?: string,
): Promise<void> {
  await prisma.syncLog.update({
    where: { id: syncLogId },
    data: {
      status,
      recordsCount,
      errorMessage,
      finishedAt: new Date(),
    },
  });
}

// ============================================================
// Main Sync Functions
// ============================================================

/**
 * Incremental sync based on the last successful sync time.
 */
export async function incrementalSync(): Promise<{
  syncLogId: string;
  recordsCount: number;
}> {
  logger.info('Starting incremental TAPD sync');

  const syncLogId = await createSyncLog(SyncType.INCREMENTAL);
  let recordsCount = 0;
  let hasError = false;
  let errorMessage = '';

  try {
    // Find the last successful sync time
    const lastSync = await prisma.syncLog.findFirst({
      where: {
        source: SyncSource.TAPD,
        status: SyncStatus.SUCCESS,
      },
      orderBy: { finishedAt: 'desc' },
    });

    const modifiedSince = lastSync?.finishedAt?.toISOString();
    if (modifiedSince) {
      logger.info(`Incremental sync from: ${modifiedSince}`);
    } else {
      logger.info('No previous successful sync found, performing full sync');
    }

    // Build lookup maps for sprint and project IDs
    const sprintIdByTapdId = await buildSprintLookup();
    const projectIdByTapdId = await buildProjectLookup();
    const memberIdByTapdUser = await buildMemberLookup();

    // Sync requirements
    const requirements = await getRequirements(modifiedSince);
    for (const req of requirements) {
      try {
        await syncRequirement(req, sprintIdByTapdId);
        recordsCount++;
      } catch (err) {
        hasError = true;
        const msg = err instanceof Error ? err.message : String(err);
        errorMessage += `Requirement ${req.id}: ${msg}; `;
        logger.error(`Failed to sync requirement ${req.id}`, { error: msg });
      }
    }

    // Sync defects
    const defects = await getDefects(modifiedSince);
    for (const defect of defects) {
      try {
        await syncDefect(defect, sprintIdByTapdId, projectIdByTapdId);
        recordsCount++;
      } catch (err) {
        hasError = true;
        const msg = err instanceof Error ? err.message : String(err);
        errorMessage += `Defect ${defect.id}: ${msg}; `;
        logger.error(`Failed to sync defect ${defect.id}`, { error: msg });
      }
    }

    // Sync work hours
    const workHours = await getWorkHours(modifiedSince);
    for (const wh of workHours) {
      try {
        await syncWorkHour(wh, memberIdByTapdUser, projectIdByTapdId, sprintIdByTapdId);
        recordsCount++;
      } catch (err) {
        hasError = true;
        const msg = err instanceof Error ? err.message : String(err);
        errorMessage += `WorkHour ${wh.id}: ${msg}; `;
        logger.error(`Failed to sync work hour ${wh.id}`, { error: msg });
      }
    }

    const finalStatus = hasError ? SyncStatus.FAILED : SyncStatus.SUCCESS;
    await completeSyncLog(syncLogId, recordsCount, finalStatus, hasError ? errorMessage : undefined);

    logger.info(`Incremental sync completed: ${recordsCount} records synced`);
    return { syncLogId, recordsCount };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('Incremental sync failed', { error: msg });
    await completeSyncLog(syncLogId, recordsCount, SyncStatus.FAILED, msg);
    throw err;
  }
}

/**
 * Full sync of all TAPD data.
 */
export async function fullSync(): Promise<{
  syncLogId: string;
  recordsCount: number;
}> {
  logger.info('Starting full TAPD sync');

  const syncLogId = await createSyncLog(SyncType.FULL);
  let recordsCount = 0;
  let hasError = false;
  let errorMessage = '';

  try {
    // Build lookup maps for sprint and project IDs
    const sprintIdByTapdId = await buildSprintLookup();
    const projectIdByTapdId = await buildProjectLookup();
    const memberIdByTapdUser = await buildMemberLookup();

    // Sync requirements (no modifiedSince filter)
    const requirements = await getRequirements();
    for (const req of requirements) {
      try {
        await syncRequirement(req, sprintIdByTapdId);
        recordsCount++;
      } catch (err) {
        hasError = true;
        const msg = err instanceof Error ? err.message : String(err);
        errorMessage += `Requirement ${req.id}: ${msg}; `;
        logger.error(`Failed to sync requirement ${req.id}`, { error: msg });
      }
    }

    // Sync defects (no modifiedSince filter)
    const defects = await getDefects();
    for (const defect of defects) {
      try {
        await syncDefect(defect, sprintIdByTapdId, projectIdByTapdId);
        recordsCount++;
      } catch (err) {
        hasError = true;
        const msg = err instanceof Error ? err.message : String(err);
        errorMessage += `Defect ${defect.id}: ${msg}; `;
        logger.error(`Failed to sync defect ${defect.id}`, { error: msg });
      }
    }

    // Sync work hours (no modifiedSince filter)
    const workHours = await getWorkHours();
    for (const wh of workHours) {
      try {
        await syncWorkHour(wh, memberIdByTapdUser, projectIdByTapdId, sprintIdByTapdId);
        recordsCount++;
      } catch (err) {
        hasError = true;
        const msg = err instanceof Error ? err.message : String(err);
        errorMessage += `WorkHour ${wh.id}: ${msg}; `;
        logger.error(`Failed to sync work hour ${wh.id}`, { error: msg });
      }
    }

    const finalStatus = hasError ? SyncStatus.FAILED : SyncStatus.SUCCESS;
    await completeSyncLog(syncLogId, recordsCount, finalStatus, hasError ? errorMessage : undefined);

    logger.info(`Full sync completed: ${recordsCount} records synced`);
    return { syncLogId, recordsCount };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('Full sync failed', { error: msg });
    await completeSyncLog(syncLogId, recordsCount, SyncStatus.FAILED, msg);
    throw err;
  }
}

// ============================================================
// Lookup Map Builders
// ============================================================

/**
 * Build a map from TAPD iteration ID to local Sprint ID.
 * Uses Sprint records that have a matching tapdId stored in a custom field or name pattern.
 * Falls back to using the Sprint name if tapdId is not directly available.
 */
async function buildSprintLookup(): Promise<Map<string, string>> {
  const sprints = await prisma.sprint.findMany({
    select: { id: true, name: true },
  });

  const map = new Map<string, string>();
  for (const sprint of sprints) {
    // Sprint names may contain TAPD iteration IDs or we use the sprint name as key
    map.set(sprint.name, sprint.id);
  }
  return map;
}

/**
 * Build a map from TAPD workspace ID to local Project ID.
 * Uses the project code field to match TAPD workspace IDs.
 */
async function buildProjectLookup(): Promise<Map<string, string>> {
  const projects = await prisma.project.findMany({
    select: { id: true, code: true },
  });

  const map = new Map<string, string>();
  for (const project of projects) {
    map.set(project.code, project.id);
  }
  return map;
}

/**
 * Build a map from TAPD username to local Member ID.
 * Uses the employee number or name to match TAPD users.
 */
async function buildMemberLookup(): Promise<Map<string, string>> {
  const members = await prisma.member.findMany({
    select: { id: true, name: true, employeeNo: true },
  });

  const map = new Map<string, string>();
  for (const member of members) {
    map.set(member.name, member.id);
    map.set(member.employeeNo, member.id);
  }
  return map;
}
