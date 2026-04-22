declare module "swagger-ui-dist/swagger-ui-bundle.js" {
  export type SwaggerUIBundleConfig = {
    domNode: HTMLElement;
    url?: string;
    deepLinking?: boolean;
    tryItOutEnabled?: boolean;
  };

  type SwaggerUIBundleFn = (config: SwaggerUIBundleConfig) => unknown;

  const SwaggerUIBundle: SwaggerUIBundleFn;
  export default SwaggerUIBundle;
}
