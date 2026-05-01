"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { BASE_PATH } from "@/lib/paths";

type Props = {
  code: string;
  size?: number;
};

// matches --color-cadet and --color-wv-white
const QR_DARK = "#273248";
const QR_LIGHT = "#ffffff";

// renders a QR that points at the canonical join URL for this room.
// uses window.location.origin so it works in local dev, the vercel preview,
// and the windedvertigo.com proxy without any env wiring.
export function JoinQR({ code, size = 176 }: Props) {
  const [svg, setSvg] = useState<string>("");
  const [href, setHref] = useState<string>("");

  useEffect(() => {
    const origin = window.location.origin;
    const url = `${origin}${BASE_PATH}/room/${code}/join`;
    setHref(url);
    QRCode.toString(url, {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 1,
      color: { dark: QR_DARK, light: QR_LIGHT },
    })
      .then(setSvg)
      .catch(() => setSvg(""));
  }, [code]);

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        aria-label={`join link for room ${code}`}
        style={{ width: size, height: size }}
        className="bg-white rounded-lg p-2 shadow-sm"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <p className="text-xs text-center max-w-[14rem] break-all text-[color:var(--color-cadet)]/70 font-mono">
        {href || "…"}
      </p>
    </div>
  );
}
