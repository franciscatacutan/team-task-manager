import { Outlet } from "react-router";
import TopBar from "./TopBar";

export default function AppLayout() {
  return (
    <div className="flex h-screen w-screen flex-col bg-muted/15">
      <TopBar />

      <main className="flex-1 min-h-0 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
