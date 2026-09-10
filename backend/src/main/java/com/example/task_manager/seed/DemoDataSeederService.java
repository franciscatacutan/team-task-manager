// package com.example.task_manager.seed;

// import java.time.Instant;
// import java.time.temporal.ChronoUnit;
// import java.util.ArrayList;
// import java.util.LinkedHashMap;
// import java.util.List;
// import java.util.Map;
// import java.util.UUID;

// import org.springframework.security.access.prepost.PreAuthorize;
// import org.springframework.stereotype.Service;
// import org.springframework.transaction.annotation.Transactional;

// import com.example.task_manager.auth.AuthService;
// import com.example.task_manager.auth.dto.RegisterRequest;
// import com.example.task_manager.project.ProjectService;
// import com.example.task_manager.project.dto.ChangeProjectStatusRequest;
// import com.example.task_manager.project.dto.CreateProjectRequest;
// import com.example.task_manager.project.dto.ProjectResponse;
// import com.example.task_manager.project.entity.ProjectStatus;
// import com.example.task_manager.seed.dto.SeedDemoDataRequest;
// import com.example.task_manager.seed.dto.SeedDemoDataResponse;
// import com.example.task_manager.task.TaskService;
// import com.example.task_manager.task.dto.ChangeStatusRequest;
// import com.example.task_manager.task.dto.CreateTaskCommentRequest;
// import com.example.task_manager.task.dto.CreateTaskRequest;
// import com.example.task_manager.task.dto.TaskResponse;
// import com.example.task_manager.task.dto.UpdateTaskDetailsRequest;
// import com.example.task_manager.task.entity.TaskPriority;
// import com.example.task_manager.task.entity.TaskStatus;
// import com.example.task_manager.team.TeamService;
// import com.example.task_manager.team.dto.AddTeamMembersRequest;
// import com.example.task_manager.team.dto.CreateTeamRequest;
// import com.example.task_manager.team.dto.TeamMemberRequest;
// import com.example.task_manager.team.dto.TeamResponse;
// import com.example.task_manager.team.entity.TeamRole;
// import com.example.task_manager.user.UserRepository;
// import com.example.task_manager.user.entity.UserEntity;

// import lombok.RequiredArgsConstructor;

// /**
//  * Generates linked demo data on demand for local testing.
//  */
// @Service
// @RequiredArgsConstructor
// public class DemoDataSeederService {

//   private static final String SHARED_PASSWORD = "Admin123@";

//   private final AuthService authService;
//   private final UserRepository userRepository;
//   private final TeamService teamService;
//   private final ProjectService projectService;
//   private final TaskService taskService;

//   @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
//   @Transactional
//   public SeedDemoDataResponse seed(SeedDemoDataRequest request, String requesterEmail) {
//     int count = request.count();
//     String batchId = "demo-" + Instant.now().truncatedTo(ChronoUnit.SECONDS).toEpochMilli();

//     List<UserEntity> seededUsers = createUsers(count, batchId);
//     List<TeamResponse> teams = createTeams(count, batchId, requesterEmail);
//     Map<String, List<UserEntity>> teamMembers = addMembersToTeams(teams, seededUsers, requesterEmail);
//     List<ProjectResponse> projects = createProjects(count, batchId, teams, requesterEmail);
//     SeedTaskResult taskResult = createTasks(count, batchId, projects, teamMembers, requesterEmail);

//     return new SeedDemoDataResponse(
//         batchId,
//         SHARED_PASSWORD,
//         seededUsers.size(),
//         teams.size(),
//         projects.size(),
//         taskResult.tasksCreated(),
//         taskResult.commentsCreated(),
//         seededUsers.isEmpty() ? null : seededUsers.get(0).getEmail(),
//         requesterEmail);
//   }

//   private List<UserEntity> createUsers(int count, String batchId) {
//     List<UserEntity> users = new ArrayList<>(count);

//     for (int index = 0; index < count; index++) {
//       int number = index + 1;
//       String email = batchId + ".user" + String.format("%03d", number) + "@example.com";

//       authService.register(new RegisterRequest(
//           email,
//           "Demo" + number,
//           "User" + number,
//           SHARED_PASSWORD),
//           null, null);

//       UserEntity user = userRepository.findByEmail(email)
//           .orElseThrow();

//       users.add(user);
//     }

//     return users;
//   }

//   private List<TeamResponse> createTeams(int count, String batchId, String requesterEmail) {
//     List<TeamResponse> teams = new ArrayList<>(count);

//     for (int index = 0; index < count; index++) {
//       int number = index + 1;
//       teams.add(teamService.createTeam(
//           new CreateTeamRequest(
//               "Demo Team " + number + " [" + batchId + "]",
//               "Seeded team " + number + " for UI and workflow testing."),
//           requesterEmail));
//     }

//     return teams;
//   }

//   private Map<String, List<UserEntity>> addMembersToTeams(
//       List<TeamResponse> teams,
//       List<UserEntity> seededUsers,
//       String requesterEmail) {
//     Map<String, List<UserEntity>> teamMembers = new LinkedHashMap<>();
//     UserEntity requester = userRepository.findByEmail(requesterEmail).orElseThrow();

//     for (int index = 0; index < teams.size(); index++) {
//       TeamResponse team = teams.get(index);
//       List<UserEntity> members = new ArrayList<>();
//       members.add(requester);
//       List<TeamMemberRequest> requests = new ArrayList<>();

//       int memberTarget = Math.min(seededUsers.size(), 3 + (index % 3));

//       for (int offset = 0; offset < memberTarget; offset++) {
//         UserEntity candidate = seededUsers.get((index + offset) % seededUsers.size());
//         boolean alreadyAdded = members.stream()
//             .anyMatch(member -> member.getId().equals(candidate.getId()));

//         if (alreadyAdded)
//           continue;

//         TeamRole role = (offset == 0 && index % 2 == 0)
//             ? TeamRole.ADMIN
//             : TeamRole.MEMBER;

//         requests.add(new TeamMemberRequest(candidate.getId(), role));
//         members.add(candidate);
//       }

//       if (!requests.isEmpty()) {
//         teamService.addMembers(
//             team.key(),
//             new AddTeamMembersRequest(requests),
//             requesterEmail);
//       }

//       teamMembers.put(team.key(), members);
//     }

//     return teamMembers;
//   }

//   private List<ProjectResponse> createProjects(
//       int count,
//       String batchId,
//       List<TeamResponse> teams,
//       String requesterEmail) {
//     List<ProjectResponse> projects = new ArrayList<>(count);

//     for (int index = 0; index < count; index++) {
//       int number = index + 1;
//       TeamResponse team = teams.get(index % teams.size());

//       ProjectResponse project = projectService.createProject(
//           team.key(),
//           new CreateProjectRequest(
//               "Demo Project " + number + " [" + batchId + "]",
//               "Seeded project " + number + " used to populate project lists and history.",
//               Instant.now().plus(number, ChronoUnit.DAYS),
//               Instant.now().plus(number + 30, ChronoUnit.DAYS)),
//           requesterEmail);

//       if (number % 5 == 0) {
//         project = projectService.changeProjectStatus(
//             team.key(),
//             project.id(),
//             new ChangeProjectStatusRequest(ProjectStatus.ON_HOLD),
//             requesterEmail);
//       } else if (number % 7 == 0) {
//         project = projectService.changeProjectStatus(
//             team.key(),
//             project.id(),
//             new ChangeProjectStatusRequest(ProjectStatus.COMPLETED),
//             requesterEmail);
//       }

//       projects.add(project);
//     }

//     return projects;
//   }

//   private SeedTaskResult createTasks(
//       int count,
//       String batchId,
//       List<ProjectResponse> projects,
//       Map<UUID, List<UserEntity>> teamMembers,
//       String requesterEmail) {
//     int commentsCreated = 0;

//     for (int index = 0; index < count; index++) {
//       int number = index + 1;
//       ProjectResponse project = projects.get(index % projects.size());
//       List<UserEntity> members = teamMembers.get(project.teamId());

//       UserEntity assignee = members.get(number % members.size());
//       UserEntity support = members.size() > 1
//           ? members.get((number + 1) % members.size())
//           : null;

//       if (support != null && support.getId().equals(assignee.getId())) {
//         support = null;
//       }

//       Instant plannedStart = Instant.now().plus(number, ChronoUnit.DAYS);
//       Instant plannedDue = plannedStart.plus(3 + (number % 5), ChronoUnit.DAYS);

//       TaskResponse task = taskService.createTask(
//           project.teamId(),
//           project.id(),
//           new CreateTaskRequest(
//               "Demo Task " + number + " [" + batchId + "]",
//               "Seeded task " + number + " with realistic metadata and activity.",
//               pickPriority(number),
//               plannedStart,
//               plannedDue,
//               assignee.getId(),
//               support == null ? null : support.getId()),
//           requesterEmail);

//       if (number % 3 == 0) {
//         task = taskService.updateTask(
//             project.teamId(),
//             project.id(),
//             task.id(),
//             new UpdateTaskDetailsRequest(
//                 task.title() + " updated",
//                 "Refined seeded task details for history testing.",
//                 pickPriority(number + 1),
//                 plannedStart.plus(1, ChronoUnit.DAYS),
//                 plannedDue.plus(1, ChronoUnit.DAYS)),
//             requesterEmail);
//       }

//       if (members.size() > 2 && number % 4 == 0) {
//         UserEntity replacementAssignee = members.get((number + 2) % members.size());
//         if (!replacementAssignee.getId().equals(task.assignedUser().id())) {
//           task = taskService.changeAssignee(
//               project.teamId(),
//               project.id(),
//               task.id(),
//               replacementAssignee.getId(),
//               requesterEmail);
//         }
//       }

//       if (members.size() > 2 && number % 5 == 0) {
//         UserEntity replacementSupport = members.get((number + 1) % members.size());
//         if (!replacementSupport.getId().equals(task.assignedUser().id())) {
//           taskService.changeSupport(
//               project.teamId(),
//               project.id(),
//               task.id(),
//               replacementSupport.getId(),
//               requesterEmail);
//         }
//       }

//       if (number % 2 == 0) {
//         taskService.changeStatus(
//             project.teamId(),
//             project.id(),
//             task.id(),
//             new ChangeStatusRequest(TaskStatus.IN_PROGRESS),
//             requesterEmail);
//       }

//       if (number % 6 == 0) {
//         taskService.changeStatus(
//             project.teamId(),
//             project.id(),
//             task.id(),
//             new ChangeStatusRequest(TaskStatus.IN_REVIEW),
//             requesterEmail);
//       }

//       if (number % 9 == 0) {
//         taskService.changeStatus(
//             project.teamId(),
//             project.id(),
//             task.id(),
//             new ChangeStatusRequest(TaskStatus.DONE),
//             requesterEmail);
//       }

//       if (number % 2 == 1) {
//         taskService.addTaskComment(
//             project.teamId(),
//             project.id(),
//             task.id(),
//             new CreateTaskCommentRequest("Seeded progress note for task " + number + "."),
//             requesterEmail);
//         commentsCreated++;
//       }
//     }

//     return new SeedTaskResult(count, commentsCreated);
//   }

//   private TaskPriority pickPriority(int number) {
//     return switch (number % 4) {
//       case 0 -> TaskPriority.CRITICAL;
//       case 1 -> TaskPriority.HIGH;
//       case 2 -> TaskPriority.MEDIUM;
//       default -> TaskPriority.LOW;
//     };
//   }

//   private record SeedTaskResult(int tasksCreated, int commentsCreated) {
//   }
// }
