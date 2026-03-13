export const TASK_SELECT_COLUMNS = `
  id,
  title,
  description,
  status,
  time,
  tool_name as tool,
  priority,
  url,
  linked_agent_task_id as linkedAgentTaskId,
  source_kind as sourceKind,
  current_run_id as currentRunId,
  linked_session_id as linkedSessionId,
  artifact_count as artifactCount
`;

export const TASK_RUN_SELECT_COLUMNS = `
  id,
  task_id as taskId,
  run_type as runType,
  agent_id as agentId,
  skill_id as skillId,
  status,
  steps_json as stepsJson,
  result_json as resultJson,
  error,
  origin_type as originType,
  origin_ref as originRef,
  linked_agent_task_id as linkedAgentTaskId,
  started_at as startedAt,
  completed_at as completedAt
`;
