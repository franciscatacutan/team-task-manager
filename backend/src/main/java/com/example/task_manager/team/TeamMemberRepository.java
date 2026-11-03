package com.example.task_manager.team;

import com.example.task_manager.team.entity.TeamMemberEntity;
import com.example.task_manager.team.entity.TeamRole;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

/** Repository interface for Team Member entities. */
public interface TeamMemberRepository
    extends JpaRepository<TeamMemberEntity, UUID>, JpaSpecificationExecutor<TeamMemberEntity> {

  Optional<TeamMemberEntity> findByTeamIdAndUserIdAndTeamDeletedAtIsNull(UUID teamId, UUID userId);

  boolean existsByTeamIdAndUserIdAndTeamDeletedAtIsNull(UUID teamId, UUID userId);

  List<TeamMemberEntity> findMembersByTeamId(UUID teamId);

  Optional<TeamMemberEntity> findByTeamIdAndUserId(UUID teamId, UUID userId);

  boolean existsByTeamIdAndUserId(UUID teamId, UUID userId);

  @Query(
      """
      SELECT targetMember
      FROM TeamMemberEntity targetMember
      JOIN FETCH targetMember.team team
      WHERE targetMember.user.id = :targetUserId
      AND (
          :canViewAllTeams = true
          OR (
              team.deletedAt IS NULL
              AND EXISTS (
                  SELECT requesterMember.id
                  FROM TeamMemberEntity requesterMember
                  WHERE requesterMember.team.id = team.id
                  AND requesterMember.user.id = :requesterUserId
              )
          )
          OR (
              team.deletedAt IS NOT NULL
              AND EXISTS (
                  SELECT requesterMember.id
                  FROM TeamMemberEntity requesterMember
                  WHERE requesterMember.team.id = team.id
                  AND requesterMember.user.id = :requesterUserId
                  AND requesterMember.role IN (com.example.task_manager.team.entity.TeamRole.OWNER, com.example.task_manager.team.entity.TeamRole.ADMIN)
              )
          )
      )
      ORDER BY team.name ASC
      """)
  List<TeamMemberEntity> findVisibleTeamSummariesForUser(
      UUID targetUserId, UUID requesterUserId, boolean canViewAllTeams);

  long countByTeamId(UUID teamId);

  long countByTeamIdAndRole(UUID teamId, TeamRole role);
}
