import type { CharacterKey } from './session';

export const LOCKED_STYLE = `8-bit pixel art, 16-color palette, 64x64 sprite resolution upscaled to 512x512 with nearest-neighbor scaling, top-down or 3/4 isometric view, clean 1-pixel outlines in deep brown, no anti-aliasing, no gradients, no smooth shading, no text or signage with readable letters, no people, no faces. Bright sunny day. Colorful, beautiful, warm and alive. Vibrant palette: cyan-blue sky, warm cream horizon, terracotta walls, lush greens, scattered pink flowers, yellow accents. Reference: Stardew Valley environmental tiles in spring, A Short Hike palette warmth, slightly storybook.`;

export const SEED_SUBJECT = `Subject: a small community library on a sunny day. Wooden building with warm terracotta-red walls, pitched red-tile roof, two windows with stacks of books visible inside. A bright yellow door, slightly ajar. A tree on the left with full green leaves. A wooden bench to the right with an open book on it. A small free-library book box on a post near the path.

Scene context: a stone path leads from the door toward the viewer. Green grass with small pink flower clusters scattered through it. Bright blue sky with a few soft white clouds. Sunlight from upper-left. The library is the only building visible.`;

export const NEGATIVE_PROMPT = `no text, no readable letters, no signs with words, no people, no faces, no logos, no watermarks, no blurry edges, no smooth gradients, no photo-realism, no 3D rendering, no modern UI elements, no over-rendered detail, no dark night sky.`;

export function getEvolutionPrompt(
  character: CharacterKey,
  options?: {
    objectChoice?: string;
    erasedElement?: string;
  }
): string | null {
  switch (character) {
    case 'explorer':
      return `${LOCKED_STYLE}

Same scene as the previous image. Add one small object placed on the bench (next to the open book): a ${options?.objectChoice ?? 'lamp'}. It should look freshly left there by someone who came, sat for a moment, and walked away. Everything else identical.`;

    case 'ripple':
      return `${LOCKED_STYLE}

Same scene as the previous image. In the background, behind the library, add three faint partially-transparent duplicates of the library, slightly smaller and fading into the distance. The original library remains in the foreground unchanged.`;

    case 'ghost':
      return `${LOCKED_STYLE}

Same scene as the previous image. Erase ${options?.erasedElement ?? 'the bench'}. Where it used to be, leave a soft hollow shape outlined in white, as if it was carefully scooped out of the world. The rest of the scene continues around the absence, untouched.`;

    case 'timeTraveler':
      return `${LOCKED_STYLE}

Same scene as the previous image, but ten years later, still daytime. Paint chipping on the walls. The terracotta now sun-faded. Vines climbing the corner of the building. The tree noticeably larger. The bench worn but still standing. The bicycle is gone but a new one leans nearby. Same composition, same angle, weathered by time. The mood is wistful and warm, not abandoned.`;

    case 'trickster':
      return `${LOCKED_STYLE}

Same scene as the previous image, but with two changes: (1) Invert all colors — terracotta walls become cool teal-green, blue sky becomes warm coral, yellow door becomes purple, green grass becomes pink, etc. (2) Mirror the entire scene horizontally — left becomes right. Otherwise identical composition.`;

    case 'builder':
      return null; // Builder returns prevImageUrl as-is
  }
}
