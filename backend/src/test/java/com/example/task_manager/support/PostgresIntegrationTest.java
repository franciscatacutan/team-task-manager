package com.example.task_manager.support;

import com.example.task_manager.TeamTaskManagerApplication;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.testcontainers.postgresql.PostgreSQLContainer;

@SpringBootTest(
    classes = TeamTaskManagerApplication.class,
    properties = {
      "spring.jpa.hibernate.ddl-auto=create-drop",
      "auth.jwt.secret=phase-one-test-only-secret-at-least-thirty-two-bytes-long",
      "auth.jwt.issuer=team-task-manager-tests",
      "auth.refresh-cookie-secure=false",
      "auth.refresh-cookie-same-site=Lax",
      "frontend.url=http://localhost:5173",
      "app.bootstrap-admin.email=",
      "app.bootstrap-admin.password="
    })
@ActiveProfiles("test")
@Import(PostgresIntegrationTest.DatabaseConfiguration.class)
public abstract class PostgresIntegrationTest {
  @TestConfiguration(proxyBeanMethods = false)
  static class DatabaseConfiguration {
    @Bean
    @ServiceConnection
    PostgreSQLContainer postgres() {
      return new PostgreSQLContainer("postgres:17-alpine");
    }
  }
}
