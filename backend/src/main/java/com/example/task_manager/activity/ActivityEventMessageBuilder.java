package com.example.task_manager.activity;

import com.example.task_manager.activity.dto.ActivityEventDetails;
import com.example.task_manager.activity.dto.ActivityEventType;
import java.util.List;
import org.springframework.stereotype.Component;

/** Builds human-readable fallback messages from structured events. */
@Component
public class ActivityEventMessageBuilder {

  public String build(ActivityEventType eventType, ActivityEventDetails details) {
    return switch (eventType) {
      case TEAM_CREATED -> "Created team " + quotedLabel(details.team());
      case TEAM_UPDATED -> buildUpdated("team", details);
      case TEAM_DELETED -> "Archived team " + quotedLabel(details.team());
      case TEAM_MEMBER_ADDED -> "Added " + plainLabel(details.subjectUser()) + " to the team";
      case TEAM_MEMBER_REMOVED -> "Removed " + plainLabel(details.subjectUser()) + " from the team";
      case TEAM_MEMBER_ROLE_CHANGED ->
          "Changed "
              + plainLabel(details.subjectUser())
              + " role from "
              + details.from()
              + " to "
              + details.to();
      case TEAM_OWNERSHIP_TRANSFERRED ->
          "Transferred team ownership from " + details.from() + " to " + details.to();
      case PROJECT_CREATED -> "Created project " + quotedLabel(details.project());
      case PROJECT_UPDATED -> buildUpdated("project", details);
      case PROJECT_DELETED -> "Archived project " + quotedLabel(details.project());
      case PROJECT_STATUS_CHANGED ->
          "Changed project status from " + details.from() + " to " + details.to();
      case TASK_CREATED -> "Created task " + quotedLabel(details.task());
      case TASK_UPDATED -> buildUpdated("task", details);
      case TASK_DELETED -> "Archived task " + quotedLabel(details.task());
      case TASK_STATUS_CHANGED -> "Status changed from " + details.from() + " to " + details.to();
      case TASK_ASSIGNEE_CHANGED ->
          "Assignee changed from " + details.from() + " to " + details.to();
      case TASK_SUPPORT_ASSIGNED -> "Support assigned to " + details.target();
      case TASK_SUPPORT_CHANGED -> "Support changed from " + details.from() + " to " + details.to();
      case TASK_SUPPORT_REMOVED -> "Support removed (" + details.target() + ")";
      case TASK_COMMENTED -> "";
    };
  }

  private String buildUpdated(String entityName, ActivityEventDetails details) {
    List<String> labels = detailLabels(details);

    if (labels.isEmpty()) {
      return capitalize(entityName) + " updated";
    }

    return capitalize(entityName) + " updated: " + String.join(", ", labels);
  }

  private List<String> detailLabels(ActivityEventDetails details) {
    if (details.changes() != null && !details.changes().isEmpty()) {
      return details.changes().stream()
          .map(
              change ->
                  change.label() == null || change.label().isBlank()
                      ? change.field()
                      : change.label())
          .filter(label -> label != null && !label.isBlank())
          .toList();
    }

    if (details.fields() == null) {
      return List.of();
    }

    return details.fields();
  }

  private String quotedLabel(ActivityEventDetails.ActivityReference reference) {
    String label = plainLabel(reference);
    return label == null ? "details" : "\"" + label + "\"";
  }

  private String plainLabel(ActivityEventDetails.ActivityReference reference) {
    return reference == null ? null : reference.label();
  }

  private String capitalize(String value) {
    if (value == null || value.isBlank()) {
      return "";
    }

    return Character.toUpperCase(value.charAt(0)) + value.substring(1);
  }
}
