import { Component, type ReactNode } from "react";
import CrashRecovery from "./components/CrashRecovery";

type Props = { children: ReactNode };
type State = { hasError: boolean };

/** The fallback is outside all application providers, just like this root boundary. */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("UI Crash:", error);
  }

  render() {
    return this.state.hasError ? <CrashRecovery /> : this.props.children;
  }
}
