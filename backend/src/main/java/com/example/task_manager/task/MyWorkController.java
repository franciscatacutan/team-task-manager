package com.example.task_manager.task;

import com.example.task_manager.common.PageResponse;
import com.example.task_manager.task.dto.MyWorkItem;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/my-work")
@RequiredArgsConstructor
public class MyWorkController {
  private final TaskService taskService;

  @GetMapping
  public PageResponse<MyWorkItem> getMyWork(
      @RequestParam(defaultValue = "false") boolean includeClosed,
      @PageableDefault(size = 20) Pageable pageable,
      Authentication authentication) {
    return taskService.getMyWork(authentication.getName(), includeClosed, pageable);
  }
}
