package com.example.task_manager.seed;

import java.util.ArrayList;
import java.util.List;

import org.springframework.stereotype.Service;

import com.example.task_manager.auth.AuthService;
import com.example.task_manager.auth.dto.RegisterRequest;
import com.example.task_manager.user.UserRepository;
import com.example.task_manager.user.entity.UserEntity;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class UserSeederService {

  private final AuthService authService;
  private final UserRepository userRepository;

  public List<UserEntity> seedUsers(int count, String batchId) {
    List<UserEntity> users = new ArrayList<>(count);

    for (int index = 0; index < count; index++) {
      int number = index + 1;
      String email = batchId + ".user" + String.format("%03d", number) + "@example.com";

      authService.register(new RegisterRequest(
          email,
          "Demo" + number,
          "User" + number,
          "Admin123@",
          "Admin123@"), null, null);

      UserEntity user = userRepository.findByEmail(email)
          .orElseThrow();

      users.add(user);
    }

    return users;
  }
}