-- CreateTable
CREATE TABLE "organization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "parent_id" TEXT,
    "level" TEXT NOT NULL DEFAULT 'DEPARTMENT',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "organization_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "organization" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "team" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "leader_id" TEXT,
    "tech_stack" TEXT NOT NULL DEFAULT '[]',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "team_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "team_leader_id_fkey" FOREIGN KEY ("leader_id") REFERENCES "member" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "member" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "employee_no" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "level" TEXT NOT NULL DEFAULT 'P1',
    "skills" TEXT NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "joined_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "member_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'INTERNAL',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'PLANNING',
    "health" TEXT NOT NULL DEFAULT 'HEALTHY',
    "progress" REAL NOT NULL DEFAULT 0,
    "delay_days" INTEGER NOT NULL DEFAULT 0,
    "resource_rate" REAL NOT NULL DEFAULT 0,
    "start_date" DATETIME,
    "end_date" DATETIME,
    "owner_id" TEXT,
    "team_id" TEXT NOT NULL,
    "budget" REAL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'REGULAR',
    "okr_name" TEXT NOT NULL DEFAULT '',
    "partner" TEXT NOT NULL DEFAULT '',
    "po" TEXT NOT NULL DEFAULT '',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "project_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "member" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "project_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "project_okr" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "project_id" TEXT NOT NULL,
    "okr_code" TEXT NOT NULL,
    "okr_name" TEXT NOT NULL,
    "quarter" TEXT NOT NULL,
    "target_percent" REAL NOT NULL DEFAULT 0,
    "actual_percent" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "project_okr_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "project_cost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "project_id" TEXT NOT NULL,
    "quarter" TEXT NOT NULL,
    "labor_cost" REAL NOT NULL DEFAULT 0,
    "infra_cost" REAL NOT NULL DEFAULT 0,
    "external_cost" REAL NOT NULL DEFAULT 0,
    "total_cost" REAL NOT NULL DEFAULT 0,
    "target" TEXT NOT NULL DEFAULT '',
    "data_source" TEXT NOT NULL DEFAULT 'manual',
    CONSTRAINT "project_cost_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "project_roi" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "project_id" TEXT NOT NULL,
    "quarter" TEXT NOT NULL,
    "revenue" REAL NOT NULL DEFAULT 0,
    "cost_saving" REAL NOT NULL DEFAULT 0,
    "efficiency_gain" REAL NOT NULL DEFAULT 0,
    "total_benefit" REAL NOT NULL DEFAULT 0,
    "total_cost" REAL NOT NULL DEFAULT 0,
    "roi_percent" REAL NOT NULL DEFAULT 0,
    "target_roi" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "project_roi_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "project_milestone" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "project_id" TEXT NOT NULL,
    "quarter" TEXT NOT NULL,
    "target" TEXT NOT NULL DEFAULT '',
    "achievement" TEXT NOT NULL DEFAULT '',
    "progress" REAL NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "project_milestone_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "efficiency_score" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "period_type" TEXT NOT NULL,
    "period_value" TEXT NOT NULL,
    "delivery_score" REAL NOT NULL DEFAULT 0,
    "quality_score" REAL NOT NULL DEFAULT 0,
    "completion_rate" REAL NOT NULL DEFAULT 0,
    "defect_score" REAL NOT NULL DEFAULT 0,
    "total_score" REAL NOT NULL DEFAULT 0,
    "rank" INTEGER,
    "computed_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "efficiency_config" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "config_type" TEXT NOT NULL,
    "config_key" TEXT NOT NULL,
    "config_value" TEXT NOT NULL,
    "updated_by" TEXT,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "sprint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLANNING',
    "start_date" DATETIME NOT NULL,
    "end_date" DATETIME NOT NULL,
    "plan_count" INTEGER NOT NULL DEFAULT 0,
    "completed_count" INTEGER NOT NULL DEFAULT 0,
    "health_score" REAL,
    CONSTRAINT "sprint_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "requirement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tapd_id" TEXT,
    "sprint_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'TODO',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "complexity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "assignee_id" TEXT,
    "created_in_tapd" DATETIME,
    "completed_at" DATETIME,
    "blocked_days" INTEGER NOT NULL DEFAULT 0,
    "lead_time" INTEGER,
    "source" TEXT NOT NULL DEFAULT 'TAPD',
    CONSTRAINT "requirement_sprint_id_fkey" FOREIGN KEY ("sprint_id") REFERENCES "sprint" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "requirement_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "member" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "work_hour" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tapd_id" TEXT,
    "member_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "sprint_id" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "hours" REAL NOT NULL DEFAULT 0,
    "task_type" TEXT NOT NULL DEFAULT 'DEVELOPMENT',
    "source" TEXT NOT NULL DEFAULT 'TAPD',
    CONSTRAINT "work_hour_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "member" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "work_hour_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "work_hour_sprint_id_fkey" FOREIGN KEY ("sprint_id") REFERENCES "sprint" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "defect" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tapd_id" TEXT,
    "project_id" TEXT NOT NULL,
    "sprint_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'MINOR',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "reporter_id" TEXT,
    "assignee_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" DATETIME,
    "resolution_hours" REAL,
    CONSTRAINT "defect_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "defect_sprint_id_fkey" FOREIGN KEY ("sprint_id") REFERENCES "sprint" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "defect_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "member" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "defect_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "member" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "user_account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "member_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "last_login" DATETIME,
    CONSTRAINT "user_account_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "member" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sync_log" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL DEFAULT 'TAPD',
    "sync_type" TEXT NOT NULL DEFAULT 'INCREMENTAL',
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "records_count" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "started_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" DATETIME
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" TEXT NOT NULL,
    "detail" TEXT NOT NULL DEFAULT '{}',
    "ip_address" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "project_mapping" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "project_id" TEXT NOT NULL,
    "tapd_belonging" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "project_mapping_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "team_config" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "tapd_project_ids" TEXT NOT NULL DEFAULT '[]',
    "enable_team_ranking" BOOLEAN NOT NULL DEFAULT true,
    "enable_hr_ranking" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "system_setting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "tapd_story" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL,
    "priority" TEXT,
    "priority_label" TEXT,
    "owner" TEXT,
    "cc" TEXT DEFAULT '',
    "creator" TEXT,
    "developer" TEXT,
    "created" DATETIME,
    "modified" DATETIME,
    "completed" DATETIME,
    "begin" DATETIME,
    "due" DATETIME,
    "effort" REAL,
    "effort_completed" REAL,
    "remain" REAL,
    "exceed" REAL,
    "workspace_id" TEXT NOT NULL,
    "workspace_name" TEXT,
    "iteration_id" TEXT,
    "iteration_name" TEXT,
    "version" TEXT,
    "module" TEXT,
    "feature" TEXT,
    "test_focus" TEXT,
    "size" INTEGER,
    "business_value" INTEGER,
    "category_id" TEXT,
    "release_id" TEXT,
    "source" TEXT,
    "type" TEXT,
    "label" TEXT,
    "workitem_type_id" TEXT,
    "parent_id" TEXT,
    "children_id" TEXT,
    "ancestor_id" TEXT,
    "is_archived" BOOLEAN DEFAULT false,
    "confidential" BOOLEAN DEFAULT false,
    "level" INTEGER,
    "bug_id" TEXT,
    "templated_id" TEXT,
    "created_from" TEXT,
    "custom_field_one" TEXT,
    "custom_field_two" TEXT,
    "custom_field_three" TEXT,
    "custom_field_four" TEXT,
    "custom_field_five" TEXT,
    "custom_field_six" TEXT,
    "custom_field_seven" TEXT,
    "custom_field_eight" TEXT,
    "custom_field_9" TEXT,
    "custom_field_10" TEXT,
    "custom_field_11" TEXT,
    "custom_field_12" TEXT,
    "custom_field_13" TEXT,
    "custom_field_14" TEXT,
    "custom_field_15" TEXT,
    "custom_field_16" TEXT,
    "custom_field_17" TEXT,
    "custom_field_18" TEXT,
    "custom_field_19" TEXT,
    "custom_field_20" TEXT,
    "extra_data" JSONB,
    "raw_json" JSONB,
    "synced_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "tapd_task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL,
    "priority" TEXT,
    "priority_label" TEXT,
    "owner" TEXT,
    "cc" TEXT DEFAULT '',
    "creator" TEXT,
    "created" DATETIME,
    "modified" DATETIME,
    "completed" DATETIME,
    "begin" DATETIME,
    "due" DATETIME,
    "effort" REAL,
    "effort_completed" REAL,
    "remain" REAL,
    "exceed" REAL,
    "progress" INTEGER,
    "story_id" TEXT,
    "workspace_id" TEXT NOT NULL,
    "iteration_id" TEXT,
    "release_id" TEXT,
    "label" TEXT,
    "has_attachment" BOOLEAN DEFAULT false,
    "custom_field_one" TEXT,
    "custom_field_two" TEXT,
    "custom_field_three" TEXT,
    "custom_field_four" TEXT,
    "custom_field_five" TEXT,
    "custom_field_six" TEXT,
    "custom_field_seven" TEXT,
    "custom_field_eight" TEXT,
    "custom_field_9" TEXT,
    "custom_field_10" TEXT,
    "extra_data" JSONB,
    "raw_json" JSONB,
    "synced_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "tapd_iteration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "description" TEXT,
    "start_date" DATETIME,
    "end_date" DATETIME,
    "status" TEXT,
    "creator" TEXT,
    "created" DATETIME,
    "modified" DATETIME,
    "completed" DATETIME,
    "locker" TEXT,
    "workitem_type_id" TEXT,
    "plan_app_id" TEXT,
    "release_id" TEXT,
    "custom_field_1" TEXT,
    "custom_field_2" TEXT,
    "custom_field_3" TEXT,
    "custom_field_4" TEXT,
    "custom_field_5" TEXT,
    "extra_data" JSONB,
    "raw_json" JSONB,
    "synced_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "tapd_workspace" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "status" TEXT,
    "synced_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "tapd_sync_record" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sync_type" TEXT NOT NULL DEFAULT 'full',
    "workspace_ids" JSONB NOT NULL DEFAULT [],
    "data_types" JSONB NOT NULL DEFAULT ["story", "task", "iteration"],
    "status" TEXT NOT NULL DEFAULT 'running',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "story_count" INTEGER NOT NULL DEFAULT 0,
    "task_count" INTEGER NOT NULL DEFAULT 0,
    "iteration_count" INTEGER NOT NULL DEFAULT 0,
    "bug_count" INTEGER NOT NULL DEFAULT 0,
    "timesheet_count" INTEGER NOT NULL DEFAULT 0,
    "error_msg" TEXT,
    "started_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" DATETIME,
    "created_by" TEXT
);

-- CreateTable
CREATE TABLE "tapd_bug" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL,
    "priority" TEXT,
    "priority_label" TEXT,
    "severity" TEXT,
    "current_owner" TEXT,
    "reporter" TEXT,
    "cc" TEXT DEFAULT '',
    "de" TEXT,
    "te" TEXT,
    "created" DATETIME,
    "modified" DATETIME,
    "resolved" DATETIME,
    "closed" DATETIME,
    "workspace_id" TEXT NOT NULL,
    "iteration_id" TEXT,
    "module" TEXT,
    "release_id" TEXT,
    "version_report" TEXT,
    "version_fix" TEXT,
    "version_test" TEXT,
    "version_close" TEXT,
    "source" TEXT,
    "bugtype" TEXT,
    "frequency" TEXT,
    "resolution" TEXT,
    "label" TEXT,
    "custom_field_one" TEXT,
    "custom_field_two" TEXT,
    "custom_field_three" TEXT,
    "custom_field_four" TEXT,
    "custom_field_five" TEXT,
    "extra_data" JSONB,
    "raw_json" JSONB,
    "synced_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "tapd_timesheet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "timespent" REAL NOT NULL,
    "spentdate" DATETIME,
    "owner" TEXT,
    "memo" TEXT,
    "workspace_id" TEXT NOT NULL,
    "created" DATETIME,
    "modified" DATETIME,
    "is_delete" BOOLEAN NOT NULL DEFAULT false,
    "raw_json" JSONB,
    "synced_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "member_employee_no_key" ON "member"("employee_no");

-- CreateIndex
CREATE UNIQUE INDEX "project_code_key" ON "project"("code");

-- CreateIndex
CREATE UNIQUE INDEX "project_milestone_project_id_quarter_key" ON "project_milestone"("project_id", "quarter");

-- CreateIndex
CREATE UNIQUE INDEX "efficiency_score_entity_type_entity_id_period_type_period_value_key" ON "efficiency_score"("entity_type", "entity_id", "period_type", "period_value");

-- CreateIndex
CREATE UNIQUE INDEX "efficiency_config_config_key_key" ON "efficiency_config"("config_key");

-- CreateIndex
CREATE UNIQUE INDEX "requirement_tapd_id_key" ON "requirement"("tapd_id");

-- CreateIndex
CREATE UNIQUE INDEX "defect_tapd_id_key" ON "defect"("tapd_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_account_member_id_key" ON "user_account"("member_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_account_email_key" ON "user_account"("email");

-- CreateIndex
CREATE UNIQUE INDEX "project_mapping_project_id_tapd_belonging_key" ON "project_mapping"("project_id", "tapd_belonging");

-- CreateIndex
CREATE INDEX "tapd_story_workspace_id_idx" ON "tapd_story"("workspace_id");

-- CreateIndex
CREATE INDEX "tapd_story_status_idx" ON "tapd_story"("status");

-- CreateIndex
CREATE INDEX "tapd_story_created_idx" ON "tapd_story"("created");

-- CreateIndex
CREATE INDEX "tapd_story_completed_idx" ON "tapd_story"("completed");

-- CreateIndex
CREATE INDEX "tapd_story_iteration_id_idx" ON "tapd_story"("iteration_id");

-- CreateIndex
CREATE INDEX "tapd_story_owner_idx" ON "tapd_story"("owner");

-- CreateIndex
CREATE INDEX "tapd_story_creator_idx" ON "tapd_story"("creator");

-- CreateIndex
CREATE INDEX "tapd_task_story_id_idx" ON "tapd_task"("story_id");

-- CreateIndex
CREATE INDEX "tapd_task_workspace_id_idx" ON "tapd_task"("workspace_id");

-- CreateIndex
CREATE INDEX "tapd_task_status_idx" ON "tapd_task"("status");

-- CreateIndex
CREATE INDEX "tapd_task_owner_idx" ON "tapd_task"("owner");

-- CreateIndex
CREATE INDEX "tapd_task_iteration_id_idx" ON "tapd_task"("iteration_id");

-- CreateIndex
CREATE INDEX "tapd_iteration_workspace_id_idx" ON "tapd_iteration"("workspace_id");

-- CreateIndex
CREATE INDEX "tapd_iteration_status_idx" ON "tapd_iteration"("status");

-- CreateIndex
CREATE INDEX "tapd_sync_record_status_idx" ON "tapd_sync_record"("status");

-- CreateIndex
CREATE INDEX "tapd_sync_record_started_at_idx" ON "tapd_sync_record"("started_at");

-- CreateIndex
CREATE INDEX "tapd_bug_workspace_id_idx" ON "tapd_bug"("workspace_id");

-- CreateIndex
CREATE INDEX "tapd_bug_status_idx" ON "tapd_bug"("status");

-- CreateIndex
CREATE INDEX "tapd_bug_current_owner_idx" ON "tapd_bug"("current_owner");

-- CreateIndex
CREATE INDEX "tapd_bug_iteration_id_idx" ON "tapd_bug"("iteration_id");

-- CreateIndex
CREATE INDEX "tapd_timesheet_entity_type_idx" ON "tapd_timesheet"("entity_type");

-- CreateIndex
CREATE INDEX "tapd_timesheet_entity_id_idx" ON "tapd_timesheet"("entity_id");

-- CreateIndex
CREATE INDEX "tapd_timesheet_workspace_id_idx" ON "tapd_timesheet"("workspace_id");

-- CreateIndex
CREATE INDEX "tapd_timesheet_owner_idx" ON "tapd_timesheet"("owner");
