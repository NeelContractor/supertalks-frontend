import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/auth";
import { ProtectedRoute, AstrologerRoute } from "@/components/ProtectedRoute";
import { Navbar } from "@/components/Navbar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "sonner";
import SignInPage from "@/pages/SignIn";
import SignUpPage from "@/pages/SignUp";
import OnboardPage from "@/pages/Onboard";
import DashboardPage from "@/pages/Dashboard";
import QuestionsPage from "@/pages/Questions";
import QuestionChatPage from "@/pages/QuestionChat";
import BookingsPage from "@/pages/Bookings";
import ProfilePage from "@/pages/Profile";
import WebsitePage from "@/pages/Website";

function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-muted/40">
      <Navbar />
      <main className="mx-auto w-[80%] p-6">{children}</main>
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <TooltipProvider delayDuration={100}>
          <Toaster position="top-right" richColors />
          <Routes>
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
              <AstrologerRoute>
                <DashboardLayout>
                  <DashboardPage />
                </DashboardLayout>
              </AstrologerRoute>
            }
          />
          <Route
            path="/questions"
            element={
              <AstrologerRoute>
                <DashboardLayout>
                  <QuestionsPage />
                </DashboardLayout>
              </AstrologerRoute>
            }
          />
          <Route
            path="/questions/:id"
            element={
              <AstrologerRoute>
                <DashboardLayout>
                  <QuestionChatPage />
                </DashboardLayout>
              </AstrologerRoute>
            }
          />
          <Route
            path="/bookings"
            element={
              <AstrologerRoute>
                <DashboardLayout>
                  <BookingsPage />
                </DashboardLayout>
              </AstrologerRoute>
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
