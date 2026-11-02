package com.example.task_manager;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

@SpringBootApplication
@EnableJpaAuditing
// EnableJPA for automatic population of auditing fields
// like createdAt and updatedAt
public class TeamTaskManagerApplication {

  public static void main(String[] args) {
    SpringApplication.run(TeamTaskManagerApplication.class, args);
  }
}
