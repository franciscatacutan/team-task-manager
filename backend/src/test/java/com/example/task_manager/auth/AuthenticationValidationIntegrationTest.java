package com.example.task_manager.auth;

import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.example.task_manager.support.PostgresIntegrationTest;
import com.example.task_manager.support.TestFixtures;
import com.example.task_manager.support.TestFixtures.Workspace;
import jakarta.persistence.EntityManager;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.context.WebApplicationContext;
import tools.jackson.databind.json.JsonMapper;

class AuthenticationValidationIntegrationTest extends PostgresIntegrationTest {
  @Autowired WebApplicationContext context;
  @Autowired EntityManager em;
  @Autowired TransactionTemplate transactions;
  @Autowired PasswordEncoder passwords;
  @Autowired JsonMapper json;
  private Workspace workspace;
  private MockMvc mvc;

  @BeforeEach
  void setup() {
    workspace =
        transactions.execute(
            status -> {
              var value = TestFixtures.workspace(em);
              value.owner().setPassword(passwords.encode(" old "));
              return value;
            });
    mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
  }

  @Test
  void shortExistingPasswordAuthenticatesExactlyAsStored() throws Exception {
    mvc.perform(
            post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    json.writeValueAsString(
                        Map.of("email", workspace.owner().getEmail(), "password", " old "))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.token").isNotEmpty());
  }

  @Test
  void removingComplexityChecksDoesNotBypassCredentialVerification() throws Exception {
    mvc.perform(
            post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    json.writeValueAsString(
                        Map.of("email", workspace.owner().getEmail(), "password", "old"))))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.error").value("INVALID_CREDENTIALS"));
  }

  @Test
  void blankPasswordStillFailsRequestValidation() throws Exception {
    mvc.perform(
            post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    json.writeValueAsString(
                        Map.of("email", workspace.owner().getEmail(), "password", " "))))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.error").value("VALIDATION_ERROR"));
  }
}
