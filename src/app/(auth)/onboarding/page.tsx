import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import type { Metadata } from "next";
import { OnboardingWizard } from "@/app/_components/OnboardingWizard";

export const metadata: Metadata = {
  title: "Completá tu perfil — Encore",
};

export default async function OnboardingPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/es/login");
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <OnboardingWizard userId={session.user.id} />
    </div>
  );
}
