package com.example.task_manager.team;

import com.example.task_manager.team.entity.TeamInvitation;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface TeamInvitationRepository extends JpaRepository<TeamInvitation, UUID> {
  @Query("select i.team.key from TeamInvitation i where i.tokenHash = :hash")
  Optional<String> findTeamKeyByTokenHash(String hash);

  Optional<TeamInvitation> findByTokenHash(String tokenHash);

  Page<TeamInvitation> findByTeamIdAndConsumedAtIsNullAndExpiresAtAfterOrderByExpiresAtAscIdAsc(
      UUID teamId, Instant now, Pageable pageable);

  @Modifying
  @Query(
      "delete from TeamInvitation i where i.team.id = :teamId and i.id = :id and i.consumedAt is null")
  void deleteUnusedInvitation(UUID teamId, UUID id);

  @Modifying
  @Query(
      "delete from TeamInvitation i where i.team.id = :teamId and i.email = :email and i.consumedAt is null")
  void replacePendingInvitation(UUID teamId, String email);
}
