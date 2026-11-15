package com.example.task_manager.project;

import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.example.task_manager.auth.RefreshTokenService;
import com.example.task_manager.config.jwt.JwtService;
import com.example.task_manager.project.entity.ProjectStatus;
import com.example.task_manager.support.PostgresIntegrationTest;
import com.example.task_manager.support.TestFixtures;
import com.example.task_manager.task.TaskPlanningCalendar;
import jakarta.persistence.EntityManager;
import java.time.Instant;
import java.time.LocalDate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.context.WebApplicationContext;

class ProjectDeadlineIntegrationTest extends PostgresIntegrationTest {
  @Autowired WebApplicationContext context;
  @Autowired TransactionTemplate transactions;
  @Autowired EntityManager em;
  @Autowired JwtService jwt;
  @Autowired RefreshTokenService sessions;
  @Autowired TaskPlanningCalendar calendar;
  private MockMvc mvc;

  @BeforeEach
  void setUp() {
    mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
  }

  @ParameterizedTest
  @CsvSource({"-1, true", "0, false", "1, false"})
  void reportsCalendarDaysUntilDue(int daysUntilDue, boolean overdue) throws Exception {
    LocalDate dueDay = calendar.day(Instant.now()).plusDays(daysUntilDue);
    projectInsights(dueDay, null)
        .andExpect(jsonPath("$.plannedDueDay").value(dueDay.toString()))
        .andExpect(jsonPath("$.health.daysUntilDue").value(daysUntilDue))
        .andExpect(jsonPath("$.health.overdue").value(overdue));
  }

  @ParameterizedTest
  @CsvSource({"0, true", "1, false"})
  void countsCompletionThroughTheEndOfTheDueDay(long completionOffset, boolean onTime)
      throws Exception {
    LocalDate dueDay = LocalDate.of(2026, 1, 10);
    Instant completion =
        calendar.parse(dueDay.plusDays(completionOffset).toString()).plusSeconds(12 * 3600);
    projectInsights(dueDay, completion)
        .andExpect(jsonPath("$.health.completedOnTime").value(onTime))
        .andExpect(jsonPath("$.health.overdue").value(false));
  }

  @Test
  void projectWithoutDeadlineHasNoOverdueStatus() throws Exception {
    projectInsights(null, null)
        .andExpect(jsonPath("$.plannedDueDay").isEmpty())
        .andExpect(jsonPath("$.health.daysUntilDue").value(0))
        .andExpect(jsonPath("$.health.overdue").value(false));
  }

  @Test
  void createsWithAnOptionalPlanningDayAndAcceptsLegacyIsoTimestamps() throws Exception {
    var workspace = transactions.execute(status -> TestFixtures.workspace(em));
    String authorization = TestFixtures.authorization(jwt, sessions, workspace.owner());
    String path = "/api/teams/" + workspace.team().getKey() + "/projects";
    LocalDate day = LocalDate.of(2026, 2, 10);
    Instant dayStart = calendar.parse(day.toString());
    Instant legacyTimestamp = dayStart.plusSeconds(3600);

    mvc.perform(
            post(path)
                .header("Authorization", authorization)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"No deadline\"}"))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.plannedDueDay").isEmpty());
    mvc.perform(
            post(path)
                .header("Authorization", authorization)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"name":"Due date on start day","plannedStartDate":"%s","plannedDueDate":"%s"}
                    """
                        .formatted(legacyTimestamp, day)))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.plannedDueDay").value(day.toString()))
        .andExpect(jsonPath("$.plannedDueDate").value(dayStart.toString()));
    mvc.perform(
            post(path)
                .header("Authorization", authorization)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"name\":\"Legacy deadline\",\"plannedDueDate\":\"%s\"}"
                        .formatted(legacyTimestamp)))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.plannedDueDay").value(day.toString()))
        .andExpect(jsonPath("$.plannedDueDate").value(legacyTimestamp.toString()));
  }

  @Test
  void editsAndClearsAnOptionalDueDateWhileAnOmittedFieldKeepsIt() throws Exception {
    var workspace =
        transactions.execute(
            status -> {
              var fixture = TestFixtures.workspace(em);
              fixture.project().setPlannedStartDate(calendar.parse("2026-02-10").plusSeconds(3600));
              fixture.project().setPlannedDueDate(calendar.parse("2026-02-11"));
              return fixture;
            });
    String authorization = TestFixtures.authorization(jwt, sessions, workspace.owner());
    String path =
        "/api/teams/" + workspace.team().getKey() + "/projects/" + workspace.project().getKey();

    update(path, authorization, "{\"description\":\"Planned\"}")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.plannedDueDay").value("2026-02-11"));
    update(path, authorization, "{\"name\":\"Invalid rename\",\"plannedDueDate\":\"2026-02-09\"}")
        .andExpect(status().isConflict());
    update(path, authorization, "{\"plannedDueDate\":\"2026-02-30\"}")
        .andExpect(status().isBadRequest());
    mvc.perform(get(path).header("Authorization", authorization))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.name").value("Test project"))
        .andExpect(jsonPath("$.plannedDueDay").value("2026-02-11"));

    update(path, authorization, "{\"plannedDueDate\":\"2026-02-10\"}")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.plannedDueDay").value("2026-02-10"));
    update(path, authorization, "{\"plannedDueDate\":null}")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.plannedDueDate").isEmpty())
        .andExpect(jsonPath("$.plannedDueDay").isEmpty())
        .andExpect(jsonPath("$.plannedStartDay").value("2026-02-10"));
    mvc.perform(get(path + "/insights/summary").header("Authorization", authorization))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.plannedDueDay").isEmpty())
        .andExpect(jsonPath("$.health.overdue").value(false));
    mvc.perform(get(path + "/activities").header("Authorization", authorization))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content[0].details.changes[0].field").value("plannedDueDate"));
  }

  private ResultActions update(String path, String authorization, String payload) throws Exception {
    return mvc.perform(
        patch(path)
            .header("Authorization", authorization)
            .contentType(MediaType.APPLICATION_JSON)
            .content(payload));
  }

  private ResultActions projectInsights(LocalDate dueDay, Instant completion) throws Exception {
    var workspace =
        transactions.execute(
            status -> {
              var fixture = TestFixtures.workspace(em);
              if (dueDay != null)
                fixture.project().setPlannedDueDate(calendar.parse(dueDay.toString()));
              if (completion != null) {
                fixture.project().setStatus(ProjectStatus.COMPLETED);
                fixture.project().setActualCompletionDate(completion);
              }
              return fixture;
            });
    String authorization = TestFixtures.authorization(jwt, sessions, workspace.owner());
    String path =
        "/api/teams/" + workspace.team().getKey() + "/projects/" + workspace.project().getKey();
    mvc.perform(get(path).header("Authorization", authorization))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.plannedDueDay").value(dueDay == null ? null : dueDay.toString()));
    return mvc.perform(get(path + "/insights/summary").header("Authorization", authorization))
        .andExpect(status().isOk());
  }
}
