import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/auth";

function FullScreenSpinner() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <FullScreenSpinner />;
  }

  if (!user) {
    return <Navigate to="/signin" replace />;
  }

  return <>{children}</>;
}

/**
 * Gates the 7-step astrologer registration form. It is only reachable by
 * signed-in astrologers who have not submitted an application yet — a user
 * who has already registered is bounced straight to the dashboard so the page
 * never reappears for them.
 */
export function RegisterRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, application, applicationLoaded, applicationError, loadApplication } =
    useAuth();

  useEffect(() => {
    if (!loading && user?.role === "Astrologer") {
      void loadApplication();
    }
  }, [loading, user?.role, loadApplication]);

  if (loading) {
    return <FullScreenSpinner />;
  }

  if (!user) {
    return <Navigate to="/signup" replace />;
  }

  // Clients have no registration to complete.
  if (user.role !== "Astrologer") {
    return <Navigate to="/dashboard" replace />;
  }

  if (application) {
    return <Navigate to="/dashboard" replace />;
  }

  // The lookup failed, so we cannot prove the user is unregistered. Send them
  // to the dashboard rather than showing the form (or an endless spinner).
  if (applicationError) {
    return <Navigate to="/dashboard" replace />;
  }

  // Wait for the application check before rendering, otherwise an
  // already-registered user would see a flash of the form before the redirect.
  if (!applicationLoaded) {
    return <FullScreenSpinner />;
  }

  return <>{children}</>;
}

export function AstrologerRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return <FullScreenSpinner />;
  }

  if (!user) {
    return <Navigate to="/signin" replace />;
  }

  if (user.role !== "Astrologer") {
    return <Navigate to="/onboard" replace />;
  }

  // If role is Astrologer but profile hasn't loaded yet (edge case), still allow through
  // The profile will load on its own
  return <>{children}</>;
}
