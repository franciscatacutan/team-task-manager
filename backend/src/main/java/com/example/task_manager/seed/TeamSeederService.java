package com.example.task_manager.seed;

import com.example.task_manager.team.TeamService;
import com.example.task_manager.team.dto.CreateTeamRequest;
import com.example.task_manager.team.dto.TeamResponse;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class TeamSeederService {

  private final TeamService teamService;

  public List<TeamResponse> seedTeams(int count, String batchId, String requesterEmail) {
    List<TeamResponse> teams = new ArrayList<>(count);

    for (int index = 0; index < count; index++) {
      int number = index + 1;
      teams.add(
          teamService.createTeam(
              new CreateTeamRequest(
                  "Demo Team " + number + " [" + batchId + "]",
                  "Seeded team " + number + " for UI and workflow testing."),
              requesterEmail));
    }

    return teams;
  }
}
