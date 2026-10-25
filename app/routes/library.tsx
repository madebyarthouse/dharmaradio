import { redirect } from "react-router";

/** The library now lives inside Practice; keep old links working. */
export const loader = () => redirect("/practice", 301);
