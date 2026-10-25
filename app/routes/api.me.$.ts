import { handleLibrary, privateHeaders } from "~/lib/library.server";
export const headers = () => privateHeaders;
export const loader = handleLibrary;
export const action = handleLibrary;
