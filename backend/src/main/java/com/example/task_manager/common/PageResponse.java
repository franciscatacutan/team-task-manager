package com.example.task_manager.common;

import java.util.List;

/*
 * Common DTO for returning pagination format
 */
public record PageResponse<T>(
    List<T> content,
    int page,
    int size,
    long totalElements,
    int totalPages,
    boolean first,
    boolean last) {}
