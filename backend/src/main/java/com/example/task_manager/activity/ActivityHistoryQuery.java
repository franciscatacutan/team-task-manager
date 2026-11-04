package com.example.task_manager.activity;

import com.example.task_manager.activity.dto.ActivityEventType;
import com.example.task_manager.activity.entity.ActivityEventEntity;
import com.example.task_manager.exception.api.BadRequestInputException;
import com.example.task_manager.project.entity.ProjectEntity;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.hibernate.query.criteria.JpaExpression;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Component;

/** Filtering runs inside the already-authorized scope, before both page selection and count. */
@Component
@RequiredArgsConstructor
public class ActivityHistoryQuery {
  private final ActivityEventRepository events;

  public Page<ActivityEventEntity> team(UUID teamId, String search, Pageable pageable) {
    return find("teamId", teamId, search, pageable);
  }

  public Page<ActivityEventEntity> project(UUID projectId, String search, Pageable pageable) {
    return find("projectId", projectId, search, pageable);
  }

  public Page<ActivityEventEntity> task(UUID taskId, String search, Pageable pageable) {
    return find("taskId", taskId, search, pageable);
  }

  private Page<ActivityEventEntity> find(String scope, UUID id, String search, Pageable pageable) {
    String text = search == null ? "" : search.trim().toLowerCase(Locale.ROOT);
    if (text.length() > 200)
      throw new BadRequestInputException("Activity search must be at most 200 characters");
    Specification<ActivityEventEntity> spec =
        (root, query, cb) -> {
          Predicate authorizedScope = cb.equal(root.get(scope), id);
          if (text.isEmpty()) return authorizedScope;
          String pattern =
              "%" + text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
          var actor = root.join("user", JoinType.LEFT);
          var task = root.join("task", JoinType.LEFT);
          List<Expression<String>> fields =
              new ArrayList<>(
                  List.of(
                      root.get("message"),
                      actor.get("firstName"),
                      actor.get("lastName"),
                      actor.get("email"),
                      cb.concat(cb.concat(actor.get("firstName"), " "), actor.get("lastName")),
                      task.get("name"),
                      ((JpaExpression<Long>) task.<Long>get("taskNumber")).cast(String.class)));
          for (String reference : List.of("team", "project", "task", "subjectUser")) {
            fields.add(
                cb.function(
                    "jsonb_extract_path_text",
                    String.class,
                    root.get("details"),
                    cb.literal(reference),
                    cb.literal("label")));
          }
          List<Predicate> matches = new ArrayList<>();
          for (Expression<String> field : fields)
            matches.add(cb.like(cb.lower(field), pattern, '\\'));
          var project = query.subquery(Integer.class);
          var p = project.from(ProjectEntity.class);
          project
              .select(cb.literal(1))
              .where(
                  cb.equal(p.get("id"), root.get("projectId")),
                  cb.or(
                      cb.like(cb.lower(p.get("name")), pattern, '\\'),
                      cb.like(cb.lower(p.get("key")), pattern, '\\')));
          matches.add(cb.exists(project));
          var types =
              Arrays.stream(ActivityEventType.values())
                  .filter(
                      type ->
                          type.name().toLowerCase(Locale.ROOT).contains(text)
                              || type.name()
                                  .replace('_', ' ')
                                  .toLowerCase(Locale.ROOT)
                                  .contains(text)
                              || typeLabel(type).toLowerCase(Locale.ROOT).contains(text))
                  .toList();
          if (!types.isEmpty()) matches.add(root.get("eventType").in(types));
          return cb.and(authorizedScope, cb.or(matches.toArray(Predicate[]::new)));
        };
    Sort sort =
        pageable.getSort().isSorted()
            ? pageable.getSort()
            : Sort.by(Sort.Direction.DESC, "createdAt");
    for (Sort.Order order : sort)
      if (!Set.of("createdAt", "id").contains(order.getProperty())) {
        throw new BadRequestInputException("Invalid activity sort field: " + order.getProperty());
      }
    if (sort.getOrderFor("id") == null)
      sort =
          sort.and(
              Sort.by(
                  sort.getOrderFor("createdAt") == null
                      ? Sort.Direction.DESC
                      : sort.getOrderFor("createdAt").getDirection(),
                  "id"));
    return events.findAll(
        spec,
        PageRequest.of(
            pageable.isPaged() ? pageable.getPageNumber() : 0,
            pageable.isPaged() ? pageable.getPageSize() : 10,
            sort));
  }

  private static String typeLabel(ActivityEventType type) {
    return switch (type) {
      case TEAM_CREATED, PROJECT_CREATED, TASK_CREATED -> "Created";
      case TEAM_UPDATED, PROJECT_UPDATED, TASK_UPDATED -> "Updated";
      case TEAM_DELETED, PROJECT_DELETED, TASK_DELETED -> "Archived";
      case TEAM_MEMBER_ADDED, TEAM_MEMBER_REMOVED -> "Member";
      case TEAM_MEMBER_ROLE_CHANGED -> "Role";
      case TEAM_OWNERSHIP_TRANSFERRED -> "Owner";
      case PROJECT_STATUS_CHANGED, TASK_STATUS_CHANGED -> "Status";
      case TASK_ASSIGNEE_CHANGED -> "Assignee";
      case TASK_SUPPORT_ASSIGNED, TASK_SUPPORT_CHANGED, TASK_SUPPORT_REMOVED -> "Support";
      case TASK_COMMENTED -> "Comment";
    };
  }
}
