package com.example.task_manager.team;

import java.util.UUID;

import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.data.domain.Sort;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.example.task_manager.common.PageResponse;
import com.example.task_manager.team.dto.AddTeamMembersRequest;
import com.example.task_manager.team.dto.AddTeamMembersResponse;
import com.example.task_manager.team.dto.ChangeTeamRoleRequest;
import com.example.task_manager.team.dto.CreateTeamRequest;
import com.example.task_manager.team.dto.RemoveTeamMembersRequest;
import com.example.task_manager.team.dto.RemoveTeamMembersResponse;
import com.example.task_manager.team.dto.TeamActivityResponse;
import com.example.task_manager.team.dto.TeamMeResponse;
import com.example.task_manager.team.dto.TeamMemberResponse;
import com.example.task_manager.team.dto.TeamMemberSearchRequest;
import com.example.task_manager.team.dto.TeamResponse;
import com.example.task_manager.team.dto.TeamSearchRequest;
import com.example.task_manager.team.dto.UpdateTeamRequest;
import com.example.task_manager.user.dto.UserResponse;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/**
 * REST controller for managing teams.
 */
@RestController
@RequestMapping("/api/teams")
@RequiredArgsConstructor
public class TeamController {

  private final TeamService teamService;

  @PostMapping
  public ResponseEntity<TeamResponse> create(
      @Valid @RequestBody CreateTeamRequest request,
      Authentication authentication) {
    return ResponseEntity.status(HttpStatus.CREATED).body(teamService.createTeam(request, authentication.getName()));
  }

  @PatchMapping("/{teamKey}")
  public ResponseEntity<TeamResponse> updateTeam(
      @PathVariable String teamKey,
      @Valid @RequestBody UpdateTeamRequest request,
      Authentication authentication) {
    return ResponseEntity.ok(teamService.updateTeam(teamKey, request, authentication.getName()));
  }

  @DeleteMapping("/{teamKey}")
  public ResponseEntity<Void> deleteTeam(
      @PathVariable String teamKey,
      Authentication authentication) {
    teamService.deleteTeam(teamKey, authentication.getName());
    return ResponseEntity.noContent().build();
  }

  @GetMapping
  public ResponseEntity<PageResponse<TeamResponse>> getTeams(
      @ModelAttribute TeamSearchRequest request,
      @PageableDefault(page = 0, size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable,
      Authentication authentication) {

    return ResponseEntity.ok(teamService.getTeams(request, pageable, authentication));
  }

  @GetMapping("/{teamKey}")
  public ResponseEntity<TeamResponse> getTeamById(
      @PathVariable String teamKey,
      Authentication authentication) {

    return ResponseEntity.ok(teamService.getTeamByKey(teamKey, authentication));
  }

  @GetMapping("/{teamKey}/members")
  public ResponseEntity<PageResponse<TeamMemberResponse>> getTeamMembers(
      @ModelAttribute TeamMemberSearchRequest request,
      @PathVariable String teamKey,
      @PageableDefault(page = 0, size = 20, sort = "joinedAt", direction = Sort.Direction.DESC) Pageable pageable,
      Authentication authentication) {
    return ResponseEntity.ok(teamService.getTeamMembers(request, teamKey, pageable, authentication));
  }

  @GetMapping("/{teamKey}/available-users")
  public ResponseEntity<PageResponse<UserResponse>> getAvailableUsers(
      @PathVariable String teamKey,
      @RequestParam(required = false) String search,
      @PageableDefault(page = 0, size = 20, sort = "lastName", direction = Sort.Direction.DESC) Pageable pageable,
      Authentication authentication) {
    return ResponseEntity.ok(teamService.getAvailableUsers(search, teamKey, pageable, authentication));
  }

  @GetMapping("/{teamKey}/me")
  public ResponseEntity<TeamMeResponse> getMyTeamRole(
      @PathVariable String teamKey,
      Authentication authentication) {
    return ResponseEntity.ok(teamService.getMyTeamRole(teamKey, authentication.getName()));
  }

  @GetMapping("/{teamKey}/activities")
  public ResponseEntity<PageResponse<TeamActivityResponse>> getTeamActivities(
      @PathVariable String teamKey,
      @PageableDefault(size = 10, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable,
      Authentication authentication) {
    return ResponseEntity.ok(teamService.getTeamActivities(teamKey, pageable, authentication));
  }

  @PostMapping("/{teamKey}/members")
  public ResponseEntity<AddTeamMembersResponse> addMembers(
      @PathVariable String teamKey,
      @Valid @RequestBody AddTeamMembersRequest request,
      Authentication authentication) {
    return ResponseEntity.status(HttpStatus.CREATED)
        .body(teamService.addMembers(teamKey, request, authentication.getName()));
  }

  @DeleteMapping("/{teamKey}/members")
  public ResponseEntity<RemoveTeamMembersResponse> removeMembers(
      @PathVariable String teamKey,
      @Valid @RequestBody RemoveTeamMembersRequest request,
      Authentication authentication) {
    return ResponseEntity.ok(teamService.removeMembers(teamKey, request, authentication.getName()));
  }

  @PatchMapping("/{teamKey}/members/{userId}/role")
  public ResponseEntity<TeamMemberResponse> changeTeamRole(
      @PathVariable String teamKey,
      @PathVariable UUID userId,
      @Valid @RequestBody ChangeTeamRoleRequest request,
      Authentication authentication) {
    return ResponseEntity.ok(teamService.changeTeamRole(teamKey, userId, request.role(), authentication.getName()));
  }

  @PatchMapping("/{teamKey}/transfer/{userId}")
  public ResponseEntity<TeamMemberResponse> transferOwnership(
      @PathVariable String teamKey,
      @PathVariable UUID userId,
      Authentication authentication) {
    return ResponseEntity.ok(teamService.transferOwnership(teamKey, userId, authentication.getName()));
  }

}
