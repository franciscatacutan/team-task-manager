package com.example.task_manager.team;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.task_manager.activity.ActivityEventRepository;
import com.example.task_manager.activity.ActivityEventService;
import com.example.task_manager.activity.dto.ActivityEventDetails;
import com.example.task_manager.activity.dto.ActivityEventType;
import com.example.task_manager.activity.entity.ActivityEventEntity;
import com.example.task_manager.common.PageResponse;
import com.example.task_manager.common.KeyGenerator;
import com.example.task_manager.config.security.Authorization.GlobalAuthorizationService;
import com.example.task_manager.config.security.Authorization.TeamAuthorizationService;
import com.example.task_manager.exception.api.BadRequestInputException;
import com.example.task_manager.exception.api.ConflictException;
import com.example.task_manager.exception.api.ForbiddenException;
import com.example.task_manager.exception.api.ResourceNotFoundException;
import com.example.task_manager.project.ProjectRepository;
import com.example.task_manager.project.entity.ProjectEntity;
import com.example.task_manager.task.TaskRepository;
import com.example.task_manager.task.entity.TaskEntity;
import com.example.task_manager.team.dto.AddTeamMembersRequest;
import com.example.task_manager.team.dto.AddTeamMembersResponse;
import com.example.task_manager.team.dto.CreateTeamRequest;
import com.example.task_manager.team.dto.FailedMember;
import com.example.task_manager.team.dto.RemoveTeamMembersRequest;
import com.example.task_manager.team.dto.RemoveTeamMembersResponse;
import com.example.task_manager.team.dto.TeamActivityResponse;
import com.example.task_manager.team.dto.TeamMeResponse;
import com.example.task_manager.team.dto.TeamMemberRequest;
import com.example.task_manager.team.dto.TeamMemberResponse;
import com.example.task_manager.team.dto.TeamMemberSearchRequest;
import com.example.task_manager.team.dto.TeamResponse;
import com.example.task_manager.team.dto.TeamSearchRequest;
import com.example.task_manager.team.dto.UpdateTeamRequest;
import com.example.task_manager.team.entity.TeamEntity;
import com.example.task_manager.team.entity.TeamMemberEntity;
import com.example.task_manager.team.entity.TeamRole;
import com.example.task_manager.user.UserRepository;
import com.example.task_manager.user.UserSpecification;
import com.example.task_manager.user.dto.UserResponse;
import com.example.task_manager.user.entity.UserEntity;

import lombok.RequiredArgsConstructor;

/**
 * Contains business logic for managing teams.
 */
@Service
@RequiredArgsConstructor
public class TeamService {

  private static final Set<String> ALLOWED_SORT_FIELDS = Set.of(
      "name",
      "lastName",
      "owner",
      "lastActivityAt",
      "joinedAt",
      "createdAt",
      "updatedAt",
      "user.lastName",
      "user.email",
      "role");

  private final TeamRepository teamRepository;
  private final TeamMemberRepository teamMemberRepository;
  private final UserRepository userRepository;
  private final ProjectRepository projectRepository;
  private final TaskRepository taskRepository;
  private final ActivityEventRepository activityEventRepository;
  private final ActivityEventService activityEventService;
  private final GlobalAuthorizationService globalAuthorizationService;
  private final TeamAuthorizationService teamAuthorizationService;
  private final KeyGenerator keyGenerator;

  /**
   * Creates a new team for the authenticated user.
   * Sets user as the owner
   * Team name must be unique
   * 
   */
  @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
  @Transactional
  public TeamResponse createTeam(
      CreateTeamRequest request,
      String userEmail) {

    UserEntity owner = globalAuthorizationService.getUserByEmail(userEmail);

    String trimmedName = normalizeTeamName(request.name());

    validateUniqueTeamName(owner.getId(), trimmedName);

    TeamEntity team = new TeamEntity();
    team.setName(request.name().trim());
    team.setDescription(request.description());
    team.setKey(generateUniqueKey());
    team.setOwner(owner);
    team.setCreatedBy(owner);
    team.setOwnerChangedAt(Instant.now());
    team.setMembershipChangedAt(Instant.now());

    // Flush immediately so unique-constraint violations are caught here
    // and mapped to a domain conflict.
    try {
      teamRepository.saveAndFlush(team);
    } catch (DataIntegrityViolationException ex) {
      throw new ConflictException("Team name already exists for User");
    }

    TeamMemberEntity ownerMember = new TeamMemberEntity();
    ownerMember.setTeam(team);
    ownerMember.setUser(owner);
    ownerMember.setRole(TeamRole.OWNER);
    ownerMember.setAddedBy(owner);

    teamMemberRepository.save(ownerMember);

    activityEventService.recordTeamEvent(
        team,
        owner,
        ActivityEventType.TEAM_CREATED,
        buildTeamActivityDetails(
            List.of("name", "description", "owner"),
            null,
            null,
            null,
            List.of(
                activityEventService.change("name", "name", null, team.getName()),
                activityEventService.change("description", "description", null, team.getDescription()),
                activityEventService.change("owner", "owner", null, owner.getFullName())),
            owner),
        null);

    return mapToResponse(team);
  }

  /**
   * Updates team information.
   * Only Owner can update the team
   */
  @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
  @Transactional
  public TeamResponse updateTeam(
      String teamKey,
      UpdateTeamRequest request,
      String requesterEmail) {

    UserEntity requester = globalAuthorizationService.getUserByEmail(requesterEmail);

    TeamEntity team = teamAuthorizationService.requireActiveTeam(teamKey);

    validateOwnerMembership(team.getId(), requester.getId());

    String previousName = team.getName();
    String previousDescription = team.getDescription();

    if (request.name() != null) {

      if (request.name().isBlank()) {
        throw new BadRequestInputException("Team name cannot be blank");
      }

      String trimmedName = normalizeTeamName(request.name());

      if (!team.getName().equalsIgnoreCase(request.name().trim())) {
        validateUniqueTeamName(team.getOwner().getId(), trimmedName);
      }

      team.setName(request.name().trim());
    }

    if (request.description() != null) {
      team.setDescription(request.description().trim());
    }

    TeamDetailsUpdateMessage updateMessage = buildTeamUpdateMessage(
        previousName,
        previousDescription,
        team.getName(),
        team.getDescription());

    if (!updateMessage.fields().isEmpty()) {
      activityEventService.recordTeamEvent(
          team,
          requester,
          ActivityEventType.TEAM_UPDATED,
          buildTeamActivityDetails(
              updateMessage.fields(),
              null,
              null,
              null,
              updateMessage.changes(),
              null),
          updateMessage.message());
    }

    return mapToResponse(team);
  }

  /**
   * Soft-deletes a team and cascades soft-delete to all dependent data.
   * Only Owner can soft-delete team
   */
  @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
  @Transactional
  public void deleteTeam(
      String teamKey,
      String requesterEmail) {

    UserEntity requester = globalAuthorizationService.getUserByEmail(requesterEmail);

    TeamEntity team = teamAuthorizationService.requireActiveTeam(teamKey);

    validateOwnerMembership(team.getId(), requester.getId());

    Instant now = Instant.now();
    List<TaskEntity> activeTasks = taskRepository
        .findAllByProjectTeamIdAndDeletedAtIsNull(team.getId());
    List<ProjectEntity> activeProjects = projectRepository
        .findAllByTeamIdAndDeletedAtIsNull(team.getId());

    team.setDeletedAt(now);
    team.setDeletedBy(requester);

    for (TaskEntity task : activeTasks) {
      task.setDeletedAt(now);
      activityEventService.recordTaskEvent(
          task,
          requester,
          ActivityEventType.TASK_DELETED,
          activityEventService.emptyDetails(),
          null);
    }

    for (ProjectEntity project : activeProjects) {
      project.setDeletedAt(now);
      activityEventService.recordProjectEvent(
          project,
          requester,
          ActivityEventType.PROJECT_DELETED,
          activityEventService.emptyDetails(),
          null);
    }

    activityEventService.recordTeamEvent(
        team,
        requester,
        ActivityEventType.TEAM_DELETED,
        activityEventService.emptyDetails(),
        null);
  }

  /**
   * Retrieves teams with support for:
   * - Search
   * - Filtering
   * - Sorting
   * - Pagination
   * - Role-based soft-delete visibility
   */
  @Transactional(readOnly = true)
  public PageResponse<TeamResponse> getTeams(
      TeamSearchRequest request,
      Pageable pageable,
      Authentication authentication) {

    UserEntity requester = globalAuthorizationService.getUserByEmail(authentication.getName());
    boolean isGlobalAdmin = globalAuthorizationService.isGlobalAdmin(requester);

    Specification<TeamEntity> spec = TeamSpecification.build(
        requester.getId(),
        request.search(),
        request.ownerId(),
        request.memberId(),
        request.deletedFilter(),
        isGlobalAdmin);

    pageable = requireSortable(pageable);

    Page<TeamEntity> page = teamRepository.findAll(spec, pageable);

    return toPageResponse(page, this::mapToResponse);
  }

  /**
   * Returns a team by id.
   * Only Global Admin, Owner and Team Admin can view deleted team
   */
  @Transactional(readOnly = true)
  public TeamResponse getTeamByKey(
      String teamKey,
      Authentication authentication) {

    UserEntity requester = globalAuthorizationService.getUserByEmail(authentication.getName());
    TeamEntity team = teamAuthorizationService.requireTeam(normalizeTeamKey(teamKey));

    validateCanReadTeam(team, requester);

    return mapToResponse(team);
  }

  /**
   * Returns all the team's members.
   */
  @Transactional(readOnly = true)
  public PageResponse<TeamMemberResponse> getTeamMembers(
      TeamMemberSearchRequest request,
      String teamKey,
      Pageable pageable,
      Authentication authentication) {

    UserEntity requester = globalAuthorizationService.getUserByEmail(authentication.getName());
    TeamEntity team = teamAuthorizationService.requireTeam(normalizeTeamKey(teamKey));
    validateCanReadTeam(team, requester);

    Specification<TeamMemberEntity> spec = TeamMemberSpecification.build(
        team.getId(),
        request.search(),
        request.roles());

    pageable = requireSortable(pageable);

    Page<TeamMemberEntity> page = teamMemberRepository.findAll(spec, pageable);

    return toPageResponse(page, this::mapToMemberResponse);
  }

  /**
   * Returns all the user that's not part of the team .
   */
  @Transactional(readOnly = true)
  public PageResponse<UserResponse> getAvailableUsers(
      String search,
      String teamKey,
      Pageable pageable,
      Authentication authentication) {

    UserEntity requester = globalAuthorizationService.getUserByEmail(authentication.getName());

    TeamEntity team = teamAuthorizationService.requireActiveTeam(teamKey);

    if (!globalAuthorizationService.isGlobalAdmin(requester)) {
      requireManagerMembership(team.getId(), requester.getId());
    }

    Specification<UserEntity> spec = UserSpecification.availableUsers(teamKey, search);

    pageable = requireSortable(pageable);

    Page<UserEntity> page = userRepository.findAll(spec, pageable);

    return toPageResponse(page, this::mapToNonMemberResponse);
  }

  /**
   * Returns user's team role.
   */
  @Transactional(readOnly = true)
  public TeamMeResponse getMyTeamRole(
      String teamKey,
      String requesterEmail) {

    UserEntity requester = globalAuthorizationService.getUserByEmail(requesterEmail);
    TeamEntity team = teamAuthorizationService.requireTeam(normalizeTeamKey(teamKey));

    return teamMemberRepository.findByTeamIdAndUserId(team.getId(), requester.getId())
        .map(member -> {
          validateCanReadTeam(team, requester);
          return new TeamMeResponse(member.getUser().getId(), member.getRole());
        })
        .orElseGet(() -> {
          if (globalAuthorizationService.isGlobalAdmin(requester)) {
            return new TeamMeResponse(requester.getId(), null);
          }

          throw new ForbiddenException("User is not a member of this team");
        });
  }

  /**
   * Returns team activity visible to the requester.
   */
  @Transactional(readOnly = true)
  public PageResponse<TeamActivityResponse> getTeamActivities(
      String teamKey,
      Pageable pageable,
      Authentication authentication) {

    UserEntity requester = globalAuthorizationService.getUserByEmail(authentication.getName());
    TeamEntity team = teamAuthorizationService.requireTeam(normalizeTeamKey(teamKey));
    validateCanReadTeam(team, requester);

    Page<ActivityEventEntity> page = activityEventRepository.findTeamActivity(team.getId(), pageable);

    return toPageResponse(page, activityEventService::toTeamActivitiesResponse);
  }

  /**
   * Adds members in a team
   * User must be unique for the team
   */
  @Transactional
  public AddTeamMembersResponse addMembers(
      String teamKey,
      AddTeamMembersRequest request,
      String requesterEmail) {

    UserEntity requester = globalAuthorizationService.getUserByEmail(requesterEmail);

    TeamEntity team = teamAuthorizationService.requireActiveTeam(teamKey);

    teamAuthorizationService.validateManagerMembership(team.getId(), requester.getId());

    List<TeamMemberResponse> success = new ArrayList<>();
    List<FailedMember> failed = new ArrayList<>();

    for (TeamMemberRequest user : request.members()) {

      try {
        TeamMemberEntity member = addTeamMember(team, user, requester);

        teamMemberRepository.flush();

        success.add(mapToMemberResponse(member));

        activityEventService.recordTeamEvent(
            team,
            requester,
            ActivityEventType.TEAM_MEMBER_ADDED,
            buildTeamActivityDetails(
                List.of("member", "role"),
                null,
                member.getRole().name(),
                member.getUser().getFullName(),
                List.of(
                    activityEventService.change("member", "member", null,
                        member.getUser().getFullName()),
                    activityEventService.change("role", "role", null, member.getRole())),
                member.getUser()),
            null);
        team.setMembershipChangedAt(Instant.now());
      } catch (Exception ex) {
        failed.add(new FailedMember(user.userId(), ex.getMessage()));
      }
    }

    return new AddTeamMembersResponse(success, failed);
  }

  /**
   * Removes a member in a team
   * Only Team Admin and Owner can remove member
   * Only Owner can remove an Admin and can't remove themselves
   */
  @Transactional
  public RemoveTeamMembersResponse removeMembers(
      String teamKey,
      RemoveTeamMembersRequest request,
      String requesterEmail) {

    UserEntity requester = globalAuthorizationService.getUserByEmail(requesterEmail);
    TeamEntity team = teamAuthorizationService.requireActiveTeam(teamKey);

    TeamMemberEntity requesterMembership = requireManagerMembership(team.getId(), requester.getId());

    List<UUID> success = new ArrayList<>();
    List<FailedMember> failed = new ArrayList<>();

    for (UUID userId : request.userIds()) {

      try {
        TeamMemberEntity memberToRemove = teamAuthorizationService.requireActiveMembership(team.getId(), userId);

        if (memberToRemove.getRole() == TeamRole.OWNER) {
          throw new IllegalStateException("Transfer ownership before removing OWNER");
        }

        if (requesterMembership.getRole() == TeamRole.ADMIN &&
            memberToRemove.getRole() != TeamRole.MEMBER) {
          throw new IllegalStateException("ADMIN can only remove MEMBER");
        }

        teamMemberRepository.delete(memberToRemove);

        teamMemberRepository.flush();
        team.setMembershipChangedAt(Instant.now());

        activityEventService.recordTeamEvent(
            team,
            requester,
            ActivityEventType.TEAM_MEMBER_REMOVED,
            buildTeamActivityDetails(
                List.of("member", "role"),
                memberToRemove.getRole().name(),
                null,
                memberToRemove.getUser().getFullName(),
                List.of(
                    activityEventService.change("member", "member", memberToRemove.getUser().getFullName(), null),
                    activityEventService.change("role", "role", memberToRemove.getRole(), null)),
                memberToRemove.getUser()),
            null);

        success.add(userId);

      } catch (Exception ex) {
        failed.add(new FailedMember(userId, ex.getMessage()));
      }
    }

    return new RemoveTeamMembersResponse(success, failed);
  }

  /**
   * Change User's Role
   * Only Owner and Admin can change
   */
  @Transactional
  public TeamMemberResponse changeTeamRole(
      String teamKey,
      UUID targetUserId,
      TeamRole newRole,
      String requesterEmail) {

    UserEntity requester = globalAuthorizationService.getUserByEmail(requesterEmail);

    TeamEntity team = teamAuthorizationService.requireActiveTeam(teamKey);

    teamAuthorizationService.validateManagerMembership(team.getId(), requester.getId());

    TeamMemberEntity targetMember = teamAuthorizationService.requireActiveMembership(team.getId(), targetUserId);

    if (targetMember.getRole() == TeamRole.OWNER) {
      throw new ConflictException("Owner role cannot be modified.");
    }

    if (requester.getId().equals(targetUserId)) {
      throw new ConflictException("You cannot change your own role.");
    }

    if (newRole == TeamRole.OWNER) {
      throw new ConflictException("Use ownership transfer endpoint.");
    }

    TeamRole previousRole = targetMember.getRole();
    if (previousRole == newRole) {
      return mapToMemberResponse(targetMember);
    }

    targetMember.setRole(newRole);
    targetMember.getTeam().setMembershipChangedAt(Instant.now());

    activityEventService.recordTeamEvent(
        targetMember.getTeam(),
        requester,
        ActivityEventType.TEAM_MEMBER_ROLE_CHANGED,
        buildTeamActivityDetails(
            List.of("role"),
            previousRole.name(),
            newRole.name(),
            targetMember.getUser().getFullName(),
            List.of(activityEventService.change("role", "role", previousRole, newRole)),
            targetMember.getUser()),
        null);

    return mapToMemberResponse(targetMember);
  }

  /**
   * Transfers Team Ownership to another Global Admin or Super Admin
   * New Owner must be a member
   */
  @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN')")
  @Transactional
  public TeamMemberResponse transferOwnership(
      String teamKey,
      UUID newOwnerUserId,
      String requesterEmail) {

    UserEntity requester = globalAuthorizationService.getUserByEmail(requesterEmail);

    TeamEntity team = teamAuthorizationService.requireActiveTeam(teamKey);
    TeamMemberEntity owner = requireOwnerMembership(team.getId(), requester.getId());

    if (requester.getId().equals(newOwnerUserId)) {
      throw new ConflictException("You are already the OWNER");
    }

    TeamMemberEntity newOwner = teamAuthorizationService.requireActiveMembership(team.getId(), newOwnerUserId);

    globalAuthorizationService.validateGlobalAdmin(newOwner.getUser().getRole());

    owner.setRole(TeamRole.ADMIN);
    newOwner.setRole(TeamRole.OWNER);
    newOwner.getTeam().setOwner(newOwner.getUser());
    newOwner.getTeam().setOwnerChangedAt(Instant.now());
    newOwner.getTeam().setMembershipChangedAt(Instant.now());

    activityEventService.recordTeamEvent(
        newOwner.getTeam(),
        requester,
        ActivityEventType.TEAM_OWNERSHIP_TRANSFERRED,
        buildTeamActivityDetails(
            List.of("owner"),
            owner.getUser().getFullName(),
            newOwner.getUser().getFullName(),
            newOwner.getUser().getFullName(),
            List.of(activityEventService.change("owner", "owner", owner.getUser().getFullName(),
                newOwner.getUser().getFullName())),
            newOwner.getUser()),
        null);

    return mapToMemberResponse(newOwner);
  }

  // ********************
  // HELPERS
  // ********************

  private <T, R> PageResponse<R> toPageResponse(Page<T> page, Function<T, R> mapper) {
    return new PageResponse<>(
        page.map(mapper).getContent(),
        page.getNumber(),
        page.getSize(),
        page.getTotalElements(),
        page.getTotalPages(),
        page.isFirst(),
        page.isLast());
  }

  public TeamResponse mapToResponse(TeamEntity team) {
    TeamResponse.User user = new TeamResponse.User(
        team.getOwner().getId(),
        team.getOwner().getFirstName(),
        team.getOwner().getLastName(),
        team.getOwner().getEmail());

    TeamResponse.User createdBy = team.getCreatedBy() == null
        ? null
        : new TeamResponse.User(
            team.getCreatedBy().getId(),
            team.getCreatedBy().getFirstName(),
            team.getCreatedBy().getLastName(),
            team.getCreatedBy().getEmail());

    TeamResponse.User deletedBy = team.getDeletedBy() == null
        ? null
        : new TeamResponse.User(
            team.getDeletedBy().getId(),
            team.getDeletedBy().getFirstName(),
            team.getDeletedBy().getLastName(),
            team.getDeletedBy().getEmail());

    boolean isDeleted = team.getDeletedAt() != null;

    return new TeamResponse(
        team.getKey(),
        team.getName(),
        team.getDescription(),
        user,
        createdBy,
        deletedBy,
        team.getCreatedAt(),
        team.getUpdatedAt(),
        team.getLastActivityAt(),
        team.getOwnerChangedAt(),
        team.getMembershipChangedAt(),
        team.getDeletedAt(),
        isDeleted);
  }

  private TeamMemberResponse mapToMemberResponse(TeamMemberEntity member) {

    TeamMemberResponse.User user = new TeamMemberResponse.User(
        member.getAddedBy().getId(),
        member.getAddedBy().getFirstName(),
        member.getAddedBy().getLastName(),
        member.getAddedBy().getEmail());

    return new TeamMemberResponse(
        member.getUser().getId(),
        member.getUser().getFirstName(),
        member.getUser().getLastName(),
        member.getUser().getEmail(),
        member.getRole(),
        member.getUser().getRole(),
        member.getJoinedAt(),
        user);
  }

  private UserResponse mapToNonMemberResponse(UserEntity user) {
    return new UserResponse(
        user.getId(),
        user.getFirstName(),
        user.getLastName(),
        user.getEmail(),
        user.getRole());
  }

  private UserEntity getUserById(UUID id) {
    return userRepository.findById(id)
        .orElseThrow(() -> new ResourceNotFoundException("User not found"));
  }

  /**
   * Ensures:
   * - Team exists and active
   * - Membership exists
   * - User is owner
   *
   * Returns membership entity.
   */
  private TeamMemberEntity requireOwnerMembership(UUID teamId, UUID userId) {
    TeamMemberEntity membership = teamAuthorizationService.requireActiveMembership(teamId, userId);
    if (membership.getRole() != TeamRole.OWNER) {
      throw new ForbiddenException("User is not the owner of this team");
    }

    return membership;
  }

  /**
   * Ensures:
   * - User is Team member
   * - Role is Team OWNER or ADMIN
   * 
   * Returns membership entity
   */
  private TeamMemberEntity requireManagerMembership(UUID teamId, UUID userId) {
    TeamMemberEntity membership = teamAuthorizationService.requireActiveMembership(teamId, userId);
    if (!teamAuthorizationService.canManageTeam(membership)) {
      throw new ForbiddenException("Insufficient permissions");
    }

    return membership;
  }

  /**
   * Ensures:
   * - Team exist and active
   * - User is not Team member
   * - Adds user to the team
   * 
   * Returns membership entity
   */
  private TeamMemberEntity addTeamMember(
      TeamEntity team,
      TeamMemberRequest request,
      UserEntity requester) {

    UserEntity user = getUserById(request.userId());

    if (teamAuthorizationService.hasActiveMembership(team.getId(), request.userId())) {
      throw new ConflictException("User is already a member of the team");
    }

    TeamRole role = request.role() == null
        ? TeamRole.MEMBER
        : request.role();

    if (role == TeamRole.OWNER) {
      throw new ConflictException("Cannot assign OWNER role");
    }

    TeamMemberEntity member = new TeamMemberEntity();
    member.setTeam(team);
    member.setUser(user);
    member.setRole(role);
    member.setAddedBy(requester);

    return teamMemberRepository.save(member);
  }

  /*
   * Check sort request
   */
  private Pageable requireSortable(Pageable pageable) {

    for (Sort.Order order : pageable.getSort()) {
      if (!ALLOWED_SORT_FIELDS.contains(order.getProperty())) {
        throw new BadRequestInputException(
            "Invalid sort field: " + order.getProperty());
      }
    }

    return pageable;
  }

  /**
   * Ensures Team Name is unique for an active team
   */
  private void validateUniqueTeamName(UUID ownerId, String name) {
    if (teamRepository.existsByOwnerIdAndNameIgnoreCaseAndDeletedAtIsNull(ownerId, name)) {
      throw new ConflictException("Team name already exists");
    }
  }

  /**
   * Ensures user is the Owner of the team
   */
  private void validateOwnerMembership(UUID teamId, UUID userId) {
    TeamMemberEntity membership = teamAuthorizationService.requireActiveMembership(teamId, userId);
    if (membership.getRole() != TeamRole.OWNER) {
      throw new ForbiddenException("User is not the owner of this team");
    }
  }

  /**
   * Ensures:
   * - User is able to read team
   * - User is Global admin or team member
   */
  private void validateCanReadTeam(TeamEntity team, UserEntity requester) {
    if (globalAuthorizationService.isGlobalAdmin(requester)) {
      return;
    }

    TeamMemberEntity membership = teamMemberRepository.findByTeamIdAndUserId(team.getId(), requester.getId())
        .orElseThrow(() -> new ResourceNotFoundException("Team not found"));

    if (team.getDeletedAt() != null && !teamAuthorizationService.canManageTeam(membership)) {
      throw new ResourceNotFoundException("Team not found");
    }
  }

  private String normalizeTeamName(String name) {
    return name.trim().toLowerCase(Locale.ROOT);
  }

  private String normalizeTeamKey(String key) {
    return key.trim().toUpperCase(Locale.ROOT);
  }

  private TeamDetailsUpdateMessage buildTeamUpdateMessage(
      String previousName,
      String previousDescription,
      String newName,
      String newDescription) {

    List<String> fields = new ArrayList<>();
    List<ActivityEventDetails.ActivityChange> changes = new ArrayList<>();

    if (!Objects.equals(previousName, newName)) {
      fields.add("name");
      changes.add(activityEventService.change("name", "name", previousName, newName));
    }

    if (!Objects.equals(previousDescription, newDescription)) {
      fields.add("description");
      changes.add(activityEventService.change("description", "description", previousDescription, newDescription));
    }

    if (fields.isEmpty()) {
      return new TeamDetailsUpdateMessage("Team updated", List.of(), List.of());
    }

    return new TeamDetailsUpdateMessage(
        "Team updated: " + String.join(", ", fields),
        fields,
        changes);
  }

  private record TeamDetailsUpdateMessage(
      String message,
      List<String> fields,
      List<ActivityEventDetails.ActivityChange> changes) {
  }

  private ActivityEventDetails buildTeamActivityDetails(
      List<String> fields,
      String from,
      String to,
      String target,
      List<ActivityEventDetails.ActivityChange> changes,
      UserEntity subjectUser) {
    return new ActivityEventDetails(
        fields,
        from,
        to,
        target,
        changes,
        null,
        null,
        null,
        subjectUser == null ? null : activityEventService.reference(subjectUser));
  }

  private String generateUniqueKey() {

    String key;

    do {
      key = keyGenerator.generate();
    } while (teamRepository.existsByKey(key));

    return key;
  }
}
