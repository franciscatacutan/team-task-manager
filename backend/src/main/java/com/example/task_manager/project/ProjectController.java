package com.example.task_manager.project;

import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.example.task_manager.common.PageResponse;
import com.example.task_manager.project.dto.ChangeProjectStatusRequest;
import com.example.task_manager.project.dto.CreateProjectRequest;
import com.example.task_manager.project.dto.ProjectActivityResponse;
import com.example.task_manager.project.dto.ProjectResponse;
import com.example.task_manager.project.dto.ProjectSearchRequest;
import com.example.task_manager.project.dto.UpdateProjectDetailsRequest;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/**
 * REST controller for managing projects.
 */
@RestController
@RequestMapping("/api/teams/{teamKey}/projects")
@RequiredArgsConstructor
public class ProjectController {

  private final ProjectService projectService;

  @PostMapping
  public ResponseEntity<ProjectResponse> createProject(
      @PathVariable String teamKey,
      @Valid @RequestBody CreateProjectRequest request,
      Authentication authentication) {

    return ResponseEntity.status(HttpStatus.CREATED)
        .body(projectService.createProject(teamKey, request, authentication.getName()));

  }

  @PatchMapping("/{projectKey}")
  public ResponseEntity<ProjectResponse> updateProject(
      @PathVariable String teamKey,
      @PathVariable String projectKey,
      @Valid @RequestBody UpdateProjectDetailsRequest request,
      Authentication authentication) {

    return ResponseEntity.ok(projectService.updateProject(teamKey, projectKey, request, authentication.getName()));
  }

  @DeleteMapping("/{projectKey}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public ResponseEntity<Void> deleteProject(
      @PathVariable String teamKey,
      @PathVariable String projectKey,
      Authentication authentication) {

    projectService.deleteProject(teamKey, projectKey, authentication.getName());

    return ResponseEntity.noContent().build();
  }

  @GetMapping
  public ResponseEntity<PageResponse<ProjectResponse>> getProjects(
      @PathVariable String teamKey,
      @ModelAttribute ProjectSearchRequest request,
      @PageableDefault(page = 0, size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable,
      Authentication authentication) {

    return ResponseEntity.ok(projectService.getProjects(teamKey, request, pageable, authentication));
  }

  @GetMapping("/{projectKey}")
  public ResponseEntity<ProjectResponse> getProjectById(
      @PathVariable String teamKey,
      @PathVariable String projectKey,
      Authentication authentication) {
    return ResponseEntity.ok(projectService.getProjectById(teamKey, projectKey, authentication));
  }

  @GetMapping("/{projectKey}/activities")
  public ResponseEntity<PageResponse<ProjectActivityResponse>> getProjectActivities(
      @PathVariable String teamKey,
      @PathVariable String projectKey,
      @PageableDefault(size = 10, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable,
      Authentication authentication) {
    return ResponseEntity.ok(projectService.getProjectActivities(teamKey, projectKey, pageable, authentication));
  }

  @PatchMapping("/{projectKey}/status")
  public ResponseEntity<ProjectResponse> changeStatus(
      @PathVariable String teamKey,
      @PathVariable String projectKey,
      @Valid @RequestBody ChangeProjectStatusRequest request,
      Authentication authentication) {
    return ResponseEntity
        .ok(projectService.changeProjectStatus(teamKey, projectKey, request, authentication.getName()));
  }
}
