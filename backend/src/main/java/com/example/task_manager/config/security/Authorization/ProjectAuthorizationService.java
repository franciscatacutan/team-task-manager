package com.example.task_manager.config.security.Authorization;

import java.util.UUID;

import org.springframework.stereotype.Component;

import com.example.task_manager.exception.api.ResourceNotFoundException;
import com.example.task_manager.project.ProjectRepository;
import com.example.task_manager.project.entity.ProjectEntity;

import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class ProjectAuthorizationService {

  private final ProjectRepository projectRepository;

  /**
   * Ensure project exist
   * Return an active project
   */
  public ProjectEntity requireActiveProject(String projectKey, UUID teamId) {
    return projectRepository
        .findByKeyAndTeamIdAndDeletedAtIsNull(projectKey, teamId)
        .orElseThrow(() -> new ResourceNotFoundException("Project not found"));
  }

  /**
   * Ensure project exist
   * Return an existing project
   */
  public ProjectEntity requireProject(String projectKey, String teamKey) {
    return projectRepository.findByKeyAndTeamKey(projectKey, teamKey)
        .orElseThrow(() -> new ResourceNotFoundException("Project not found"));
  }

}
