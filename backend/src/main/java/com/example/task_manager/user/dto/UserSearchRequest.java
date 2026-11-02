package com.example.task_manager.user.dto;

import com.example.task_manager.user.entity.UserRole;
import java.util.Set;

/*
 * DTO for fetching teams with search, filtering and sort
 */
public record UserSearchRequest(String search, Set<UserRole> roles) {}
