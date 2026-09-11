package com.example.task_manager.task;

import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.task_manager.common.PageResponse;
import com.example.task_manager.task.dto.ChangeStatusRequest;
import com.example.task_manager.task.dto.CreateTaskRequest;
import com.example.task_manager.task.dto.CreateTaskCommentRequest;
import com.example.task_manager.task.dto.TaskResponse;
import com.example.task_manager.task.dto.TaskSearchRequest;
import com.example.task_manager.task.dto.TaskActivityResponse;
import com.example.task_manager.task.dto.UpdateTaskDetailsRequest;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/**
 * REST controller for managing tasks within projects.
 */
@RestController
@RequestMapping("/api/teams/{teamKey}/projects/{projectKey}/tasks")
@RequiredArgsConstructor
public class TaskController {

  private final TaskService taskService;

  @PostMapping
  public ResponseEntity<TaskResponse> createTask(
      @PathVariable String teamKey,
      @PathVariable String projectKey,
      @Valid @RequestBody CreateTaskRequest request,
      Authentication authentication) {

    return ResponseEntity.status(HttpStatus.CREATED.value())
        .body(taskService.createTask(teamKey, projectKey, request, authentication.getName()));
  }

  @PatchMapping("/{taskNumber}")
  public ResponseEntity<TaskResponse> updateTask(
      @PathVariable String teamKey,
      @PathVariable String projectKey,
      @PathVariable Long taskNumber,
      @Valid @RequestBody UpdateTaskDetailsRequest request,
      Authentication authentication) {

    return ResponseEntity
        .ok(taskService.updateTask(teamKey, projectKey, taskNumber, request, authentication.getName()));
  }

  @DeleteMapping("/{taskNumber}")
  public ResponseEntity<Void> deleteTask(
      @PathVariable String teamKey,
      @PathVariable String projectKey,
      @PathVariable Long taskNumber,
      Authentication authentication) {

    taskService.deleteTask(teamKey, projectKey, taskNumber, authentication.getName());

    return ResponseEntity.noContent().build();
  }

  @GetMapping()
  public ResponseEntity<PageResponse<TaskResponse>> getTasks(
      @PathVariable String teamKey,
      @PathVariable String projectKey,
      TaskSearchRequest request,
      @PageableDefault(page = 0, size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable,
      Authentication authentication) {

    return ResponseEntity.ok(taskService.getTasks(teamKey, projectKey, request, pageable, authentication));
  }

  @GetMapping("/{taskNumber}")
  public ResponseEntity<TaskResponse> getTaskById(
      @PathVariable String teamKey,
      @PathVariable String projectKey,
      @PathVariable Long taskNumber,
      Authentication authentication) {

    return ResponseEntity.ok(taskService.getTaskById(teamKey, projectKey, taskNumber, authentication));
  }

  @GetMapping("/my-task")
  public ResponseEntity<PageResponse<TaskResponse>> getMyTasks(
      @PageableDefault(size = 10, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable,
      Authentication authentication) {

    PageResponse<TaskResponse> response = taskService.getMyTasks(authentication.getName(), pageable);

    return ResponseEntity.ok(response);
  }

  @GetMapping("/project-task")
  public ResponseEntity<PageResponse<TaskResponse>> getMyTasksByProject(
      @PathVariable String projectKey,
      @PageableDefault(size = 10, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable,
      Authentication authentication) {

    PageResponse<TaskResponse> response = taskService.getMyTasksByProject(projectKey, authentication.getName(),
        pageable);

    return ResponseEntity.ok(response);
  }

  @GetMapping("/{taskNumber}/activities")
  public ResponseEntity<PageResponse<TaskActivityResponse>> getTaskActivities(
      @PathVariable String teamKey,
      @PathVariable String projectKey,
      @PathVariable Long taskNumber,
      @PageableDefault(size = 10, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable,
      Authentication authentication) {

    return ResponseEntity.ok(taskService.getTaskActivities(teamKey, projectKey, taskNumber, pageable, authentication));
  }

  @PatchMapping("/{taskNumber}/status")
  public ResponseEntity<TaskResponse> changeStatus(
      @PathVariable String teamKey,
      @PathVariable String projectKey,
      @PathVariable Long taskNumber,
      @Valid @RequestBody ChangeStatusRequest request,
      Authentication authentication) {

    return ResponseEntity
        .ok(taskService.changeStatus(teamKey, projectKey, taskNumber, request, authentication.getName()));
  }

  @PatchMapping("/{taskNumber}/assignee/{userId}")
  public ResponseEntity<TaskResponse> changeAssignee(
      @PathVariable String teamKey,
      @PathVariable String projectKey,
      @PathVariable Long taskNumber,
      @PathVariable UUID userId,
      Authentication authentication) {

    return ResponseEntity
        .ok(taskService.changeAssignee(teamKey, projectKey, taskNumber, userId, authentication.getName()));
  }

  @PatchMapping("/{taskNumber}/support/{userId}")
  public ResponseEntity<TaskResponse> changeSupport(
      @PathVariable String teamKey,
      @PathVariable String projectKey,
      @PathVariable Long taskNumber,
      @PathVariable UUID userId,
      Authentication authentication) {

    return ResponseEntity
        .ok(taskService.changeSupport(teamKey, projectKey, taskNumber, userId, authentication.getName()));
  }

  @PostMapping("/{taskNumber}/activities")
  public ResponseEntity<TaskActivityResponse> addTaskComment(
      @PathVariable String teamKey,
      @PathVariable String projectKey,
      @PathVariable Long taskNumber,
      @Valid @RequestBody CreateTaskCommentRequest request,
      Authentication authentication) {

    return ResponseEntity
        .ok(taskService.addTaskComment(teamKey, projectKey, taskNumber, request, authentication.getName()));
  }

}
