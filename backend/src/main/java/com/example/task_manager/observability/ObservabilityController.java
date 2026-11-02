package com.example.task_manager.observability;

import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.task_manager.common.PageResponse;
import com.example.task_manager.observability.dto.AuditLogResponse;
import com.example.task_manager.observability.dto.SystemEventResponse;
import com.example.task_manager.observability.dto.TeamInsightsResponse;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/teams/{teamKey}/insights")
@RequiredArgsConstructor
public class ObservabilityController {
  private final ObservabilityService observabilityService;

  @GetMapping("/summary")
  public ResponseEntity<TeamInsightsResponse> getTeamInsights(
      @PathVariable String teamKey,
      Authentication authentication) {

    return ResponseEntity.ok(observabilityService.getTeamInsights(teamKey, authentication));
  }

  @GetMapping("/audit-logs")
  public ResponseEntity<PageResponse<AuditLogResponse>> getAuditLogs(
      @PathVariable String teamKey,
      @PageableDefault(size = 20, sort = "occurredAt", direction = Sort.Direction.DESC) Pageable pageable,
      Authentication authentication) {

    return ResponseEntity.ok(observabilityService.getAuditLogs(teamKey, pageable, authentication));
  }

  @GetMapping("/system-events")
  public ResponseEntity<PageResponse<SystemEventResponse>> getSystemEvents(
      @PathVariable String teamKey,
      @PageableDefault(size = 20, sort = "occurredAt", direction = Sort.Direction.DESC) Pageable pageable,
      Authentication authentication) {

    return ResponseEntity.ok(observabilityService.getSystemEvents(teamKey, pageable, authentication));
  }
}
