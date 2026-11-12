package com.example.task_manager.task;

import com.example.task_manager.exception.api.BadRequestInputException;
import com.example.task_manager.task.entity.TaskStatus;
import java.time.DateTimeException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** The calendar used for task planning dates and overdue reports. */
@Component
public class TaskPlanningCalendar {
  public static final List<TaskStatus> CLOSED_STATUSES =
      List.of(TaskStatus.DONE, TaskStatus.CANCELLED, TaskStatus.DELETED);

  private final ZoneId zone;

  public TaskPlanningCalendar(@Value("${app.planning-time-zone}") String timeZone) {
    zone = ZoneId.of(timeZone);
  }

  public LocalDate day(Instant value) {
    return value == null ? null : value.atZone(zone).toLocalDate();
  }

  public Instant startOfToday(Instant now) {
    return day(now).atStartOfDay(zone).toInstant();
  }

  /** Accept a calendar date from the app or an ISO timestamp from an existing API client. */
  public Instant parse(String value) {
    if (value == null) return null;
    try {
      if (value.length() == 10) {
        return LocalDate.parse(value).atStartOfDay(zone).toInstant();
      }
      return Instant.parse(value);
    } catch (DateTimeException ex) {
      throw new BadRequestInputException(
          "Planned dates must be valid calendar dates or ISO timestamps.");
    }
  }
}
