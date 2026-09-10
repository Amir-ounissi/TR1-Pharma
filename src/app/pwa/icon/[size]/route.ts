import { ImageResponse } from "next/og";
import { createElement } from "react";

const supportedSizes = new Set([180, 192, 512]);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ size: string }> },
) {
  const { size: rawSize } = await params;
  const size = Number(rawSize);

  if (!supportedSizes.has(size)) {
    return new Response("Unsupported icon size", { status: 404 });
  }

  const logoUrl = new URL("/brand/tr1-wordmark.webp", request.url).toString();
  const logoWidth = Math.round(size * 0.72);
  const logoHeight = Math.round(logoWidth * (430 / 735));

  const icon = createElement(
    "div",
    {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f4f0e7",
      },
    },
    createElement("img", {
      src: logoUrl,
      alt: "TR1 Pharma",
      width: logoWidth,
      height: logoHeight,
      style: {
        width: `${logoWidth}px`,
        height: `${logoHeight}px`,
        objectFit: "contain",
      },
    }),
  );

  return new ImageResponse(icon, {
    width: size,
    height: size,
  });
}
