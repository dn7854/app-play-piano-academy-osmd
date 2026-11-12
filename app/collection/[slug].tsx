import { useLocalSearchParams } from "expo-router";
import { LibraryScreen } from "../../src/components/LibraryScreen";

export default function CollectionRoute() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  return <LibraryScreen slug={typeof slug === "string" ? slug : slug?.[0]} />;
}
