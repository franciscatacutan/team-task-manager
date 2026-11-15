package com.example.task_manager.common;

import com.example.task_manager.project.entity.ProjectEntity;
import com.example.task_manager.task.entity.TaskEntity;
import com.example.task_manager.team.entity.TeamEntity;
import java.nio.charset.StandardCharsets;
import org.springframework.web.util.UriUtils;

/** Build internal routes from current public identifiers, never from stored arbitrary URLs. */
public final class WorkspacePaths {
  private WorkspacePaths() {}

  public static String team(TeamEntity team) {
    return "/teams/" + UriUtils.encodePathSegment(team.getKey(), StandardCharsets.UTF_8);
  }

  public static String project(ProjectEntity project) {
    return team(project.getTeam())
        + "/projects/"
        + UriUtils.encodePathSegment(project.getKey(), StandardCharsets.UTF_8);
  }

  public static String task(TaskEntity task) {
    return project(task.getProject()) + "/tasks/" + task.getTaskNumber();
  }
}
