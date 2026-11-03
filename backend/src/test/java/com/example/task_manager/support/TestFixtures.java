package com.example.task_manager.support;

import com.example.task_manager.auth.RefreshTokenService;
import com.example.task_manager.config.jwt.JwtService;
import com.example.task_manager.project.entity.ProjectEntity;
import com.example.task_manager.task.entity.TaskEntity;
import com.example.task_manager.task.entity.TaskPriority;
import com.example.task_manager.team.entity.TeamEntity;
import com.example.task_manager.team.entity.TeamMemberEntity;
import com.example.task_manager.team.entity.TeamRole;
import com.example.task_manager.user.entity.UserEntity;
import com.example.task_manager.user.entity.UserRole;
import jakarta.persistence.EntityManager;
import java.time.Instant;
import java.util.UUID;

public final class TestFixtures {
  private TestFixtures() {}

  /** Authenticated HTTP tests use real persisted sessions, just like application logins. */
  public static String authorization(
      JwtService jwt, RefreshTokenService sessions, UserEntity user) {
    var session = sessions.createSession(user, "127.0.0.1", "JUnit");
    return "Bearer " + jwt.generateToken(user, session.familyId());
  }

  public static Workspace workspace(EntityManager em) {
    String suffix = UUID.randomUUID().toString();
    UserEntity owner = new UserEntity();
    owner.setFirstName("Test");
    owner.setLastName("Owner");
    owner.setEmail(suffix + "@example.test");
    owner.setPassword("not-used-for-bearer-token-tests");
    owner.setRole(UserRole.USER);
    em.persist(owner);

    TeamEntity team = new TeamEntity();
    team.setKey(("TEAM-" + suffix).toUpperCase(java.util.Locale.ROOT));
    team.setName("Test team " + suffix);
    team.setOwner(owner);
    team.setCreatedBy(owner);
    em.persist(team);

    TeamMemberEntity membership = new TeamMemberEntity();
    membership.setTeam(team);
    membership.setUser(owner);
    membership.setAddedBy(owner);
    membership.setRole(TeamRole.OWNER);
    em.persist(membership);

    ProjectEntity project = new ProjectEntity();
    project.setKey(("PROJ-" + suffix).toUpperCase(java.util.Locale.ROOT));
    project.setName("Test project");
    project.setTeam(team);
    project.setOwner(owner);
    project.setCreatedBy(owner);
    em.persist(project);

    TaskEntity task = new TaskEntity();
    task.setName("Original task");
    task.setTaskNumber(1L);
    task.setProject(project);
    task.setAssignee(owner);
    task.setCreatedBy(owner);
    task.setPriority(TaskPriority.MEDIUM);
    task.setPlannedStartDate(Instant.now());
    task.setPlannedDueDate(Instant.now().plusSeconds(86400));
    em.persist(task);
    em.flush();
    return new Workspace(owner, team, project, task);
  }

  public record Workspace(
      UserEntity owner, TeamEntity team, ProjectEntity project, TaskEntity task) {
    public String taskPath() {
      return "/api/teams/" + team.getKey() + "/projects/" + project.getKey() + "/tasks/1";
    }
  }
}
