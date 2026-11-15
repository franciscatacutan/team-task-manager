package com.example.task_manager.team;

import com.example.task_manager.config.security.Authorization.GlobalAuthorizationService;
import com.example.task_manager.config.security.Authorization.TeamAuthorizationService;
import com.example.task_manager.exception.api.BadRequestInputException;
import com.example.task_manager.exception.api.ConflictException;
import com.example.task_manager.team.entity.TeamInvitation;
import com.example.task_manager.user.UserRepository;
import com.example.task_manager.user.entity.UserEntity;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class TeamInvitationService {
  private static final Duration LIFETIME = Duration.ofHours(24);
  private static final SecureRandom RANDOM = new SecureRandom();
  private final TeamInvitationRepository invitations;
  private final TeamRepository teams;
  private final TeamMemberRepository members;
  private final TeamMemberOperations membership;
  private final UserRepository users;
  private final GlobalAuthorizationService globalAuthorization;
  private final TeamAuthorizationService teamAuthorization;

  @Transactional
  public CreatedInvitation create(String teamKey, String email, String requesterEmail) {
    var team = teamAuthorization.requireActiveTeamForUpdate(teamKey);
    var requester = globalAuthorization.getUserByEmail(requesterEmail);
    requester = teamAuthorization.requireEnabledAccountForUpdate(requester.getId());
    teamAuthorization.validateManagerMembership(team.getId(), requester.getId());
    String normalized = email.strip().toLowerCase(Locale.ROOT);
    if (users.existsByEmailIgnoreCase(normalized)) {
      throw new ConflictException("An account with this email already exists. Use Add members.");
    }

    byte[] bytes = new byte[32];
    RANDOM.nextBytes(bytes);
    String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    var invitation = new TeamInvitation();
    invitation.setTeam(team);
    invitation.setInviter(requester);
    invitation.setEmail(normalized);
    invitation.setTokenHash(hash(token));
    invitation.setExpiresAt(Instant.now().plus(LIFETIME));
    invitations.replacePendingInvitation(team.getId(), normalized);
    invitations.save(invitation);
    return new CreatedInvitation(token, invitation.getExpiresAt());
  }

  @Transactional(propagation = Propagation.MANDATORY)
  public TeamInvitation requireValidInvitation(String token, String normalizedEmail) {
    String hash = hash(token);
    String teamKey = invitations.findTeamKeyByTokenHash(hash).orElseThrow(this::unavailable);
    // A team lock serializes invite replacement, redemption and membership changes.
    var team =
        teams
            .findByKeyForUpdate(teamKey)
            .filter(candidate -> candidate.getDeletedAt() == null)
            .orElseThrow(this::unavailable);
    var invitation =
        invitations
            .findByTokenHash(hash)
            .filter(
                candidate ->
                    candidate.getConsumedAt() == null
                        && candidate.getExpiresAt().isAfter(Instant.now())
                        && candidate.getEmail().equals(normalizedEmail))
            .orElseThrow(this::unavailable);
    var inviter =
        users
            .findByIdForUpdate(invitation.getInviter().getId())
            .filter(user -> !user.isArchived())
            .orElseThrow(this::unavailable);
    if (members
        .findByTeamIdAndUserId(team.getId(), inviter.getId())
        .filter(teamAuthorization::canManageTeam)
        .isEmpty()) {
      throw unavailable();
    }
    return invitation;
  }

  @Transactional(propagation = Propagation.MANDATORY)
  public void redeem(TeamInvitation invitation, UserEntity user) {
    membership.addInvitedMember(invitation.getTeam(), invitation.getInviter(), user);
    invitation.setConsumedAt(Instant.now());
  }

  private BadRequestInputException unavailable() {
    return new BadRequestInputException(
        "Invite is unavailable. Check the invited email or ask your team manager for a new link.");
  }

  private static String hash(String token) {
    try {
      return HexFormat.of()
          .formatHex(
              MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8)));
    } catch (NoSuchAlgorithmException ex) {
      throw new IllegalStateException("SHA-256 is unavailable", ex);
    }
  }

  public record CreatedInvitation(String token, Instant expiresAt) {}
}
