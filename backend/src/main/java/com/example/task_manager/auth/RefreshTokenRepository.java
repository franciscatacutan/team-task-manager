package com.example.task_manager.auth;

import com.example.task_manager.auth.entity.RefreshTokenEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface RefreshTokenRepository extends JpaRepository<RefreshTokenEntity, UUID> {

  @Query("select t.user.id from RefreshTokenEntity t where t.tokenHash = :tokenHash")
  Optional<UUID> findUserIdByTokenHash(String tokenHash);

  Optional<RefreshTokenEntity> findByTokenHash(String tokenHash);

  List<RefreshTokenEntity> findAllByFamilyIdAndRevokedAtIsNull(UUID familyId);

  List<RefreshTokenEntity> findAllByUser_IdAndRevokedAtIsNull(UUID userId);
}
