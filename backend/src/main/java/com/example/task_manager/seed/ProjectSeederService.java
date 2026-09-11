// package com.example.task_manager.seed;

// import java.util.ArrayList;
// import java.util.List;
// import java.util.UUID;
// import java.time.Instant;
// import java.time.temporal.ChronoUnit;

// import org.springframework.stereotype.Service;

// import com.example.task_manager.project.ProjectService;
// import com.example.task_manager.project.dto.ChangeProjectStatusRequest;
// import com.example.task_manager.project.dto.CreateProjectRequest;
// import com.example.task_manager.project.dto.ProjectResponse;
// import com.example.task_manager.project.entity.ProjectStatus;

// import jakarta.transaction.Transactional;
// import lombok.RequiredArgsConstructor;

// @Service
// @RequiredArgsConstructor
// public class ProjectSeederService {

// private final ProjectService projectService;

// @Transactional
// public List<ProjectResponse> seedProjects(
// UUID teamId,
// int count,
// String batchId,
// String requesterEmail) {

// List<ProjectResponse> projects = new ArrayList<>(count);

// for (int i = 0; i < count; i++) {
// int number = i + 1;

// ProjectResponse project = projectService.createProject(
// teamId,
// new CreateProjectRequest(
// "Demo Project " + number + " [" + batchId + "]",
// "Seeded project " + number + " used to populate project lists and history.",
// Instant.now().plus(number, ChronoUnit.DAYS),
// Instant.now().plus(number + 30, ChronoUnit.DAYS)),
// requesterEmail);

// if (number % 5 == 0) {
// project = projectService.changeProjectStatus(
// teamId,
// project.id(),
// new ChangeProjectStatusRequest(ProjectStatus.ON_HOLD),
// requesterEmail);
// } else if (number % 7 == 0) {
// project = projectService.changeProjectStatus(
// teamId,
// project.id(),
// new ChangeProjectStatusRequest(ProjectStatus.COMPLETED),
// requesterEmail);
// }

// projects.add(project);
// }

// return projects;
// }
// }
