package com.example.task_manager.common;

import java.security.SecureRandom;

import org.springframework.stereotype.Component;

@Component
public class TeamKeyGenerator {

  private static final String PREFIX = "TM-";

  private static final char[] CHARACTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".toCharArray();

  private static final int RANDOM_LENGTH = 6;

  private final SecureRandom secureRandom = new SecureRandom();

  public String generate() {

    StringBuilder key = new StringBuilder(
        PREFIX.length() + RANDOM_LENGTH);

    key.append(PREFIX);

    for (int i = 0; i < RANDOM_LENGTH; i++) {
      int index = secureRandom.nextInt(CHARACTERS.length);
      key.append(CHARACTERS[index]);
    }

    return key.toString();
  }
}