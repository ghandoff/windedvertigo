import { HostRoom } from "./host-room";

export default async function HostPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <HostRoom code={code.toUpperCase()} />;
}
