import type { Metadata } from "next";

import { SwaggerUiClient } from "./SwaggerUiClient";

export const metadata: Metadata = {
  title: "API 文档 | Anitrack",
  description: "Anitrack OpenAPI（Swagger UI）",
};

export default function ApiDocsPage() {
  return <SwaggerUiClient />;
}
