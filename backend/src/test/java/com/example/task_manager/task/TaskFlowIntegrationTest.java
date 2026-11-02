package com.example.task_manager.task;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.util.Arrays;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.context.WebApplicationContext;

import com.example.task_manager.config.jwt.JwtService;
import com.example.task_manager.support.PostgresIntegrationTest;
import com.example.task_manager.support.TestFixtures;
import com.example.task_manager.support.TestFixtures.Workspace;
import com.example.task_manager.task.entity.TaskEntity;
import com.example.task_manager.task.entity.TaskStatus;

import jakarta.persistence.EntityManager;

class TaskFlowIntegrationTest extends PostgresIntegrationTest {
  @Autowired WebApplicationContext context;
  @Autowired TransactionTemplate transactions;
  @Autowired EntityManager em;
  @Autowired JwtService jwt;
  private MockMvc mvc;
  private Workspace workspace;
  private String authorization;

  @BeforeEach
  void setUp() {
    workspace = transactions.execute(status -> TestFixtures.workspace(em));
    authorization = "Bearer " + jwt.generateToken(workspace.owner());
    mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
  }

  @Test
  void listsTasksOnlyWithinTheAuthorizedTeamAndProject() throws Exception {
    mvc.perform(get(workspace.taskPath().replace("/tasks/1", "/tasks"))
        .header("Authorization", authorization))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content[0].name").value("Original task"))
        .andExpect(jsonPath("$.content[0].title").doesNotExist());

    Workspace foreign = transactions.execute(status -> TestFixtures.workspace(em));
    String forgedPath = "/api/teams/" + workspace.team().getKey()
        + "/projects/" + foreign.project().getKey() + "/tasks";
    mvc.perform(get(forgedPath).header("Authorization", authorization))
        .andExpect(status().isNotFound());
    mvc.perform(get(forgedPath).param("all", "true").param("deletedFilter", "ALL")
        .header("Authorization", authorization)).andExpect(status().isNotFound());
    mvc.perform(get(foreign.taskPath().replace("/tasks/1", "/tasks"))
        .header("Authorization", authorization)).andExpect(status().isNotFound());
  }

  @Test
  void sortsTaskListsUsingTheNameField() throws Exception {
    mvc.perform(get(workspace.taskPath().replace("/tasks/1", "/tasks"))
        .param("sort", "name,asc").header("Authorization", authorization))
        .andExpect(status().isOk()).andExpect(jsonPath("$.content[0].name").value("Original task"));
  }

  @Test
  void updatesAndPersistsTheTaskName() throws Exception {
    mvc.perform(patch(workspace.taskPath()).header("Authorization", authorization)
        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Renamed task\"}"))
        .andExpect(status().isOk()).andExpect(jsonPath("$.name").value("Renamed task"));
    mvc.perform(get(workspace.taskPath()).header("Authorization", authorization))
        .andExpect(status().isOk()).andExpect(jsonPath("$.name").value("Renamed task"));
  }

  @Test
  void activityFeedsExposeTaskAndProjectNames() throws Exception {
    mvc.perform(patch(workspace.taskPath()).header("Authorization", authorization)
        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Renamed task\"}"))
        .andExpect(status().isOk()).andExpect(jsonPath("$.title").doesNotExist());
    mvc.perform(get(workspace.taskPath() + "/activities").header("Authorization", authorization))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content[0].task.name").value("Renamed task"))
        .andExpect(jsonPath("$.content[0].task.title").doesNotExist());
    String projectPath = "/api/teams/" + workspace.team().getKey() + "/projects/" + workspace.project().getKey();
    mvc.perform(get(projectPath + "/activities").header("Authorization", authorization))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content[0].task.name").value("Renamed task"))
        .andExpect(jsonPath("$.content[0].task.title").doesNotExist());
    mvc.perform(get("/api/teams/" + workspace.team().getKey() + "/activities")
        .header("Authorization", authorization)).andExpect(status().isOk())
        .andExpect(jsonPath("$.content[0].task.name").value("Renamed task"))
        .andExpect(jsonPath("$.content[0].project.name").value("Test project"))
        .andExpect(jsonPath("$.content[0].task.title").doesNotExist())
        .andExpect(jsonPath("$.content[0].project.title").doesNotExist());
  }

  @Test
  void requiresAuthentication() throws Exception {
    mvc.perform(get(workspace.taskPath())).andExpect(status().isUnauthorized());
  }

  @ParameterizedTest
  @EnumSource(value = TaskStatus.class, names = {"DELETED", "TODO"})
  void rejectsInvalidStatusUpdatesWithoutChangingTheTask(TaskStatus next) throws Exception {
    setStatus(TaskStatus.IN_PROGRESS);
    mvc.perform(patch(workspace.taskPath() + "/status").header("Authorization", authorization)
        .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"" + next + "\"}"))
        .andExpect(status().isBadRequest());
    assertThat(transactions.<TaskStatus>execute(status -> em.find(TaskEntity.class, workspace.task().getId()).getStatus()))
        .isEqualTo(TaskStatus.IN_PROGRESS);
  }

  @Test
  void permitsReviewAndCompletionButRequiresExplicitReopening() throws Exception {
    for (String next : Arrays.asList("IN_PROGRESS", "IN_REVIEW", "DONE")) {
      mvc.perform(patch(workspace.taskPath() + "/status").header("Authorization", authorization)
          .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"" + next + "\"}"))
          .andExpect(status().isOk()).andExpect(jsonPath("$.status").value(next));
    }
    mvc.perform(patch(workspace.taskPath() + "/status").header("Authorization", authorization)
        .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"IN_PROGRESS\"}"))
        .andExpect(status().isBadRequest());
    mvc.perform(patch(workspace.taskPath() + "/status").header("Authorization", authorization)
        .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"IN_REVIEW\"}"))
        .andExpect(status().isOk()).andExpect(jsonPath("$.actualCompletionDate").isEmpty());
  }

  @Test
  void cannotReopenCancelledTasksThroughTheApi() throws Exception {
    setStatus(TaskStatus.CANCELLED);
    mvc.perform(patch(workspace.taskPath() + "/status").header("Authorization", authorization)
        .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"IN_PROGRESS\"}"))
        .andExpect(status().isBadRequest());
  }

  @Test
  void archiveUsesTheDedicatedEndpointAndHidesTheTaskFromActiveLists() throws Exception {
    mvc.perform(delete(workspace.taskPath()).header("Authorization", authorization))
        .andExpect(status().isNoContent());
    mvc.perform(get(workspace.taskPath().replace("/tasks/1", "/tasks"))
        .header("Authorization", authorization)).andExpect(status().isOk())
        .andExpect(jsonPath("$.totalElements").value(0));
    assertThat(transactions.<java.time.Instant>execute(status -> em.find(TaskEntity.class, workspace.task().getId()).getDeletedAt()))
        .isNotNull();
  }

  private void setStatus(TaskStatus next) {
    transactions.executeWithoutResult(status -> em.find(TaskEntity.class, workspace.task().getId()).setStatus(next));
  }
}
