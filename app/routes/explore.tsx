import { redirect } from "react-router";

/** Explore became Listen; keep old links working. */
export const loader = () => redirect("/listen", 301);
