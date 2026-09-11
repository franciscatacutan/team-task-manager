// package com.example.task_manager.seed;

// import java.time.Instant;
// import java.time.temporal.ChronoUnit;
// import java.util.ArrayList;
// import java.util.List;
// import java.util.UUID;

// import org.springframework.stereotype.Service;

// import com.example.task_manager.exception.api.ResourceNotFoundException;
// import com.example.task_manager.project.ProjectRepository;
// import com.example.task_manager.task.TaskService;
// import com.example.task_manager.task.dto.ChangeStatusRequest;
// import com.example.task_manager.task.dto.CreateTaskRequest;
// import com.example.task_manager.task.dto.TaskResponse;
// import com.example.task_manager.task.entity.TaskPriority;
// import com.example.task_manager.task.entity.TaskStatus;
// import com.example.task_manager.team.TeamMemberRepository;
// import com.example.task_manager.team.entity.TeamMemberEntity;

// import jakarta.transaction.Transactional;
// import lombok.RequiredArgsConstructor;

// @Service
// @RequiredArgsConstructor
// public class TaskSeederService {

//   private final TaskService taskService;
//   private final ProjectRepository projectRepository;
//   private final TeamMemberRepository teamMemberRepository;

//   @Transactional
//   public List<TaskResponse> seedTasks(
//       UUID teamId,
//       UUID projectId,
//       int count,
//       String batchId,
//       String requesterEmail) {

//     if (!projectRepository.existsByIdAndTeamIdAndDeletedAtIsNull(projectId, teamId)) {
//       throw new ResourceNotFoundException("Project not found");
//     }

//     List<TeamMemberEntity> members = teamMemberRepository.findMembersByTeamId(teamId);

//     if (members.isEmpty()) {
//       throw new IllegalStateException("Team has no members");
//     }

//     List<TaskResponse> tasks = new ArrayList<>(count);

//     for (int index = 0; index < count; index++) {
//       int number = index + 1;

//       TeamMemberEntity assignee = members.get(number % members.size());

//       TeamMemberEntity support = members.size() > 1
//           ? members.get((number + 1) % members.size())
//           : null;

//       if (support != null && support.getUser().getId().equals(assignee.getUser().getId())) {
//         support = null;
//       }

//       Instant plannedStart = Instant.now().plus(number, ChronoUnit.DAYS);
//       Instant plannedDue = plannedStart.plus(3 + (number % 5), ChronoUnit.DAYS);

//       TaskResponse task = taskService.createTask(
//           teamId,
//           projectId,
//           new CreateTaskRequest(
//               "Demo Task " + number + " [" + batchId + "]",
//               "Seeded task " + number + " with realistic metadata and activity.",
//               pickPriority(number),
//               plannedStart,
//               plannedDue,
//               assignee.getUser().getId(),
//               support == null ? null : support.getUser().getId()),
//           requesterEmail);

//       // ✅ Status simulation (same as before)
//       if (number % 2 == 0) {
//         taskService.changeStatus(
//             teamId,
//             projectId,
//             task.id(),
//             new ChangeStatusRequest(TaskStatus.IN_PROGRESS),
//             requesterEmail);
//       }

//       if (number % 3 == 0) {
//         taskService.changeStatus(
//             teamId,
//             projectId,
//             task.id(),
//             new ChangeStatusRequest(TaskStatus.IN_REVIEW),
//             requesterEmail);
//       }

//       if (number % 5 == 0) {
//         taskService.changeStatus(
//             teamId,
//             projectId,
//             task.id(),
//             new ChangeStatusRequest(TaskStatus.DONE),
//             requesterEmail);
//       }

//       tasks.add(task);
//     }

//     return tasks;
//   }

//   private TaskPriority pickPriority(int number) {
//     return switch (number % 4) {
//       case 0 -> TaskPriority.CRITICAL;
//       case 1 -> TaskPriority.HIGH;
//       case 2 -> TaskPriority.MEDIUM;
//       default -> TaskPriority.LOW;
//     };
//   }
// }
