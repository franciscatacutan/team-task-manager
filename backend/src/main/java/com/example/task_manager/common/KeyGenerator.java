package com.example.task_manager.common;

import java.security.SecureRandom;

import org.springframework.stereotype.Component;

@Component
public class KeyGenerator {

  private static final String CHARACTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  private static final int KEY_LENGTH = 8;

  private final SecureRandom random = new SecureRandom();

  public String generate() {
    StringBuilder key = new StringBuilder(KEY_LENGTH);

    for (int i = 0; i < KEY_LENGTH; i++) {
      key.append(CHARACTERS.charAt(
          random.nextInt(CHARACTERS.length())));
    }

    return key.toString();
  }
}