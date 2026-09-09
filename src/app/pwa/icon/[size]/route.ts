import { ImageResponse } from "next/og";
import { createElement } from "react";

const supportedSizes = new Set([180, 192, 512]);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ size: string }> },
) {
  const { size: rawSize } = await params;
  const size = Number(rawSize);

  if (!supportedSizes.has(size)) {
    return new Response("Unsupported icon size", { status: 404 });
  }

  const mark = createElement(
    "div",
    {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f4f0e7",
        fontFamily: "Arial, sans-serif",
        fontWeight: 900,
        fontSize: Math.round(size * 0.34),
        letterSpacing: "-0.075em",
      },
    },
    createElement("span", { style: { color: "#0e1d31" } }, "TR"),
    createElement("span", { style: { color: "#ea7015", marginLeft: `${Math.round(size * 0.012)}px` } }, "1"),
  );

  return new ImageResponse(mark, {
    width: size,
    height: size,
  });
}
