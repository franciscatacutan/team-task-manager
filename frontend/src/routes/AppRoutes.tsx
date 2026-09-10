import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import AuthPage from "../pages/AuthPage";
import ErrorPage from "../pages/ErrorPage";

import ProtectedRoute from "./ProtectedRoute";
import PublicRoute from "./PublicRoute";

import TeamSelectionPage from "../pages/TeamSelectionPage";
import ProfilePage from "../pages/ProfilePage";
import SettingsPage from "../pages/SettingsPage";
import UsersPage from "../pages/UsersPage";
import TaskDetails from "../features/tasks/components/TaskDetails";
import ProjectDetails from "../features/projects/components/ProjectDetails";
import ProjectsView from "../features/projects/components/ProjectsView";
import WorkspaceLayout from "../layout/workspace/WorkspaceLayout";
import TeamOverview from "../features/teams/components/TeamOverview";
import TeamMembersPage from "../features/teams/components/MembersView";
import AppLayout from "../layout/AppLayout";
import TeamActivity from "../features/teams/components/TeamActivity";
import TeamInsightsPage from "../features/teams/components/TeamInsightsPage";
import { useThemePreference } from "../features/settings/hooks/useThemePreference";

export default function AppRoutes() {
  useThemePreference();

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            <PublicRoute>
              <AuthPage />
            </PublicRoute>
          }
        />
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route
            path="/teams"
            element={
              <ProtectedRoute>
                <TeamSelectionPage />
              </ProtectedRoute>
            }
          />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/users/:userId" element={<ProfilePage />} />

          <Route
            path="/teams/:teamKey"
            element={
              <ProtectedRoute>
                <WorkspaceLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<TeamOverview />} />
            <Route path="projects" element={<ProjectsView />} />
            <Route path="members" element={<TeamMembersPage />} />
            <Route path="activity" element={<TeamActivity />} />
            <Route path="insights" element={<TeamInsightsPage />} />
            <Route path="projects/:projectId" element={<ProjectDetails />} />

            <Route
              path="projects/:projectId/tasks/:taskId"
              element={<TaskDetails />}
            />
          </Route>
        </Route>

        <Route path="/" element={<Navigate to="/teams" replace />} />

        <Route path="*" element={<ErrorPage />} />
      </Routes>
    </BrowserRouter>
  );
}
