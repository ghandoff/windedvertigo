import { StudentRoom } from "./student-room";

export default async function StudentRoomPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <StudentRoom code={code.toUpperCase()} />;
}
