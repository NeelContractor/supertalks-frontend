import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export default function OnboardPage() {
  const { user, onboard } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleOnboard = async () => {
    setLoading(true);
    try {
      await onboard();
      toast.success("Welcome! Your astrologer profile has been created.");
      navigate("/profile");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Star className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Become an Astrologer</CardTitle>
          <CardDescription>
            Hi {user?.name}! Ready to start offering your astrological services to clients?
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            By continuing, you&apos;ll create your astrologer profile. You can then customize your bio,
            pricing, availability, and more from the dashboard.
          </p>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button className="w-full" onClick={handleOnboard} disabled={loading}>
            {loading ? "Setting up..." : "Start as Astrologer"}
          </Button>
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => navigate("/dashboard")}
          >
            I&apos;ll do this later
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
