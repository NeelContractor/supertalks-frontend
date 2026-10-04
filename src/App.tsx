import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/auth";
import { useStore } from "@/store";
import { ProtectedRoute, AstrologerRoute, RegisterRoute } from "@/components/ProtectedRoute";
import { Navbar } from "@/components/Navbar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "sonner";
import SignInPage from "@/pages/SignIn";
import SignUpPage from "@/pages/SignUp";
import OnboardPage from "@/pages/Onboard";
import DashboardPage from "@/pages/Dashboard";
import QuestionsPage from "@/pages/Questions";
import ClientQuestionsPage from "@/pages/ClientQuestions";
import QuestionChatPage from "@/pages/QuestionChat";
import BookingsPage from "@/pages/Bookings";
import ProfilePage from "@/pages/Profile";
import WebsitePage from "@/pages/Website";
import Register from "./pages/Register";

/**
 * `fullHeight` is for panes that own their own scrolling (the chat window):
 * the shell is pinned to the *visible* viewport so the composer sits on the
 * bottom edge instead of floating above a band of dead space.
 *
 * The plain variant keeps `min-h-screen` so long list pages scroll the document
 * as usual.
 */
function DashboardLayout({
  children,
  fullHeight = false,
}: {
  children: React.ReactNode;
  fullHeight?: boolean;
}) {
  if (fullHeight) {
    return (
      // `100dvh` tracks the visible viewport, unlike `100vh`, which on phones is
      // measured with the browser toolbars hidden and so overshoots by their
      // height - that overshoot is what left the empty gap under the composer.
      <div className="flex h-[100dvh] flex-col overflow-hidden bg-muted/40">
        <Navbar />
        {/* MobileNav is fixed: 1px border + min-h-14 + the home-indicator inset.
            Clearing its real height keeps the composer flush against it. */}
        <main className="mx-auto flex w-[90%] min-h-0 flex-1 flex-col p-1 pb-[calc(3.75rem+env(safe-area-inset-bottom))] md:pb-3">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/40">
      <Navbar />
      {/* extra bottom padding on phones clears the fixed MobileNav tab bar */}
      <main className="mx-auto flex w-[90%] flex-1 flex-col p-1 pb-24 md:pb-3">
        {children}
      </main>
    </div>
  );
}

function QuestionsRoute() {
  const viewAs = useStore((s) => s.viewAs);
  return viewAs === "client" ? <ClientQuestionsPage /> : <QuestionsPage />;
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <TooltipProvider delayDuration={100}>
          <Toaster position="top-right" richColors />
          <Routes>
          <Route path="/register" element={<RegisterRoute><Register /></RegisterRoute>} />
          <Route path="/signin" element={<SignInPage />} />
          <Route path="/signup" element={<SignUpPage />} />
          <Route
            path="/onboard"
            element={
              <ProtectedRoute>
                <OnboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <DashboardPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/questions"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <QuestionsRoute />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/questions/:id"
            element={
              <ProtectedRoute>
                <DashboardLayout fullHeight>
                  <QuestionChatPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/bookings"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <BookingsPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <AstrologerRoute>
                <DashboardLayout>
                  <ProfilePage />
                </DashboardLayout>
              </AstrologerRoute>
            }
          />
          <Route
            path="/website"
            element={
              <AstrologerRoute>
                <DashboardLayout>
                  <WebsitePage />
                </DashboardLayout>
              </AstrologerRoute>
            }
          />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </TooltipProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
