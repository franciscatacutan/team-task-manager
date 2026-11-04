package com.example.task_manager.notification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.example.task_manager.auth.RefreshTokenService;
import com.example.task_manager.config.jwt.JwtService;
import com.example.task_manager.support.PostgresIntegrationTest;
import com.example.task_manager.support.TestFixtures;
import com.example.task_manager.user.entity.UserEntity;
import jakarta.persistence.EntityManager;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.context.WebApplicationContext;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

class NotificationInboxIntegrationTest extends PostgresIntegrationTest {
  @Autowired WebApplicationContext context;
  @Autowired TransactionTemplate transactions;
  @Autowired EntityManager em;
  @Autowired JdbcTemplate jdbc;
  @Autowired NotificationRepository notifications;
  @Autowired NotificationService notificationService;
  @Autowired JwtService jwt;
  @Autowired RefreshTokenService sessions;
  private final JsonMapper json = JsonMapper.builder().build();
  private MockMvc mvc;
  private UserEntity owner;
  private UserEntity other;
  private String authorization;
  private String otherAuthorization;
  private static final Instant CREATED = Instant.parse("2026-11-04T00:00:00Z");

  @BeforeEach
  void setUp() {
    owner = transactions.execute(status -> TestFixtures.workspace(em).owner());
    other = transactions.execute(status -> TestFixtures.workspace(em).owner());
    authorization = TestFixtures.authorization(jwt, sessions, owner);
    otherAuthorization = TestFixtures.authorization(jwt, sessions, other);
    mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
  }

  @Test
  void paginatesOwnedInboxAndFindsUnreadItemsBeyondFirstTwelve() throws Exception {
    var ids = seed(owner, 15, 12, false);
    seed(other, 5, 0, false);
    mvc.perform(get("/api/notifications").header("Authorization", authorization))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.size").value(12))
        .andExpect(jsonPath("$.content.length()").value(12))
        .andExpect(jsonPath("$.totalElements").value(15))
        .andExpect(jsonPath("$.totalPages").value(2));
    mvc.perform(
            get("/api/notifications")
                .param("page", "1")
                .param("size", "12")
                .header("Authorization", authorization))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content.length()").value(3))
        .andExpect(jsonPath("$.content[0].id").value(ids.get(12).toString()))
        .andExpect(jsonPath("$.last").value(true));
    mvc.perform(
            get("/api/notifications")
                .param("unreadOnly", "true")
                .param("size", "2")
                .header("Authorization", authorization))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalElements").value(3))
        .andExpect(jsonPath("$.totalPages").value(2))
        .andExpect(jsonPath("$.content.length()").value(2))
        .andExpect(jsonPath("$.content[0].id").value(ids.get(12).toString()))
        .andExpect(jsonPath("$.content[0].read").value(false));
    mvc.perform(
            get("/api/notifications")
                .param("unreadOnly", "true")
                .param("size", "2")
                .param("page", "1")
                .header("Authorization", authorization))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content.length()").value(1))
        .andExpect(jsonPath("$.content[0].id").value(ids.get(14).toString()));
    count(authorization, 3);
    count(otherAuthorization, 5);
  }

  @Test
  void tiedTimestampsHaveRepeatableNonOverlappingPages() throws Exception {
    var expected =
        seed(owner, 15, 0, true).stream()
            .map(UUID::toString)
            .sorted(Comparator.reverseOrder())
            .toList();
    var actual = new ArrayList<String>();
    for (int page = 0; page < 3; page++) {
      for (JsonNode node : inbox("?size=5&page=" + page).get("content"))
        actual.add(node.get("id").asText());
    }
    assertThat(actual).containsExactlyElementsOf(expected);
    assertThat(inbox("?size=5&page=0").get("content").get(0).get("id").asText())
        .isEqualTo(expected.getFirst());
  }

  @Test
  void explicitAscendingSortAndDefaultNewestFirstAreHonored() throws Exception {
    var ids = seed(owner, 3, 0, false);
    assertThat(inbox("").get("content").get(0).get("id").asText())
        .isEqualTo(ids.getFirst().toString());
    assertThat(inbox("?sort=createdAt,asc").get("content").get(0).get("id").asText())
        .isEqualTo(ids.getLast().toString());
  }

  @Test
  void readOneIsOwnedIdempotentAndUpdatesFilteredTotals() throws Exception {
    var ids = seed(owner, 3, 0, false);
    var foreign = seed(other, 1, 0, false).getFirst();
    mvc.perform(
            patch("/api/notifications/" + foreign + "/read").header("Authorization", authorization))
        .andExpect(status().isNotFound());
    mvc.perform(
            patch("/api/notifications/" + UUID.randomUUID() + "/read")
                .header("Authorization", authorization))
        .andExpect(status().isNotFound());
    String path = "/api/notifications/" + ids.getFirst() + "/read";
    mvc.perform(patch(path).header("Authorization", authorization))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.read").value(true));
    Instant saved = notifications.findById(ids.getFirst()).orElseThrow().getReadAt();
    var again =
        json.readTree(
            mvc.perform(patch(path).header("Authorization", authorization))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString());
    assertThat(Instant.parse(again.get("readAt").asText())).isEqualTo(saved);
    assertThat(notifications.findById(ids.getFirst()).orElseThrow().getReadAt()).isEqualTo(saved);
    assertThat(inbox("?unreadOnly=true").get("totalElements").asLong()).isEqualTo(2);
    assertThat(inbox("").get("totalElements").asLong()).isEqualTo(3);
    count(authorization, 2);
    count(otherAuthorization, 1);
  }

  @Test
  void readAllCoversEveryPageAndOnlyCurrentRecipient() throws Exception {
    seed(owner, 25, 1, false);
    seed(other, 4, 0, false);
    for (int attempt = 0; attempt < 2; attempt++) {
      mvc.perform(patch("/api/notifications/read-all").header("Authorization", authorization))
          .andExpect(status().isOk())
          .andExpect(jsonPath("$.unreadCount").value(0));
    }
    count(authorization, 0);
    count(otherAuthorization, 4);
    assertThat(inbox("?unreadOnly=true").get("totalElements").asLong()).isZero();
    assertThat(inbox("").get("totalElements").asLong()).isEqualTo(25);
    // New deliveries after Read all must remain unread, not be hidden by a forced zero response.
    seed(owner, 1, 0, false);
    count(authorization, 1);
  }

  @Test
  void emptyAndOutOfRangePagesRetainAccurateMetadata() throws Exception {
    assertThat(inbox("").get("totalElements").asLong()).isZero();
    seed(owner, 3, 0, false);
    var page = inbox("?page=9&size=2&unreadOnly=true");
    assertThat(page.get("content").size()).isZero();
    assertThat(page.get("totalElements").asLong()).isEqualTo(3);
    assertThat(page.get("totalPages").asInt()).isEqualTo(2);
  }

  @Test
  void emailMatchingIsCaseInsensitive() {
    seed(owner, 2, 0, false);
    String email = owner.getEmail().toUpperCase(Locale.ROOT);
    assertThat(notificationService.getInbox(email, true, PageRequest.of(0, 12)).totalElements())
        .isEqualTo(2);
    assertThat(notificationService.getUnreadCount(email).unreadCount()).isEqualTo(2);
  }

  @ParameterizedTest
  @ValueSource(strings = {"recipient.email", "actor.password", "unknown"})
  void invalidSortsAreClientErrors(String field) throws Exception {
    mvc.perform(
            get("/api/notifications")
                .param("sort", field + ",desc")
                .header("Authorization", authorization))
        .andExpect(status().isBadRequest());
  }

  @Test
  void invalidUnreadFlagIsAClientError() throws Exception {
    mvc.perform(
            get("/api/notifications")
                .param("unreadOnly", "invalid")
                .header("Authorization", authorization))
        .andExpect(status().isBadRequest());
  }

  private JsonNode inbox(String query) throws Exception {
    return json.readTree(
        mvc.perform(get("/api/notifications" + query).header("Authorization", authorization))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString());
  }

  private void count(String bearer, int expected) throws Exception {
    mvc.perform(get("/api/notifications/unread-count").header("Authorization", bearer))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.unreadCount").value(expected));
  }

  private List<UUID> seed(UserEntity recipient, int count, int readFirst, boolean tied) {
    var ids = new ArrayList<UUID>();
    for (int i = 0; i < count; i++) {
      var id = UUID.randomUUID();
      ids.add(id);
      jdbc.update(
          "INSERT INTO notifications (id,recipient_id,type,title,body,target_path,created_at,read_at) VALUES (?,?,'TEAM',?,?,'/teams',?,?)",
          id,
          recipient.getId(),
          "Notice " + i,
          "Body " + i,
          Timestamp.from(tied ? CREATED : CREATED.minusSeconds(i)),
          i < readFirst ? Timestamp.from(CREATED.plusSeconds(1)) : null);
    }
    return ids;
  }
}
