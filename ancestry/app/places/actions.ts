"use server";

import { auth } from "@windedvertigo/auth";
import { getOrCreateTree, getPlacesWithCoords, getUngeocodedPlaces, geocodePlace, getMigrationPaths, logActivity } from "@/lib/db/queries";
import { revalidatePath } from "next/cache";

export async function getPlaceDataAction() {
  const session = await auth();
  if (!session?.user?.email) throw new Error("unauthorized");

  const tree = await getOrCreateTree(session.user.email);
  const [places, ungeocoded, migrations] = await Promise.all([
    getPlacesWithCoords(tree.id),
    getUngeocodedPlaces(tree.id),
    getMigrationPaths(tree.id),
  ]);

  return { places, ungeocoded, migrations };
}

export async function geocodePlacesAction() {
  const session = await auth();
  if (!session?.user?.email) throw new Error("unauthorized");

  const tree = await getOrCreateTree(session.user.email);
  const ungeocoded = await getUngeocodedPlaces(tree.id);

  let geocoded = 0;
  for (const place of ungeocoded) {
    try {
      // use OpenStreetMap Nominatim (free, no auth)
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(place.name)}&format=json&limit=1`,
        { headers: { "User-Agent": "wv-ancestry/1.0" } },
      );
      const data = await res.json();
      if (data.length > 0) {
        await geocodePlace(place.id, parseFloat(data[0].lat), parseFloat(data[0].lon));
        geocoded++;
      }
      // rate limit: 1 req/sec per Nominatim policy
      await new Promise((r) => setTimeout(r, 1100));
    } catch {
      // skip failed geocodes
    }
  }

  if (geocoded > 0) {
    await logActivity({
      treeId: tree.id,
      actorEmail: session.user.email!,
      action: "places_geocoded",
      targetType: "tree",
      targetId: tree.id,
      targetName: `${geocoded} places geocoded`,
    });
  }

  revalidatePath("/places");
  return { geocoded, total: ungeocoded.length };
}
