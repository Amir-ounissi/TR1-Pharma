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
        background: "#0b1e32",
        color: "white",
        fontFamily: "Arial, sans-serif",
        fontWeight: 900,
        fontSize: Math.round(size * 0.31),
        letterSpacing: "-0.055em",
        position: "relative",
      },
    },
    createElement("span", null, "TR1"),
    createElement("span", {
      style: {
        position: "absolute",
        top: `${Math.round(size * 0.17)}px`,
        right: `${Math.round(size * 0.17)}px`,
        width: `${Math.round(size * 0.075)}px`,
        height: `${Math.round(size * 0.075)}px`,
        borderRadius: "999px",
        background: "#ef6a3a",
      },
    }),
  );

  return new ImageResponse(mark, {
    width: size,
    height: size,
  });
}
