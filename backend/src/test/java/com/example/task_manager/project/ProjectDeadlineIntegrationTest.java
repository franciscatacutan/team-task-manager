package com.example.task_manager.project;

import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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
