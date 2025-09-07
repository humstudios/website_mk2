import { onRequest as __api_contact_js_onRequest } from "C:\\Users\\Evil Eric\\Desktop\\GPT5 Website3\\functions\\api\\contact.js"
import { onRequest as ____path___js_onRequest } from "C:\\Users\\Evil Eric\\Desktop\\GPT5 Website3\\functions\\[[path]].js"

export const routes = [
    {
      routePath: "/api/contact",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_contact_js_onRequest],
    },
  {
      routePath: "/:path*",
      mountPath: "/",
      method: "",
      middlewares: [],
      modules: [____path___js_onRequest],
    },
  ]