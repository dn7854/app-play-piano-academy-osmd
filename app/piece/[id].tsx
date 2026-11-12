import { useLocalSearchParams } from "expo-router";
import { PieceScreen } from "../../src/components/PieceScreen";

export default function PieceRoute() {
  const params = useLocalSearchParams<{ id: string; collection?: string }>();
  const id = typeof params.id === "string" ? params.id : params.id?.[0] || "";
  const collection = typeof params.collection === "string" ? params.collection : params.collection?.[0];
  return <PieceScreen key={id} id={id} collection={collection || undefined} />;
}
