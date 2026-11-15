package com.example.task_manager.config.security;

import java.util.HashMap;
import java.util.Map;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.argon2.Argon2PasswordEncoder;
import org.springframework.security.crypto.password.DelegatingPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

/** Configuration class for password encoding. */
@Configuration
public class PasswordEncoderConfig {

  /** Encodes all new passwords with Argon2 */
  @Bean
  public PasswordEncoder passwordEncoder() {
    Map<String, PasswordEncoder> encoders = new HashMap<>();
    PasswordEncoder argon2Encoder = Argon2PasswordEncoder.defaultsForSpringSecurity_v5_8();

    encoders.put("argon2", argon2Encoder);

    DelegatingPasswordEncoder delegatingPasswordEncoder =
        new DelegatingPasswordEncoder("argon2", encoders);
    return delegatingPasswordEncoder;
  }
}
