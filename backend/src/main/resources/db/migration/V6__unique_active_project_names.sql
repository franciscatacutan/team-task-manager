-- Keep archived projects and allow their names to be reused.
-- A conflicting legacy row stops the upgrade without changing any project.
CREATE UNIQUE INDEX uk_project_active_team_name
  ON projects (team_id, lower(btrim(name)))
  WHERE deleted_at IS NULL;
