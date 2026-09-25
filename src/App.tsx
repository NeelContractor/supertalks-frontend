import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/auth";
import { useStore } from "@/store";
import { ProtectedRoute, AstrologerRoute } from "@/components/ProtectedRoute";
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

function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-muted/40">
      <Navbar />
      <main className="mx-auto flex w-[90%] flex-1 flex-col p-3">{children}</main>
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
          <Route path="/register" element={<Register />} />
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
                <DashboardLayout>
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
