import Quiz from "@/components/Quiz";
import { useCityPopulation } from "@/hooks/use-city-population";
import { useAuth } from "@/hooks/use-auth";

/**
 * Thin route wrapper: resolves the signed-in resident's city population so the
 * quiz can scale an individual score into a city-wide impact figure.
 */
export default function QuizPage() {
  const { user } = useAuth();
  const city = user?.city?.trim() || "Mumbai";
  const { population } = useCityPopulation(city);

  return <Quiz population={population} />;
}
