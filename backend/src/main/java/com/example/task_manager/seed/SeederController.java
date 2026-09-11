// package com.example.task_manager.seed;

// import java.time.Instant;
// import java.time.temporal.ChronoUnit;
// import java.util.UUID;

// import org.springframework.http.ResponseEntity;
// import org.springframework.security.core.Authentication;
// import org.springframework.web.bind.annotation.GetMapping;
// import org.springframework.web.bind.annotation.PathVariable;
// import org.springframework.web.bind.annotation.PostMapping;
// import org.springframework.web.bind.annotation.RequestBody;
// import org.springframework.web.bind.annotation.RequestMapping;
// import org.springframework.web.bind.annotation.RestController;

// import com.example.task_manager.seed.dto.SeedDemoDataRequest;
// import com.example.task_manager.seed.dto.SeedDemoDataResponse;

// import jakarta.validation.Valid;
// import lombok.RequiredArgsConstructor;

// /**
//  * Admin endpoint for generating local demo data on demand.
//  */
// @RestController
// @RequestMapping("/api/dev/seed")
// @RequiredArgsConstructor
// public class SeederController {

//   private final DemoDataSeederService demoDataSeederService;
//   private final UserSeederService userSeederService;
//   private final TeamSeederService teamSeederService;
//   private final ProjectSeederService projectSeederService;
//   private final TaskSeederService taskSeederService;

//   @GetMapping("/test")
//   public ResponseEntity<String> TEST() {
//     return ResponseEntity.ok("TEST");
//   }

//   @PostMapping("/all")
//   public ResponseEntity<SeedDemoDataResponse> seedDemoData(
//       @Valid @RequestBody SeedDemoDataRequest request,
//       Authentication authentication) {
//     return ResponseEntity.ok(demoDataSeederService.seed(request, authentication.getName()));
//   }

//   @PostMapping("/users")
//   public ResponseEntity<?> seedUsers(
//       @Valid @RequestBody SeedDemoDataRequest request) {
//     String batchId = generateBatchId();
//     return ResponseEntity.ok(userSeederService.seedUsers(request.count(), batchId));
//   }

//   @PostMapping("/teams")
//   public ResponseEntity<?> seedTeams(
//       @Valid @RequestBody SeedDemoDataRequest request,
//       Authentication auth) {
//     String batchId = generateBatchId();
//     return ResponseEntity.ok(
//         teamSeederService.seedTeams(request.count(), batchId, auth.getName()));
//   }

//   @PostMapping("/teams/{teamId}/projects")
//   public ResponseEntity<?> seedProjects(
//       @PathVariable UUID teamId,
//       @Valid @RequestBody SeedDemoDataRequest request,
//       Authentication auth) {
//     String batchId = generateBatchId();
//     return ResponseEntity.ok(
//         projectSeederService.seedProjects(teamId, request.count(), batchId, auth.getName()));
//   }

//   @PostMapping("/teams/{teamId}/projects/{projectId}/tasks")
//   public ResponseEntity<?> seedTasks(
//       @PathVariable UUID teamId,
//       @PathVariable UUID projectId,
//       @Valid @RequestBody SeedDemoDataRequest request,
//       Authentication auth) {
//     String batchId = generateBatchId();
//     return ResponseEntity.ok(
//         taskSeederService.seedTasks(teamId, projectId, request.count(), batchId, auth.getName()));
//   }

//   private String generateBatchId() {
//     return "demo-" + Instant.now().truncatedTo(ChronoUnit.SECONDS).toEpochMilli();
//   }
// }
